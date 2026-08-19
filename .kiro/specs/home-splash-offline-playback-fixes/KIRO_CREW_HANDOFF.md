# Kiro Crew 修复交接说明

## 1. 原始目标

需要修复三类问题：

1. **首页布局**
   - 点击“我喜欢”后，偶发与下方四个快捷入口重叠。
   - 点击“推荐歌单 / 榜单 / 播放历史 / 本地音乐”时，文字偶发重影。
2. **启动画面**
   - 冷启动图标左右显示不完整。
3. **本地播放提前跳曲**
   - 离线、播放已完整下载文件、开启 45 分钟定时关闭时，歌曲可能在约 2 分钟提前切到下一曲。

## 2. 用户约束

后续处理必须遵守：

- 不运行本地构建。
- 不运行单元、集成、设备或概率测试。
- 不运行 TypeScript、lint 等本地验证。
- 不触发 GitHub Actions。
- 不修改 `.github/workflows/android-ci.yml`。
- 如果以后需要构建，只能由用户另行触发 GitHub Actions。
- 当前只做代码修改和静态调用链审查。
- 不添加“播放约 2 分钟”之类硬编码补丁。
- 不猜测性修改 downloader 或媒体解码器。
- 最终只能说明：**“闭合已识别不安全路径并完成防御性修复。”**
- 不能宣称真实设备问题已经 100% 消失。

## 3. 规格状态

规格目录：

```text
.kiro/specs/home-splash-offline-playback-fixes/
├── .config.kiro
├── bugfix.md
├── design.md
├── tasks.md
└── KIRO_CREW_HANDOFF.md
```

处理过程：

1. 最初创建了较重的 requirements/design/tasks。
2. 后来按用户要求删除了测试和构建验收要求。
3. `tasks.md` 当前有 8 个任务。
4. 任务 1、2 已勾选完成。
5. 任务 3 有中断的半成品改动，但尚未勾选。
6. 任务 4–8 未开始。
7. 用户已明确要求停止继续实现庞大的任务 4–8 架构，改为最小修复。

因此，Crew 不应机械执行原 `tasks.md` 中完整的 arbiter、诊断系统和 evidence ledger 设计，应按本文“最小收敛方案”实施。

## 4. 已完成：任务 1 首页修复

### 4.1 已做改动

竖屏首页已从双重纵向所有权：

```text
纵向 ScrollView
  └── 无确定高度的纵向 FlashList
      └── Operations sibling
```

改成单一根 `FlashList`：

```text
FlashList
├── ListHeaderComponent
│   ├── ContinueListening
│   ├── RecentlyPlayed
│   └── SheetSectionHeader
├── data / SheetRow
└── ListFooterComponent / Operations
```

具体修复：

- 竖屏首页只有一个纵向布局所有者。
- 页面顺序保持“继续聆听 → 最近播放 → 常用歌单 → 快捷入口”。
- 歌单 key 改为 `${sheet.platform ?? localPluginPlatform}:${sheet.id}`。
- 快捷入口 key 使用固定 action id，不再使用翻译文字或 index。
- `ActionButton` 收敛为一个按压容器和一个 `ThemeText`。
- 删除了承载文字的 `FadeInDown` 动画层。
- 按压只改变 opacity/background，不再改变文字层或布局几何。
- 四个快捷按钮使用 `flex: 1` 和 `minWidth: 0`。
- 新增首页导航门闩 `useHomeNavigationLatch.ts`。
- “我喜欢”和四个快捷入口经过同一个 focus/transition latch。
- latch 在导航前同步锁定，页面失焦期间保持锁定，返回首页重新 focus 后解锁。
- 没有使用时间 debounce。
- 横屏页面保持原结构，仅把快捷入口 key 改成固定 action id。
- 原 route、params 和 back 行为保持不变。

### 4.2 修改文件

```text
src/pages/home/components/homeBody/index.tsx
src/pages/home/components/homeBody/sheets.tsx
src/pages/home/components/homeBody/operations.tsx
src/pages/home/components/ActionButton.tsx
src/pages/home/components/homeBodyHorizontal/operations.tsx
src/pages/home/hooks/useHomeNavigationLatch.ts
```

