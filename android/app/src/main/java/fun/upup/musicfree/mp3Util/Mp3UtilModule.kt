package `fun`.upup.musicfree.mp3Util

import android.content.ContentUris
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import android.provider.OpenableColumns
import com.facebook.react.bridge.*
import org.jaudiotagger.audio.AudioFileIO
import org.jaudiotagger.tag.FieldKey
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.util.Locale

class Mp3UtilModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "Mp3Util"

    private fun isContentUri(uri: Uri?): Boolean {
        return uri?.scheme?.equals("content", ignoreCase = true) == true
    }

    private fun normalizeStoragePath(rawPath: String?): String? {
        if (rawPath.isNullOrBlank()) return null
        val trimmed = rawPath.trim()
        val decodedPath = if (trimmed.startsWith("file://", ignoreCase = true)) {
            Uri.parse(trimmed).path ?: return null
        } else {
            Uri.decode(trimmed)
        }
        var normalized = decodedPath.replace('\\', '/').replace(Regex("/{2,}"), "/")
        if (!normalized.startsWith('/')) return null
        if (normalized.length > 1) normalized = normalized.trimEnd('/')
        normalized = normalized.lowercase(Locale.ROOT)

        val primaryAliases = listOf(
            "/sdcard",
            "/mnt/sdcard",
            "/storage/self/primary",
            "/storage/emulated/legacy",
        )
        for (alias in primaryAliases) {
            if (normalized == alias || normalized.startsWith("$alias/")) {
                normalized = "/storage/emulated/0" + normalized.removePrefix(alias)
                break
            }
        }
        return normalized
    }

    private fun isInSelectedFolders(mediaPath: String?, folders: Set<String>): Boolean {
        val candidate = normalizeStoragePath(mediaPath) ?: return false
        return folders.any { folder ->
            folder == "/" || candidate == folder || candidate.startsWith("$folder/")
        }
    }

    private fun mediaCollections(): List<Pair<String?, Uri>> {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            return listOf(null to MediaStore.Audio.Media.EXTERNAL_CONTENT_URI)
        }
        return MediaStore.getExternalVolumeNames(reactApplicationContext)
            .map { volumeName ->
                volumeName to MediaStore.Audio.Media.getContentUri(volumeName)
            }
            .distinctBy { it.second.toString() }
    }

    private fun volumeRoot(volumeName: String?): String? {
        return when {
            volumeName == null -> null
            volumeName == MediaStore.VOLUME_EXTERNAL_PRIMARY -> "/storage/emulated/0"
            volumeName.equals(MediaStore.VOLUME_EXTERNAL, ignoreCase = true) -> null
            else -> "/storage/$volumeName"
        }
    }

    private fun pathFromRelativeColumns(
        volumeName: String?,
        relativePath: String?,
        displayName: String?,
    ): String? {
        val root = volumeRoot(volumeName) ?: return null
        val name = displayName?.takeIf { it.isNotBlank() } ?: return null
        val relative = relativePath.orEmpty().trim('/')
        return if (relative.isEmpty()) "$root/$name" else "$root/$relative/$name"
    }

    private fun hasSupportedExtension(fileName: String?, extensions: Set<String>): Boolean {
        val normalizedName = fileName?.lowercase(Locale.ROOT) ?: return false
        return extensions.any(normalizedName::endsWith)
    }

    private fun canRead(uri: Uri): Boolean {
        return reactApplicationContext.contentResolver
            .openAssetFileDescriptor(uri, "r")
            ?.use { true }
            ?: false
    }

    /**
     * RNFS cannot traverse arbitrary shared-storage folders under scoped storage.
     * Query MediaStore without interpolated SQL and filter paths in Kotlin so folder
     * aliases, case, path boundaries, and overlapping selections are handled safely.
     */
    @ReactMethod
    fun findAudioInFolders(
        folderPaths: ReadableArray,
        supportedExtensions: ReadableArray,
        promise: Promise,
    ) {
        try {
            val folders = (0 until folderPaths.size())
                .mapNotNull { normalizeStoragePath(folderPaths.getString(it)) }
                .toSet()
            val extensions = (0 until supportedExtensions.size())
                .mapNotNull { supportedExtensions.getString(it)?.trim()?.lowercase(Locale.ROOT) }
                .filter { it.isNotEmpty() }
                .map { if (it.startsWith('.')) it else ".$it" }
                .toSet()
            val results = LinkedHashMap<String, WritableMap>()
            if (folders.isEmpty() || extensions.isEmpty()) {
                promise.resolve(Arguments.createArray())
                return
            }

            for ((volumeName, collection) in mediaCollections()) {
                val projection = mutableListOf(
                    MediaStore.Audio.Media._ID,
                    MediaStore.Audio.Media.DATA,
                    MediaStore.Audio.Media.DISPLAY_NAME,
                ).apply {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        add(MediaStore.Audio.Media.RELATIVE_PATH)
                    }
                }.toTypedArray()

                val cursor = reactApplicationContext.contentResolver.query(
                    collection,
                    projection,
                    null,
                    null,
                    null,
                ) ?: throw IOException("MediaStore returned no cursor for $collection")

                cursor.use {
                    val idColumn = it.getColumnIndexOrThrow(MediaStore.Audio.Media._ID)
                    val dataColumn = it.getColumnIndex(MediaStore.Audio.Media.DATA)
                    val nameColumn = it.getColumnIndex(MediaStore.Audio.Media.DISPLAY_NAME)
                    val relativeColumn = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        it.getColumnIndex(MediaStore.Audio.Media.RELATIVE_PATH)
                    } else {
                        -1
                    }
                    while (it.moveToNext()) {
                        val dataPath = dataColumn.takeIf { index -> index >= 0 }?.let(it::getString)
                        val displayName = nameColumn.takeIf { index -> index >= 0 }?.let(it::getString)
                        val relativePath = relativeColumn.takeIf { index -> index >= 0 }?.let(it::getString)
                        val reconstructedPath = pathFromRelativeColumns(
                            volumeName,
                            relativePath,
                            displayName,
                        )
                        val matchedPath = listOfNotNull(dataPath, reconstructedPath)
                            .firstOrNull { path -> isInSelectedFolders(path, folders) }
                            ?: continue
                        if (
                            !hasSupportedExtension(displayName, extensions) &&
                            !hasSupportedExtension(matchedPath, extensions)
                        ) {
                            continue
                        }

                        val mediaUri = ContentUris.withAppendedId(
                            collection,
                            it.getLong(idColumn),
                        )
                        try {
                            if (!canRead(mediaUri)) continue
                        } catch (_: java.io.FileNotFoundException) {
                            continue
                        }
                        val uriString = mediaUri.toString()
                        results.putIfAbsent(
                            uriString,
                            Arguments.createMap().apply {
                                putString("uri", uriString)
                                putString("displayName", displayName)
                                putString("sourcePath", matchedPath)
                            },
                        )
                    }
                }
            }

            val mediaFiles = Arguments.createArray()
            results.values.forEach(mediaFiles::pushMap)
            promise.resolve(mediaFiles)
        } catch (e: SecurityException) {
            promise.reject("MEDIA_STORE_PERMISSION_DENIED", e.message, e)
        } catch (e: Exception) {
            promise.reject("MEDIA_STORE_SCAN_FAILED", e.message, e)
        }
    }

    private fun setRetrieverDataSource(retriever: MediaMetadataRetriever, filePath: String) {
        val uri = Uri.parse(filePath)
        when {
            isContentUri(uri) -> retriever.setDataSource(reactApplicationContext, uri)
            uri.scheme.equals("file", ignoreCase = true) -> retriever.setDataSource(uri.path)
            else -> retriever.setDataSource(filePath)
        }
    }

    private fun basicMeta(retriever: MediaMetadataRetriever): WritableMap {
        return Arguments.createMap().apply {
            putString("duration", retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION))
            putString("bitrate", retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_BITRATE))
            putString("artist", retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ARTIST))
            putString("author", retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_AUTHOR))
            putString("album", retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ALBUM))
            putString("title", retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_TITLE))
            putString("date", retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DATE))
            putString("year", retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_YEAR))
        }
    }

    @ReactMethod
    fun getBasicMeta(filePath: String, promise: Promise) {
        val retriever = MediaMetadataRetriever()
        try {
            setRetrieverDataSource(retriever, filePath)
            promise.resolve(basicMeta(retriever))
        } catch (e: Exception) {
            promise.reject("MEDIA_META_READ_FAILED", e.message, e)
        } finally {
            try {
                retriever.release()
            } catch (_: Exception) {
            }
        }
    }

    @ReactMethod
    fun getMediaMeta(filePaths: ReadableArray, promise: Promise) {
        val metas = Arguments.createArray()
        for (i in 0 until filePaths.size()) {
            val retriever = MediaMetadataRetriever()
            try {
                val filePath = filePaths.getString(i)
                setRetrieverDataSource(retriever, filePath)
                metas.pushMap(basicMeta(retriever))
            } catch (_: Exception) {
                metas.pushNull()
            } finally {
                try {
                    retriever.release()
                } catch (_: Exception) {
                }
            }
        }
        promise.resolve(metas)
    }

    @ReactMethod
    fun getMediaCoverImg(filePath: String, promise: Promise) {
        val retriever = MediaMetadataRetriever()
        try {
            val pathHashCode = filePath.hashCode()
            if (pathHashCode == 0) {
                promise.resolve(null)
                return
            }

            val coverFile = File(reactContext.cacheDir, "image_manager_disk_cache/$pathHashCode.jpg")
            if (coverFile.exists()) {
                promise.resolve(coverFile.toURI().toString())
                return
            }

            setRetrieverDataSource(retriever, filePath)
            val coverImg = retriever.embeddedPicture
            if (coverImg != null) {
                val bitmap = BitmapFactory.decodeByteArray(coverImg, 0, coverImg.size)
                coverFile.parentFile?.mkdirs()
                FileOutputStream(coverFile).use { outputStream ->
                    bitmap.compress(Bitmap.CompressFormat.JPEG, 100, outputStream)
                    outputStream.flush()
                }
                promise.resolve(coverFile.toURI().toString())
            } else {
                promise.resolve(null)
            }
        } catch (e: Exception) {
            promise.reject("MEDIA_COVER_READ_FAILED", e.message, e)
        } finally {
            try {
                retriever.release()
            } catch (_: Exception) {
            }
        }
    }

    private fun localFile(filePath: String): File {
        val uri = Uri.parse(filePath)
        return if (uri.scheme.equals("file", ignoreCase = true)) {
            File(uri.path ?: filePath)
        } else {
            File(filePath)
        }
    }

    private fun contentDisplayName(uri: Uri): String? {
        return reactApplicationContext.contentResolver.query(
            uri,
            arrayOf(OpenableColumns.DISPLAY_NAME),
            null,
            null,
            null,
        )?.use { cursor ->
            val column = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
            if (column >= 0 && cursor.moveToFirst()) cursor.getString(column) else null
        }
    }

    private fun <T> withReadableAudioFile(filePath: String, action: (File) -> T): T {
        val uri = Uri.parse(filePath)
        if (!isContentUri(uri)) {
            return action(localFile(filePath))
        }

        val displayName = contentDisplayName(uri).orEmpty()
        val extension = displayName.substringAfterLast('.', "mp3")
            .takeIf { it.matches(Regex("[A-Za-z0-9]{1,8}")) }
            ?: "mp3"
        val temporaryFile = File.createTempFile("content-audio-", ".$extension", reactContext.cacheDir)
        try {
            val input = reactApplicationContext.contentResolver.openInputStream(uri)
                ?: throw IOException("Cannot open content URI")
            input.use { source ->
                temporaryFile.outputStream().use { target -> source.copyTo(target) }
            }
            return action(temporaryFile)
        } finally {
            temporaryFile.delete()
        }
    }

    @ReactMethod
    fun getLyric(filePath: String, promise: Promise) {
        try {
            val lyric = withReadableAudioFile(filePath) { file ->
                if (!file.exists()) throw IOException("File not found")
                AudioFileIO.read(file).tag.getFirst(FieldKey.LYRICS)
            }
            promise.resolve(lyric)
        } catch (e: Exception) {
            promise.reject("MEDIA_LYRIC_READ_FAILED", e.message, e)
        }
    }

    @ReactMethod
    fun setMediaTag(filePath: String, meta: ReadableMap, promise: Promise) {
        try {
            val file = localFile(filePath)
            if (isContentUri(Uri.parse(filePath))) {
                throw IOException("Writing tags through a content URI is not supported")
            }
            if (file.exists()) {
                val audioFile = AudioFileIO.read(file)
                val tag = audioFile.tag
                meta.getString("title")?.let { tag.setField(FieldKey.TITLE, it) }
                meta.getString("artist")?.let { tag.setField(FieldKey.ARTIST, it) }
                meta.getString("album")?.let { tag.setField(FieldKey.ALBUM, it) }
                meta.getString("lyric")?.let { tag.setField(FieldKey.LYRICS, it) }
                meta.getString("comment")?.let { tag.setField(FieldKey.COMMENT, it) }
                audioFile.commit()
                promise.resolve(true)
            } else {
                promise.reject("Error", "File Not Exist")
            }
        } catch (e: Exception) {
            promise.reject("Error", e.message, e)
        }
    }

    @ReactMethod
    fun getMediaTag(filePath: String, promise: Promise) {
        try {
            val properties = withReadableAudioFile(filePath) { file ->
                if (!file.exists()) throw IOException("File not found")
                val tag = AudioFileIO.read(file).tag
                Arguments.createMap().apply {
                    putString("title", tag.getFirst(FieldKey.TITLE))
                    putString("artist", tag.getFirst(FieldKey.ARTIST))
                    putString("album", tag.getFirst(FieldKey.ALBUM))
                    putString("lyric", tag.getFirst(FieldKey.LYRICS))
                    putString("comment", tag.getFirst(FieldKey.COMMENT))
                }
            }
            promise.resolve(properties)
        } catch (e: Exception) {
            promise.reject("Error", e.message, e)
        }
    }
}
