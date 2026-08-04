# EchoMusic · 畅听

一个面向 Android 的插件化、可定制、无广告音乐播放器。

[![Android CI](https://github.com/Panini235/EchoMusic/actions/workflows/android-ci.yml/badge.svg)](https://github.com/Panini235/EchoMusic/actions/workflows/android-ci.yml)
[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-blue.svg)](./LICENSE)
[![Platform: Android](https://img.shields.io/badge/Platform-Android-3DDC84.svg)](https://www.android.com/)

EchoMusic 在保留 MusicFree 插件生态与播放器能力的基础上，重新设计了首页、
侧边栏、播放页和常用交互。项目更关注舒适的视觉层级、自然的动画、克制的
毛玻璃效果以及中低端设备上的运行体验。

> [!NOTE]
> EchoMusic 仍在持续开发。升级前建议备份歌单和配置；不同插件的可用性取决于
> 插件自身及对应第三方服务，并不由 EchoMusic 保证。

## 主要特色

- **兼容 MusicFree 插件**：支持通过插件完成音乐、专辑和作者搜索，以及歌词、
  歌单等内容的获取。
- **现代化界面**：重新设计首页、抽屉导航、列表、设置页与播放页，兼顾浅色、
  深色主题和不同尺寸的 Android 屏幕。
- **轻量动效**：使用短时、低干扰的过渡动画，并遵循系统的“减少动态效果”设置。
- **克制的毛玻璃效果**：仅在关键层级使用半透明和模糊材质，避免持续高负载渲染。
- **本地音乐管理**：支持本地歌曲、歌单、播放历史、歌词和下载管理。
- **应用本身无广告**：不植入广告，也不内置任何第三方平台音源。
- **数据以本地存储为主**：播放器配置和歌单保存在设备本地；安装的插件可能根据
  其实现访问网络，请在安装前自行检查来源与代码。

## 下载与安装

EchoMusic 当前通过 GitHub Actions 提供 Android APK，不要求普通用户自行安装
Android SDK。

1. 打开 [Android CI](https://github.com/Panini235/EchoMusic/actions/workflows/android-ci.yml)。
2. 选择带有绿色对勾的最新构建。
3. 在运行页面底部下载 `EchoMusic-standalone-*` 构建产物。
4. 解压下载的 ZIP 文件并安装其中的 APK。

GitHub Actions 构建产物保留 14 天。安装 APK 时，Android 可能要求授权当前浏览器
或文件管理器“安装未知应用”。请确认下载来源确实为本仓库后再继续安装。

## 插件使用

EchoMusic 只是播放器框架，**不会内置 Bilibili、抖音、网易云音乐、QQ 音乐、
喜马拉雅等平台的音源**。你可以安装合法来源的 MusicFree 兼容插件，或者按照
插件协议开发仅供自己使用的插件。

安装入口：

1. 打开侧边栏并进入“设置”。
2. 选择“插件设置”。
3. 从本地文件或网络地址安装 `.js` 插件或 `.json` 插件订阅。
4. 检查插件信息并启用需要使用的音源。

插件开发请参阅
[MusicFree 插件开发文档](https://musicfree.catcat.work/plugin/introduction.html)。

> [!WARNING]
> 插件可以发起网络请求并处理设备中的播放器数据。请勿安装来历不明、经过混淆
> 且无法审查，或声称可以绕过付费、会员和版权限制的插件。

## GitHub Workflow 构建

仓库的 Android 构建全部由
[`.github/workflows/android-ci.yml`](./.github/workflows/android-ci.yml) 完成。Workflow
会在干净的 Ubuntu 环境中依次安装依赖、执行 TypeScript 检查和测试、构建
Release APK，并上传可独立安装的产物。

| 触发方式 | 行为 |
| --- | --- |
| 推送到 `main` 或 `agent/**` | 自动验证并构建 APK |
| 提交面向 `main` 的 Pull Request | 自动验证并构建 APK |
| 推送任意 Tag | 自动验证并构建 APK |
| Actions 页面选择 `Run workflow` | 手动验证并构建 APK |

发布 Tag 示例：

```bash
git tag v0.6.2
git push origin v0.6.2
```

手动构建时，进入 Android CI 页面，点击 **Run workflow** 并选择需要构建的分支。
成功产物命名为 `EchoMusic-standalone-<运行序号>`。

当前 Workflow 使用 Node.js 20、Java 17 和 Gradle 缓存。React Native/Android 的
原生依赖下载与 Release 编译通常是最耗时的部分；首次构建或缓存未命中时可能需要
更长时间。

## 开发环境

项目基于 React Native，建议使用 Node.js 20。提交更改前至少执行：

```bash
npm install --no-audit --no-fund
npx tsc --noEmit
npm test -- --runInBand --passWithNoTests
```

正式 APK 请通过仓库的 GitHub Workflow 构建，以保持构建环境和产物一致。

## 打包与二次分发

> [!IMPORTANT]
> 1. 打包、二次分发 **请保留代码出处**：
>    [maotoumao/MusicFree](https://github.com/maotoumao/MusicFree)
> 2. 请不要用于商业用途，合法合规使用代码。
> 3. 如果开源协议变更，将在此 GitHub 仓库更新，不另行通知。

打包、修改或二次分发时，还应当：

- 遵守 [GNU AGPL-3.0](./LICENSE) 及所使用依赖的许可证要求；
- 保留原项目和贡献者的版权、许可证及来源说明；
- 对外提供修改版本时，按照 AGPL-3.0 提供对应源代码和修改说明；
- 不得暗示修改版本获得 MusicFree 或 EchoMusic 原作者的官方认可；
- 不得捆绑来源不明、侵权或用于绕过第三方服务限制的音源插件。

## 上游项目与致谢

EchoMusic 基于
[maotoumao/MusicFree](https://github.com/maotoumao/MusicFree) 开发。播放器内核、
插件协议及多项基础能力来自 MusicFree 与其贡献者；EchoMusic 在此基础上进行了
品牌替换、界面重构、交互优化和构建流程调整。

EchoMusic 的名称、图标和界面仅用于区分本衍生版本，不代表 MusicFree 作者或
贡献者为本项目背书。感谢所有上游作者和开源贡献者。

## 开源协议

本项目沿用 [GNU Affero General Public License v3.0](./LICENSE)。使用、修改或分发
本项目代码前，请完整阅读许可证正文。仓库中引用的第三方库、字体、图标及其他资源
可能适用各自的许可证，相关权利归原作者所有。

## 合法使用声明

- 本项目仅提供播放器和插件运行能力，不提供、存储或维护任何第三方平台音源。
- 插件、插件服务及其产生的数据由插件提供者和使用者自行负责。
- 使用者应当遵守所在地法律法规、内容版权要求以及第三方平台的服务条款。
- 请勿使用本项目从事侵权、破解、绕过付费限制或其他违法违规活动。
- 本项目按现状提供，不承诺任意插件或第三方服务持续可用。

## 反馈与贡献

发现问题或希望改进功能，可以在
[Issues](https://github.com/Panini235/EchoMusic/issues) 中提交反馈。提交问题时，请尽量
附上 Android 版本、EchoMusic 构建序号、复现步骤和必要的日志；请勿公开账号凭据、
Cookie、Token 或其他敏感信息。

版本改动记录见 [changelog.md](./changelog.md)。