### 4.3 注意事项

- `sheets.tsx` 原文件使用 CRLF，曾出现仅换行符或 trailing-whitespace 相关 diff。
- 不要为此大面积改写文件换行符。
- 该部分没有运行时验证。

## 5. 已完成：任务 2 启动画面修复

### 5.1 已确认的直接根因

原系统启动图标资源对品牌主路径执行：

```xml
trimPathEnd: 0.08 -> 1
```

因此动画开始和中间帧本来就只绘制部分路径。这是唯一由静态资源直接确认的根因。

### 5.2 Android 系统 Splash 改动

新增：

```text
android/app/src/main/res/drawable/echomusic_splash_icon.xml
```

特性：

- 使用完整品牌几何。
- `108 × 108` viewport。
- 围绕 `(54,54)` 使用 `0.75` 等比缩放。
- 四边有明确正安全距离。
- 不再使用 `trimPath`、clip 或 mask。

`styles.xml` 改为直接引用：

```xml
<item name="windowSplashScreenAnimatedIcon">@drawable/echomusic_splash_icon</item>
```

删除：

```text
android/app/src/main/res/drawable/echomusic_splash_animated.xml
android/app/src/main/res/animator/echomusic_splash_trace.xml
```

### 5.3 应用内启动层改动

`BootstrapComponent.tsx` 已调整：

- 只保留一个品牌 `Image`。
- 显式使用 `resizeMode="contain"`。
- 图标内容、阴影和圆角背景分层。
- 品牌内容层不使用裁切圆角或 `overflow: hidden`。
- 保留 `pointerEvents="none"`、1200ms 上限、260ms 淡出、原背景和启动文案，以及 reduced-motion 语义。

### 5.4 启动交接

新增：

```text
src/entry/bootstrap/launchHandoff.ts
```

状态只能向前：

```text
SYSTEM -> APP_SURFACE -> HOME
```

并且：

- `SplashScreen.hideAsync()` 只由该 owner 调用。
- 原生 Splash 只隐藏一次。
- 应用启动层退出后不能重新显示。

### 5.5 修改和删除文件

修改/新增：

```text
android/app/src/main/res/values/styles.xml
android/app/src/main/res/drawable/echomusic_splash_icon.xml
src/entry/bootstrap/BootstrapComponent.tsx
src/entry/bootstrap/bootstrap.ts
src/entry/bootstrap/launchHandoff.ts
```

删除：

```text
android/app/src/main/res/drawable/echomusic_splash_animated.xml
android/app/src/main/res/animator/echomusic_splash_trace.xml
```

保持未变：

- launcher 图标
- 通知图标
- `MainActivity`
- GitHub Actions workflow

## 6. 播放器问题的静态调查结论

### 6.1 本地文件优先存在旁路

`PluginMethodsWrapper.getMediaSource` 在插件实例可用时会先检查本地文件。

但 `TrackPlayer.play` 会先尝试取得插件。如果插件缺失或不可用，可能绕过 wrapper 的本地文件检查，直接回退到：

```ts
musicItem.source
musicItem.url
```

因此“已完整下载但离线”时，顶层并不能保证一定使用本地 URI。

### 6.2 Sentinel 被直接当作自然结束

当前原生队列结构为：

```text
[ContentTrack, EndSentinel]
```

`PlaybackActiveTrackChanged` 检测到：

```text
lastIndex = 0
index = 1
fake sentinel URL
```

就直接发出 `PlayEnd`，随后单曲重播或调用 `skipToNext`。

问题是没有同时校验：

- 最后播放位置
- 当前歌曲时长
- 事件是否来自当前播放请求
- 是否只是 `setQueue` 造成的 active-track 副作用

这是最可能导致提前跳曲的静态不安全路径之一。

### 6.3 延迟错误可能影响下一首

`PlaybackError` 到达后，当前代码可能：

1. 事后读取 active track。
2. 进入 `handlePlayFail`。
3. 延迟约 500ms。
4. 直接调用 `skipToNext`。

延迟结束时，当前歌曲可能已经变化，因此上一首歌曲的旧错误可能推进新歌曲。

### 6.4 45 分钟计时器没有直接“约 2 分钟 next”路径

静态代码中没有发现“45 分钟计时器 → 约 2 分钟 → skipToNext”的直接路径，因此不要宣称计时器是直接根因。

但定时关闭本身存在生命周期问题：

- 缺少 schedule token。
- 回调执行时没有再次检查 deadline。
- 重设或取消时，旧回调/旧 listener 的所有权不够明确。
- “当前歌曲播放完成后关闭”使用长期 `PlayEnd` listener。

这些路径需要最小修复，但不能写成已确认的 2 分钟跳曲根因。

### 6.5 `setQueue` 可能产生重复或乱序 active-track 事件

项目代码已有相关注释。proposed source、真实 source、换音质等都可能替换原生队列，因此 Sentinel 事件不能单独作为自然结束证据。

## 7. 任务 3 当前半成品状态

此前被中断的实现已经在工作区留下部分改动。已知存在：

```text
src/core/trackPlayer/playbackSession.ts
src/core/trackPlayer/localPlaybackSource.ts
```

并可能修改了：

```text
src/core/trackPlayer/index.ts
src/core/pluginManager/plugin.ts
src/core.defination/trackPlayer/index.ts
src/types/core/trackPlayer/index.d.ts
```

根据最后一次已完成的静态检查：

- 唯一 `ReactNativeTrackPlayer.setQueue` 当时已初步集中到 `applyNativeSource`。
- downloader 和 codec 没有修改。
- 内部 track tag 需要改成原生层能稳定往返的字符串字段。
- source fallback 分支可能覆盖已选择的 stored/local source。
- 部分最终 `await` 后缺少 freshness 检查。
- 恢复和异常分支没有完全收敛。
- 类型文件可能存在仅由换行符造成的大 diff。
- 未运行 typecheck，因此不能假设当前半成品可编译。

重要：最后一次 `git status/diff` 和 context-gatherer 调用被中断。Crew 开始工作时必须先重新读取当前工作树，不能仅依赖以上描述。

## 8. 用户已批准的最小收敛方案

不要继续实现原设计中的完整：

- `TransitionArbiter`
- `TransitionExecutor`
- 全量 typed reason 迁移
- 所有 UI 调用方改造
- 结构化诊断系统
- evidence ledger
- 测试或设备验收矩阵

只完成以下四个补丁。

### 补丁 A：本地文件必须在插件之前解析

目标调用链：

```text
play request
  -> resolve valid local source
  -> 如果存在：直接使用 local URI
  -> 如果不存在：进入原 plugin/cache/network fallback
```

最小检查：

- URI 可规范化。
- 文件存在。
- 文件可读。
- size > 0。
- `file://` 不重复添加 scheme。
- `content://` 保持原 URI。
- 插件缺失也不能绕过本地文件。

保持：

- 无有效本地文件时的现有 fallback 顺序。
- downloader、导入、删除、本地音乐清单不变。
- 不强制联网。

`localPlaybackSource.ts` 如果实现简洁可以保留；如果已经变成大型抽象，应删除并在 TrackPlayer 附近保留一个小 resolver。

### 补丁 B：轻量 generation 防止旧异步结果生效

不需要完整 session/arbiter。可使用模块级单调 generation：

```ts
let playGeneration = 0;

function beginPlayRequest() {
    return ++playGeneration;
}

function isCurrentGeneration(generation: number) {
    return generation === playGeneration;
}
```

每个新的逻辑播放请求取得 generation：

```ts
const generation = beginPlayRequest();
```

每次异步解析后，在执行 `setQueue`、当前歌曲状态写入、换音质/换源或延迟错误恢复前检查：

```ts
if (!isCurrentGeneration(generation)) {
    return;
}
```

暂停、恢复、seek 不应创建新的逻辑 generation。

如果 `playbackSession.ts` 仅为这四个补丁服务，可以缩减为轻量 generation helper；不需要保留 terminal reservation、完整 candidate、diagnostics 等字段。

### 补丁 C：Sentinel 必须结合位置和时长判断

不要再使用 `Content -> Sentinel` 作为充分结束条件。

接受自然结束至少要求：

```text
当前事件仍属于当前 generation
AND 最后位置接近可信时长
AND 时长为正有限值
```

建议容差：

```ts
Math.max(5, duration * 0.02)
```

判断形式：

```ts
duration > 0 &&
position >= duration - Math.max(5, duration * 0.02)
```

如果 Sentinel 在明显早于结束时激活：

- 不得调用业务 `skipToNext`。
- 不得发出 accepted `PlayEnd`。
- 应恢复/保持当前 Content track。
- 恢复需要一次性保护，防止无限循环。
- 最小方案可记录当前 generation 是否已做过一次早结束恢复。

合法自然结束继续保持原有 QUEUE、SINGLE、SHUFFLE 目标选择逻辑。

### 补丁 D：定时关闭 token、deadline 和 listener 清理

维护轻量 token：

```ts
let scheduleToken = 0;
```

每次设置、替换或取消都递增 token，并清除：

- 旧 timeout
- 旧 after-current listener

回调捕获 token，执行时重新检查：

```ts
capturedToken === scheduleToken
Date.now() >= deadline
计划仍未取消
```

如果 callback 提前：

- 重新按剩余时间安排。
- 不暂停、不 reset、不退出、不切歌。

“当前歌曲播放完成后关闭”：

- listener 必须可 unsubscribe。
- 设置新计划或取消时移除旧 listener。
- listener 回调时再次校验 token 和 deadline。
- 只消费一次。
- 不调用普通下一曲。

保持原有 10/20/30/45/60 分钟、自定义时间、立即关闭、当前歌曲播放结束后关闭和取消定时语义。

## 9. 需要删除或避免的冗余代码

### 9.1 应删除或缩减

- 未接通的完整 `playbackSession` 状态机字段。
- terminal reservation、candidate、arbiter 等未被最小补丁使用的结构。
- 尚未使用的大范围类型定义。
- 为未来任务预留但当前没有调用者的函数。
- 仅用于复杂诊断系统的字段和接口。
- 仅由换行符造成的整文件 diff。
- 未完成且可能覆盖现有 source 的 fallback 重写。

### 9.2 不要创建

```text
playbackTransition.ts
playbackDiagnostics.ts
完整 TransitionArbiter
全量 typed UI origin 迁移
远程遥测
新的测试 harness
```

### 9.3 建议保留

- 简洁的 `localPlaybackSource.ts`，如果它只负责 URI 规范化和文件有效性检查。
- 简洁的 generation helper，放在 TrackPlayer 模块内或一个很小的文件中。
- `applyNativeSource`，如果它确实是唯一 `setQueue` 入口且逻辑清晰。
- 已完成的首页和启动页修复。

## 10. 最终静态搜索清单

完成四个补丁后，静态搜索：

```text
skipToNext(
skipToPrevious(
PlaybackActiveTrackChanged
PlaybackError
handlePlayFail
TrackPlayerEvents.PlayEnd
RNTrackPlayer.setQueue
RNTrackPlayer.skip
RNTrackPlayer.reset
setCurrentMusic
scheduleClose
setTimeout
TrackPlayer.on
```

需要确认：

1. 自动 `skipToNext` 只有充分自然结束证据、当前 generation 的真实错误策略或合法显式控制。
2. 原始 Sentinel 事件不能直接 `PlayEnd` 或 next。
3. 旧错误不能影响新 generation。
4. 所有 source resolve 的异步结果应用前检查 generation。
5. 本地文件检查早于插件取得和网络解析。
6. 唯一 `setQueue` 入口不会被旧 generation 调用。
7. 定时器旧 timeout/listener 没有 pause/reset/exit/next 权限。
8. 未到 deadline 的回调没有播放副作用。
9. 没有新增 downloader、codec 或 workflow 修改。

## 11. 必须保持的既有行为

### 首页

- 路由和参数不变。
- 横屏结构不变。
- 首页信息顺序不变。
- 返回行为不变。

### 启动页

- 品牌图形和颜色不变。
- 启动背景和文案不变。
- `pointerEvents="none"`。
- launcher、通知图标不变。

### 播放器

- 无本地文件时 fallback 不变。
- 暂停、恢复、seek、rate 不变。
- QUEUE/SINGLE/SHUFFLE 不变。
- 当前歌曲真实错误仍遵循 `basic.autoStopWhenError`。
- 用户和系统显式上一曲/下一曲行为不变。
- 队列添加、移除、替换行为不变。
- 定时关闭模式和 deadline 语义不变。

## 12. 当前任务状态

原 `tasks.md`：

```text
[x] 任务 1：首页
[x] 任务 2：启动页
[ ] 任务 3：播放器 session/local source
[ ] 任务 4：完整 transition arbiter
[ ] 任务 5：错误/显式控制/队列原因
[ ] 任务 6：schedule token
[ ] 任务 7：诊断
[ ] 任务 8：evidence ledger
```

用户后来批准的新收敛任务列表：

```text
[ ] 1. 审查当前 git diff 与播放器调用链
[ ] 2. 清理任务 3 冗余抽象
[ ] 3. 实现本地文件优先和 generation 校验
[ ] 4. 修复自然结束误判和定时关闭生命周期
[ ] 5. 静态搜索自动切歌旁路并审查最终 diff
```

上面 5 项尚未完成，因为开始审查时工具调用被中断。

## 13. 当前验证和 Git 状态说明

已知：

- 没有运行测试。
- 没有运行 typecheck。
- 没有运行 lint。
- 没有本地构建。
- 没有生成 APK。
- 没有触发 GitHub Actions。
- 没有主动修改 `.github/workflows/android-ci.yml`。
- 没有创建 commit。

未知：

- 最后一次工具调用被中断，因此最新 `git status` 和完整 diff 必须重新检查。
- 任务 3 半成品是否能编译未知。
- 首页和启动页仅完成静态审查，没有真实设备验证。

## 14. Kiro Crew 执行指令

```text
请接管 home-splash-offline-playback-fixes 当前工作树。

先读取：
- .kiro/specs/home-splash-offline-playback-fixes/bugfix.md
- design.md
- tasks.md
- KIRO_CREW_HANDOFF.md
- 当前 git status 和完整 diff

保留已完成的任务 1 首页修复和任务 2 启动页修复。

任务 3 存在被中断的半成品。不要继续原设计中的完整
TransitionArbiter、TransitionExecutor、结构化诊断、全 UI typed
reason 迁移或 evidence ledger。

请先清理任务 3 的冗余代码，然后只完成四个最小补丁：
1. 完整本地文件在插件/缓存/网络解析前优先使用。
2. 使用轻量单调 generation，阻止旧异步音源结果和旧延迟错误影响新歌曲。
3. Content→Sentinel 只有在当前 generation 且 position 接近可信 duration
   时才接受为自然结束；提前 Sentinel 不得 next，并做一次有界同曲恢复。
4. 定时关闭在 set/replace/cancel 时递增 token、清理 timeout/listener，
   callback 执行时复核 token 和 deadline，after-current listener 一次性消费。

保持现有 fallback、QUEUE/SINGLE/SHUFFLE、真实错误配置、显式控制、
队列编辑和定时关闭产品语义。不要修改 downloader、codec 或 GitHub
Actions，不要添加约 2 分钟硬编码。

用户要求不运行测试、typecheck、lint、本地构建或 GitHub Actions。
只执行源码、调用链、资源引用、写入口和 git diff 静态审查。

最终搜索全部 skipToNext、PlayEnd、PlaybackError、setQueue、reset、
setCurrentMusic 和 schedule listener 调用点，确认没有绕过四个保护的自动切歌路径。

最终结论只能是：
“闭合已识别不安全路径并完成防御性修复。”
不得声称真实设备现象已百分之百消失。
```
