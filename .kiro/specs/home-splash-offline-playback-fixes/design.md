# Home Splash Offline Playback Fixes Bugfix Design

## Overview

本设计同时处理三个独立缺陷域，但不把它们归并为同一根因：

1. 竖屏首页点击默认“我喜欢”歌单或四个快捷入口时，用户报告偶发区块重叠、文字重影或转场残留。
2. Android 冷启动的系统启动画面或应用内启动承接画面中，品牌图标可能不完整；其中系统资源对品牌主路径执行 `trimPathEnd: 0.08 -> 1` 是已确认的实现缺陷。
3. 离线播放完整本地文件并启用 45 分钟定时关闭时，用户报告当前歌曲可能在自然结束前约 2 分钟概率性切换到下一曲。

修复以静态可证明的不变量为目标：首页由单一竖向布局所有者管理相关内容，列表项使用稳定业务 key，每个入口只有一个文本层且导航具有焦点/转场门闩；系统与应用内启动阶段始终承载完整品牌几何，并通过单向状态完成承接；完整本地文件在其他音源之前解析，所有可能改变逻辑曲目或结束播放的入口统一携带 `session`、`generation`、`source revision`、明确来源和幂等标识进入同一 transition arbiter。

本阶段只更新设计文档，不修改业务代码。本规格的实现完成证据仅来自完整代码结构、资源引用、入口、调用链、写入口和静态差分审查。这里没有执行型测试、设备验收或概率复现，也不要求先在未修复 APK 上探索。本次不本地构建、不触发 GitHub Actions，也不把构建、类型检查、APK 或 workflow 结果作为完成条件。用户未来若另行要求构建，只能使用现有 GitHub Actions workflow，但该未来行为不属于本设计的实施或完成范围。

静态审查不用于证明真实设备现象百分之百消失。最终允许记录的结论仅为：**“闭合已识别不安全路径并完成防御性修复”**。设备合成器、特定媒体解码器、下载文件内部完整性和仅在真实运行时出现的竞态保留为剩余风险。

### Design Principles

- **事实与候选根因分离**：`trimPath` 是已确认缺陷；首页嵌套布局/合成路径和播放事件竞态是静态可见的不安全风险，但不是设备现象的唯一已证实根因。
- **单一所有者**：竖屏首页垂直布局、启动交接状态、播放 transition 决定分别只有一个写入所有者。
- **先归属、后决策**：异步音源结果、播放器事件、错误、队列变化、显式命令和定时器回调必须先关联当前会话，再产生决定。
- **自动事件从严、显式语义保持**：自动推进必须提供充分证据；用户、系统媒体控制和合法队列编辑不需要伪造自然结束证据。
- **无时间常数猜测补丁**：约 2 分钟只是现象描述，不作为条件、阈值或特殊分支。
- **防御性而非猜测性扩张**：本次建立来源优先级、事件归属和仲裁边界，不更换媒体解码器，不推测性重写下载器。
- **本地且脱敏的诊断**：结构化记录复用现有本地日志/用户主动导出边界，不新增远程遥测，不记录完整路径、凭据或原始插件对象。

## Glossary

- **Bug_Condition (C)**：触发缺陷的输入集合，是首页交互、冷启动显示和离线本地播放三个子条件的并集。
- **Property (P)**：当输入属于 Bug_Condition 时，修复后结果必须满足的正确行为。
- **Preservation**：当输入不属于 Bug_Condition 时，修复前后可观察行为保持等价。
- **F / F'**：分别表示修复前与修复后的实现。
- **Portrait_Layout_Owner**：竖屏首页唯一负责垂直测量、虚拟化和滚动的列表；相关 header、歌单行与 footer 均处于其正常布局流。
- **Stable_Business_Key**：由条目的稳定业务标识组成；歌单使用 `platform + id`，快捷入口使用固定 action id/route，均与翻译文本、渲染索引和回收位置无关。
- **Single_Text_Layer**：一个入口在 React/native 可达树中只有一个承载标签字形的文本节点，动画不复制或快照该节点。
- **Home_Navigation_Latch**：与首页 focus/离开转场绑定的一次性导航门闩；一次被接受的交互只提交一次原路由，返回首页重新获得 focus 后解锁。
- **System_Splash**：React 内容可见前由 Android/Expo splash 主题绘制的系统启动画面。
- **App_Launch_Surface**：`BootstrapComponent` 在 React 根树上方显示的应用内启动承接层。
- **Logo_Content_Bounds**：品牌完整矢量路径或非透明像素的包围盒，包括 stroke 外沿，不包括专用透明安全边距。
- **Monotonic_Handoff**：启动状态仅允许 `SYSTEM -> APP_SURFACE -> HOME` 前进，不能反向恢复已退出层，也不能并行创建第二个应用内品牌层。
- **Complete_Local_File**：本地 URI 可规范化，目标存在、可读、大小大于零，并有可归属于当前会话的可信媒体时长；这不等同于已证明容器或编码内容内部无损。
- **Playback_Session**：一次逻辑曲目播放实例；选择新曲或重新开始同一曲创建新 session，暂停/恢复和同会话 seek 不创建新 session。
- **Session_ID**：播放实例唯一标识。
- **Generation**：进程内单调递增的播放请求代数，用于区分同一曲目标识的旧请求和新请求。
- **Source_Revision**：同一 session 内每次写入或替换原生音源队列时递增的版本，用于区分 proposed、真实本地/远程源和换音质产生的事件。
- **Session_Tuple**：`{sessionId, generation, sourceRevision, trackKey}` 的组合；异步结果和自动事件只有与当前 tuple 匹配才可生效。
- **Content_Track**：原生队列中承载当前逻辑音频的内容项。
- **End_Sentinel**：现有原生两项队列中的假下一曲标记；其激活只构成结束候选，不能单独证明自然结束。
- **Trusted_Duration**：在 session 创建或当前 source revision 生效时捕获的正有限时长，来源和 revision 可追踪；冲突或缺失时不得接受自然结束。
- **Transition_Candidate**：由显式控制、队列变化、active-track/state/end、错误、音源失败或定时器生成的规范化候选。
- **Transition_Arbiter**：验证候选归属、证据、原因和幂等性的唯一决策边界。
- **Transition_Executor**：唯一允许提交逻辑曲目变化、自然结束后的循环选择、错误策略或 stop/exit 的写入点。
- **Transition_Reason**：最终决定的唯一分类，例如 `NATURAL_END`、`PLAYBACK_ERROR_POLICY`、`USER_NEXT`、`REMOTE_NEXT`、`QUEUE_CHANGE`、`TIMER_EXPIRED_STOP`；`UNKNOWN` 只能被拒绝或用于保持/恢复当前曲目。
- **Idempotency_Key**：同一命令、事件或终止决定的稳定去重标识。
- **Schedule_Token**：每次设置、替换或取消定时关闭时生成的新代数；旧 token 回调不得产生播放作用。
- **Absolute_Deadline**：定时关闭的绝对 wall-clock 到期时间；回调执行时必须重新读取当前时间和当前计划。
- **Monotonic_Sequence**：进程内递增的诊断序号，用于关联异步事件先后，不受系统 wall clock 调整影响。

## Bug Details

### Verified Implementation Facts

以下事实可由当前工作区静态确认。除明确标为已确认缺陷的 `trimPath` 外，它们只说明不安全路径存在，不证明其是用户设备现象的唯一根因。

#### Home layout, identity, text, and navigation

- `src/pages/home/components/homeBody/index.tsx` 使用纵向 `ScrollView` 顺序渲染 `ContinueListening`、`RecentlyPlayed`、`Sheets`、`Operations`。
- `src/pages/home/components/homeBody/sheets.tsx` 在该纵向容器中再次渲染同轴 `FlashList`，使用 `nestedScrollEnabled`，但没有列表级 `keyExtractor`；`renderItem` 返回节点上的 `key` 不能建立 FlashList 自己的稳定回收 identity。
- 默认“我喜欢”歌单通过 `ListItem` 导航到既有 `LOCAL_SHEET_DETAIL`，路由参数为歌单 id；四个快捷入口分别导航到既有推荐歌单、榜单、播放历史和本地音乐路由。
- `src/pages/home/components/ActionButton.tsx` 的业务树当前只创建一个 `ThemeText`，但该文本处于 `FadeInDown` 的 `Animated.View` 与 gesture-handler `TouchableOpacity` 合成路径中。
- `src/core/router/index.ts` 的 `useNavigate` 直接调用 `navigation.navigate`，没有首页 focus/转场范围的重复提交门闩。
- `src/pages/home/index.tsx` 明确区分竖屏 `HomeBody` 与横屏 `HomeBodyHorizontal`；竖屏修复不得意外重写横屏信息结构。

#### System and in-app launch surfaces

- `AndroidManifest.xml` 将 `MainActivity` 主题设置为 `Theme.App.SplashScreen`，`MainActivity.kt` 注册 `SplashScreenManager`。
- `styles.xml` 的 `windowSplashScreenAnimatedIcon` 指向 `echomusic_splash_animated.xml`，后者对 `echomusic_icon_foreground.xml` 中名为 `infinity` 的品牌主路径应用 `echomusic_splash_trace.xml`。
- `echomusic_splash_trace.xml` 将 `trimPathEnd` 从 `0.08` 动画到 `1`，因此系统启动画面的起始与中间状态必然缺少品牌主路径的一部分。这是已确认实现缺陷。
- `BootstrapComponent.tsx` 使用一个 `Image` 显示完整 `logo.png`，但未显式声明 `resizeMode="contain"` 或独立安全内边距；shadow、圆角和内容目前处于同一尺寸容器。
- 应用内承接层最长显示 1200ms，使用 260ms 淡出并设置 `pointerEvents="none"`；这些非阻塞语义必须保留。
- `bootstrap.ts` 使用 `nativeSplashHidden` 保证原生 hide 幂等，但原生隐藏与应用内完整品牌 surface 的 ready 状态之间没有显式单向 owner。

#### Local source, player events, queues, and schedule close

- `PluginMethodsWrapper.getMediaSource` 在插件已取得并挂载后先检查 `getLocalPath`，存在时返回本地 URI，再进入缓存、替代插件与网络解析。
- `TrackPlayer.play` 先按 `musicItem.platform` 获取插件；插件缺失或不可用时，可能绕过上述本地分支并回退到 `musicItem.source` 或 `musicItem.url`。
- 当前本地检查主要依赖 `exists`，没有在 TrackPlayer 顶层统一确认 URI 规范化、可读性、正文件大小和当前 source revision。
- `setupTrackPlayer`、`play` 和 `changeQuality` 都可能异步解析音源并调用 `setQueue`；当前主要通过“是否仍是同一 media item”判断新鲜度，无法区分同一曲目的旧 generation。
- 原生队列使用 `[Content_Track, End_Sentinel]`。proposed source、真实 source 和换音质都会替换队列，并可能产生重复或乱序 active-track 事件。
- `PlaybackActiveTrackChanged` 当前只凭 `index === 1`、`lastIndex === 0` 和 fake URL 发出 `PlayEnd`，随后单曲重播或 `skipToNext`；未同时要求位置、可信时长、终止状态和 Session_Tuple。
- 当前未消费 `PlaybackState` 或 `PlaybackQueueEnded` 来组成同会话结束证据；`PlaybackProgressUpdated` 只持久化位置。
- `PlaybackError` 到达后再读取 active track，随后 `handlePlayFail` 延迟 500ms 并可能直接 `skipToNext`；延迟后没有重新校验原错误 session/revision，也没有同一错误幂等门闩。
- `play` 的 `INVALID_SOURCE` 分支也进入 `handlePlayFail`，构成第二个自动错误推进入口。
- 应用按钮、迷你播放器手势和 `RemoteNext/RemotePrevious` 最终调用没有来源参数的 `skipToNext/skipToPrevious`。
- `remove(current)`、`playWithReplacePlayList`、`clearPlayList` 和 `addNext` 可合法改变当前项或队列，但当前没有统一的 `QUEUE_CHANGE` 原因。
- `scheduleClose.ts` 的回调没有 schedule token，也没有在执行时重新确认 deadline；after-current 模式通过持久 `PlayEnd` listener 调用 `reset + exitApp`。
- deadline 前的现有定时器路径没有直接调用下一曲，因此当前静态证据不支持“45 分钟定时器在约 2 分钟直接切歌”这一结论。
- `trace("本地播放", localPath)` 和 `trace("获取音源成功", track)` 等调用可能记录完整本地路径、URI、headers 或原始对象。

### Bug Condition

令三个子条件为 `C_home(X)`、`C_splash(X)` 和 `C_playback(X)`：

\[
C(X) = C_{home}(X) \cup C_{splash}(X) \cup C_{playback}(X)
\]

**Formal Specification:**

```text
FUNCTION isHomeBugCondition(input)
  INPUT: input of type HomeInteractionInput
  OUTPUT: boolean

  RETURN input.orientation = PORTRAIT
    AND input.homeIsStable = true
    AND input.target IN {
          MY_FAVORITES,
          RECOMMENDED_PLAYLISTS,
          TOP_LIST,
          PLAY_HISTORY,
          LOCAL_MUSIC
        }
    AND input.phase IN {
          PRESS,
          RELEASE,
          NAVIGATION_TRANSITION,
          RETURN_TO_HOME
        }
END FUNCTION

FUNCTION isSplashBugCondition(input)
  INPUT: input of type ColdStartInput
  OUTPUT: boolean

  RETURN input.isColdStart = true
    AND input.stage IN {
          SYSTEM_SPLASH,
          APP_LAUNCH_SURFACE,
          HANDOFF_TO_HOME
        }
    AND input.deviceConfiguration IN SUPPORTED_ANDROID_CONFIGURATIONS
END FUNCTION

FUNCTION isOfflinePlaybackBugCondition(input)
  INPUT: input of type PlaybackTransitionInput
  OUTPUT: boolean

  RETURN input.network = OFFLINE
    AND input.completeLocalFileAvailable = true
    AND input.queueHasFollowingTrack = true
    AND input.scheduleCloseDuration = 45_MINUTES
    AND input.scheduleCloseDeadline > input.now
    AND input.candidateRequestsAutomaticTrackChange = true
    AND input.explicitTransition = false
    AND input.intentionalQueueChange = false
    AND input.confirmedSameSessionPlaybackError = false
    AND input.evidencedNaturalEnd = false
END FUNCTION

FUNCTION isBugCondition(input)
  INPUT: input of type HomeInteractionInput
                    OR ColdStartInput
                    OR PlaybackTransitionInput
  OUTPUT: boolean

  RETURN isHomeBugCondition(input)
    OR isSplashBugCondition(input)
    OR isOfflinePlaybackBugCondition(input)
END FUNCTION
```

正确行为只由“Correctness Properties”中的编号属性定义：

```text
FUNCTION expectedBehavior(input, result)
  INPUT: input and observable result
  OUTPUT: boolean

  IF NOT isBugCondition(input) THEN
    RETURN result SATISFIES PROPERTY_2
  END IF

  IF isHomeBugCondition(input) THEN
    RETURN result SATISFIES PROPERTY_1
  END IF

  IF isSplashBugCondition(input) THEN
    RETURN result SATISFIES PROPERTY_3
  END IF

  IF isOfflinePlaybackBugCondition(input) THEN
    RETURN result SATISFIES PROPERTY_4
      AND result SATISFIES PROPERTY_5
      AND result SATISFIES PROPERTY_6
      AND result SATISFIES PROPERTY_7
      AND result SATISFIES PROPERTY_8
      AND result SATISFIES PROPERTY_9
      AND result SATISFIES PROPERTY_10
  END IF

  RETURN false
END FUNCTION
```

### Examples

#### Home examples

- 竖屏首页中“我喜欢”是歌单区最后一项时，其正常布局底边必须先于快捷入口区起点；用户报告的缺陷是二者偶发相交。
- 一次有效“推荐歌单”交互必须只保留一个标签字形层并只提交一次既有路由；重复回调或转场残留不得创建第二个标签或第二次导航。
- 返回首页时，相同业务歌单必须由相同 `platform + id` key 表示，不能因列表索引或回收位置变化复用成其他条目。
- 点击两个快捷卡片之间的空隙不能激活相邻入口；修复不通过扩大交叠 hit rect 规避布局问题。

#### Splash examples

- 系统 splash 起始状态当前只绘制 `infinity` 路径的 8%；修复后的每个可达系统状态都必须包含该路径的完整几何。
- 专用 splash vector 必须把包含 stroke 的完整路径包围盒放在声明的安全 inset 内，不能依赖裁切路径产生“绘制”效果。
- 应用内品牌图像必须在独立安全容器内以 contain 显示；shadow 或圆角背景不得成为品牌内容的 clip owner。
- 从系统 surface 到应用 surface 再到首页只能向前推进；应用 surface 一旦退出不得因 bootstrap 状态变化重新显示。

#### Offline playback examples

- 可信时长为 300 秒、同会话最后位置为 120 秒时出现 `Content_Track -> End_Sentinel`：该事件只能形成 `UNKNOWN/INSUFFICIENT_END_EVIDENCE`，不得推进下一曲。
- session A 的错误在用户已显式切换到 session B 后才完成延迟处理：tuple 不匹配，必须拒绝，不能改变 B。
- 当前 session/source revision 的位置已经进入自然结束容差，且同一内容项收到可信终止状态：可接受一次 `NATURAL_END`，再使用既有循环/随机目标选择。
- 旧 schedule token 的回调或 deadline 尚未到期的回调不得暂停、重置、退出或切换当前曲目。
- 到期且选择“当前歌曲播放完成后关闭”时，首个被接受的同会话自然结束被消费为 `TIMER_EXPIRED_STOP`，不得先提交普通下一曲。
- 用户点击下一曲或系统发送 `RemoteNext` 时，保持即时目标选择语义，但分别记录 `USER_NEXT` 或 `REMOTE_NEXT`，且相同命令 id 只提交一次。

## Expected Behavior

### Preservation Requirements

**Unchanged Home Behaviors:**

- 保持 `ContinueListening -> RecentlyPlayed -> 常用歌单 -> 快捷入口` 的信息顺序、内容、空状态和纵向滚动能力。
- 保持“我喜欢”及四个快捷入口的既有 route、params 和返回首页行为。
- 保持横屏 `HomeBodyHorizontal` 的既有信息结构和交互语义；竖屏列表重构使用独立组合层，不改变横屏所有权。
- 保持歌单创建、导入、删除、收藏切换以及其他首页入口行为。
- 保持既有文字、颜色和卡片视觉；按压反馈只可在单层上改变 opacity/background/color，不改变几何、z-order 或命中范围。

**Unchanged Launch Behaviors:**

- 保持既有品牌路径、颜色、背景、启动文案和完整几何上的轻微脉冲/淡出意图。
- 保持应用内承接层的既有视觉时限与 `pointerEvents="none"`，首页可交互后不得重新遮盖或拦截输入。
- 保持系统“减少动态效果”语义；减少动画时仍显示完整静态几何。
- 不修改 launcher 图标或通知图标；系统 splash 使用独立安全 inset 资源。

**Unchanged Playback, Queue, and Timer Behaviors:**

- 没有有效完整本地文件时，继续使用现有缓存、替代插件、插件和 URL 回退语义。
- 完整本地文件继续支持离线播放、暂停、恢复、seek 和 rate。
- 接受充分自然结束证据后，继续使用既有队列循环、单曲循环和随机目标选择。
- 可归属于当前 session 的真实错误继续遵循既有“错误时停止或自动下一曲”配置。
- 应用按钮、手势、通知和系统媒体控制的播放、暂停、上一曲、下一曲和 seek 语义保持不变。
- 合法的添加、移除、重排、替换或清空队列继续使用既有目标算法，只增加明确原因和幂等边界。
- 保持全部现有预设、自定义、取消和“当前歌曲播放完成后关闭”的 deadline/关闭语义。
- 保持下载、导入、查看和删除本地音乐的用户可见语义；本设计不通过忽略本地文件或强制联网规避问题。

**Unchanged Diagnostics and Delivery Behaviors:**

- 日志仍只进入现有应用本地目录或用户主动复制/导出边界，不新增远程遥测。
- `.github/workflows/android-ci.yml` 不在修复改动范围内；本次不触发 workflow，也不修改现有触发、构建或发布语义。
- 未来用户若另行决定构建，仍只能使用 GitHub Actions；这不是当前实现或静态审查的完成条件。
- 非 bug-condition 输入的可观察首页、启动、播放、队列、定时关闭、显式控制、本地文件管理和交付行为保持与 F 相同。

## Hypothesized Root Cause

### Evidence Classification

- **已确认实现缺陷**：当前静态资源本身即可证明错误，不依赖运行现象。
- **静态可见不安全路径 / 候选根因**：存在可达结构或调用链，能够解释用户现象，但不能据此宣称它是设备现象的唯一根因。
- **剩余风险**：静态审查无法确认，且本次不扩大为猜测性修改的设备、媒体或运行时问题。

### Home candidates

1. **同轴嵌套纵向所有者（候选根因）**
   - 已确认结构：外层 `ScrollView` 包含无显式高度的 `FlashList`，`Operations` 是其后 sibling。
   - 风险：虚拟列表测量或回收更新与外层 sibling 布局存在多个所有者，不能由结构保证边界始终唯一且不相交。
   - 处置：无论该风险是否是设备现象的唯一原因，都改为一个竖向列表拥有 header、data 与 footer。

2. **列表 identity 不稳定（候选根因）**
   - 已确认结构：`FlashList` 无 `keyExtractor`，render 节点 key 不能替代虚拟列表 identity。
   - 风险：业务条目和回收槽位可能短暂错配。
   - 处置：使用 `platform + id` 的列表级 key；不以 index 或标题作为 identity。

3. **文本进入动画、按压层和 native-stack 转场并发合成（候选根因）**
   - 已确认结构：快捷标签处于 `FadeInDown` 容器内，按压与 native-stack 转场可重叠。
   - 风险：即使 React 业务树只有一个 `ThemeText`，设备合成仍可能保留文字层快照或残留。
   - 处置：标签保持单一稳定层，移除承载文字的 entering/exiting 合成路径。

4. **缺少导航门闩（静态可见风险）**
   - 当前没有证据证明一次 press 必然派发两次；缺少门闩只说明重复回调没有防御边界。
   - 处置：增加与 focus/离开转场绑定的门闩，不使用全局 debounce，不改变路由。

首页嵌套布局、identity 和合成路径均不得被写成用户设备现象的唯一已证实根因。

### Splash causes

1. **系统品牌主路径被 `trimPath` 裁切（已确认实现缺陷）**
   - `trimPathEnd` 从 `0.08` 开始，起始和中间状态必然缺少完整路径。
   - 处置：移除 animated-vector/animator 的可达引用，改为始终包含完整几何的专用 vector。

2. **系统 splash 缺少专用 safe inset（静态可见风险）**
   - 当前直接使用 launcher foreground 作为 animated icon，没有专门为 splash mask 声明完整 stroke 包围盒的安全区域。
   - 处置：创建专用完整 vector，以 viewport 和统一中心缩放建立静态可计算的正 inset；不修改 launcher asset。

3. **应用内图像缺少显式 contain 与内容/阴影分层（静态可见风险）**
   - 静态代码不能证明所有设备都会裁切，但也没有显式约束内容必须 contain 且不受圆角/overflow 影响。
   - 处置：独立品牌内容层、`resizeMode="contain"`、透明 inset 和单向 handoff owner。

### Offline playback candidates

1. **TrackPlayer 顶层未无条件执行完整本地文件短路（候选根因）**
   - 插件 wrapper 本地优先，但 TrackPlayer 在插件缺失时可能绕过 wrapper。
   - 处置：把本地 resolver 提升到 session 创建后的第一音源分支；无有效本地文件时才进入现有回退链。

2. **sentinel 激活被直接等同于自然结束（候选根因）**
   - 当前 active-track 0→1 路径没有位置、可信时长、状态和 Session_Tuple 证据。
   - 处置：sentinel 只生成候选；自然结束必须由同一 tuple 的位置、时长和终止证据共同成立。

3. **旧或重复错误延迟推进新 session（候选根因）**
   - 当前错误读取 active track 的时机不稳定，500ms 后不复核原 session。
   - 处置：错误到达即捕获 tuple，延迟后 compare-and-set，再按既有配置执行一次。

4. **显式控制、队列变化和自动事件缺少唯一原因（静态可见风险）**
   - 多个入口最终调用无来源参数的 `skipToNext/play/reset`。
   - 处置：所有入口规范化为 typed candidate；显式命令与合法队列变化保留即时语义。

5. **定时器旧回调与 PlayEnd listener 生命周期不完整（静态可见风险）**
   - 当前缺少 token/deadline 二次校验和一次性 after-current 消费。
   - 处置：计划 token、绝对 deadline、幂等 consume 和独立 `TIMER_EXPIRED_STOP` 原因。
   - 当前静态链不支持“45 分钟计划在约 2 分钟直接 next”的因果结论。

### Non-blocking residual risks

- **特定媒体解码器行为**：完整、可读、正大小的文件仍可能触发平台解码器/容器错误。该风险保留为真实错误策略的输入，不更换解码器或吞掉同会话真实错误。
- **下载文件内部完整性**：当前下载器复制后发布 localPath，但静态代码无法证明任意既有文件的编码内容或远端响应完整。`src/core/downloader.ts` 不在本次猜测性修改范围；本地 resolver 只执行 requirements 要求的存在、可读、正大小与可信时长约束。
- **设备合成器行为**：单一布局/文本层可以闭合已知不安全结构，但静态审查不能证明所有设备合成路径的像素结果。
- **真实运行时竞态**：arbiter 能拒绝已枚举的旧、重复、未知候选，但静态审查不能观察未建模的平台内部事件。

这些风险不构成实施阻塞 gate，也不要求先取得未修复 APK 的运行证据。防御性边界按本设计直接实施；静态无法确认的部分保持风险记录，不扩展为猜测性业务修改。

## Correctness Properties

Property 1: Bug Condition - Home Single Ownership, Stable Identity, and Navigation

_For any_ portrait home interaction covered by `isHomeBugCondition`, F' SHALL place all relevant sections in one vertical layout owner, use a stable business key for every reusable playlist or quick-entry item, expose exactly one text layer for each affected entry, keep sibling ownership boundaries disjoint by construction, and commit the existing route exactly once for one accepted interaction.

**Static Review Proof Obligation:** Trace the portrait branch from `Home` to a single vertical list; prove its header/data/footer order, prove every playlist row key is `platform + id` and every quick-entry key is a stable action id/route rather than translated text or index, inspect each affected entry for one text node, and trace all five navigation callbacks through one focus/transition latch with no direct `navigate` bypass.

**Code Paths:** `src/pages/home/index.tsx`; `src/pages/home/components/homeBody/index.tsx`; `src/pages/home/components/homeBody/sheets.tsx`; `src/pages/home/components/homeBody/operations.tsx`; `src/pages/home/components/ActionButton.tsx`; new `src/pages/home/hooks/useHomeNavigationLatch.ts`; `src/core/router/index.ts` as an unchanged global navigation reference.

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - Inputs Outside the Three Bug Conditions

_For any_ input where `isBugCondition` returns false, F' SHALL preserve F's observable home information and routes, landscape structure, brand identity and non-blocking launch behavior, playback controls, source fallback, queue/repeat/error/timer semantics, local file management, local-only diagnostics boundary, and delivery behavior.

**Static Review Proof Obligation:** Review the diff by affected branch and show each new condition narrows behavior only at the defined bug/safety boundary; verify unchanged route/param and target-selection functions are reused; verify horizontal home, downloader, codec integration and workflow files have no semantic rewrite.

**Code Paths:** all files named by Properties 1 and 3–10; `src/pages/home/components/homeBodyHorizontal/index.tsx`; existing queue/repeat helpers in `src/core/trackPlayer/index.ts`; `src/core/downloader.ts`; `src/core/localMusicSheet.ts`; `.github/workflows/android-ci.yml` as an untouched preservation reference.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12, 3.13, 3.14, 3.15, 3.16, 3.17**

Property 3: Bug Condition - Complete Splash Geometry and Monotonic Handoff

_For any_ supported cold-start stage covered by `isSplashBugCondition`, F' SHALL reference complete unchanged brand geometry within a positive safe inset, SHALL contain no reachable geometry-clipping animation or content clip owner, and SHALL move through one non-blocking `SYSTEM -> APP_SURFACE -> HOME` handoff without re-showing an exited surface or creating a second application logo layer.

**Static Review Proof Obligation:** Follow Manifest → theme → drawable references and prove the reachable drawable is a complete vector with stroke-inclusive bounds inside its inset and no `trimPath`/clip/mask; inspect the app surface for one `contain` image and separate shadow/background; inspect the state owner for forward-only transitions, idempotent native hide, bounded overlay lifetime and `pointerEvents="none"`.

**Code Paths:** `android/app/src/main/AndroidManifest.xml`; `android/app/src/main/java/fun/upup/musicfree/MainActivity.kt`; `android/app/src/main/res/values/styles.xml`; `android/app/src/main/res/drawable/echomusic_icon_foreground.xml` as source geometry; new `android/app/src/main/res/drawable/echomusic_splash_icon.xml`; removal of `android/app/src/main/res/drawable/echomusic_splash_animated.xml` and `android/app/src/main/res/animator/echomusic_splash_trace.xml`; `src/entry/index.tsx`; `src/entry/bootstrap/bootstrap.ts`; `src/entry/bootstrap/BootstrapComponent.tsx`; new `src/entry/bootstrap/launchHandoff.ts`.

**Validates: Requirements 2.3, 2.4**

Property 4: Bug Condition - Complete Local File First and Fresh Source Application

_For any_ playback request with a resolvable, existing, readable, positive-size complete local file, F' SHALL normalize and choose that local URI before cache/plugin/alternative/network resolution, and SHALL apply any asynchronous source result only when its Session_Tuple still equals the current tuple.

**Static Review Proof Obligation:** Trace `setupTrackPlayer`, `play`, replay and quality/source replacement through the shared local resolver before plugin lookup; inspect URI scheme handling and file probe fields; prove every `await` before source application is followed by tuple comparison and every native queue write increments/source-tags the revision.

**Code Paths:** `src/core/trackPlayer/index.ts`; new `src/core/trackPlayer/localPlaybackSource.ts`; new `src/core/trackPlayer/playbackSession.ts`; `src/utils/mediaUtils.ts`; `src/utils/fileUtils.ts`; `src/core/pluginManager/plugin.ts` for unchanged fallback order; `src/core.defination/trackPlayer/index.ts`; `src/types/core/trackPlayer/index.d.ts`.

**Validates: Requirements 2.5**

Property 5: Bug Condition - One Transition Arbiter and No Automatic-Advance Bypass

_For any_ automatic track-change candidate from active-track changes, terminal state/end events, playback/source errors, automatic recovery, queue effects or timer effects, F' SHALL attach current session, generation, source revision, source classification and idempotency key, submit the candidate to one Transition_Arbiter, and permit no direct logical-current-track write or next/replay/stop execution outside the Transition_Executor.

**Static Review Proof Obligation:** Enumerate every producer and every mutation sink; prove all producers call `submitTransition`, all sinks are private to the executor/source-application boundary, metadata-only updates cannot change logical identity, and repository-wide references contain no raw automatic `skipToNext`, current-track atom write, `PlayEnd` emission, native reset or logical next target selection outside approved wrappers.

**Code Paths:** `src/core/trackPlayer/index.ts`; new `src/core/trackPlayer/playbackSession.ts`; new `src/core/trackPlayer/playbackTransition.ts` containing the arbiter/executor; `src/service/index.ts`; `src/entry/bootstrap/bootstrap.ts`; `src/utils/scheduleClose.ts`; `src/core.defination/trackPlayer/index.ts`; `src/types/core/trackPlayer/index.d.ts`; all UI callers of public play/skip/queue methods as explicit-origin references.

**Validates: Requirements 2.6, 2.8, 2.14**

Property 6: Bug Condition - Natural End Requires Same-Session Position and Duration Evidence

_For any_ candidate claiming natural completion, F' SHALL accept `NATURAL_END` only when current Content_Track identity, session, generation and source revision match; a same-revision terminal signal is present; and the last known same-session position is within the bounded end window of a Trusted_Duration. Sentinel activation, placeholder activation, stopped state, stale events, missing/conflicting duration or a far-from-end position alone SHALL NOT advance the queue.

**Static Review Proof Obligation:** Inspect the natural-end predicate as one conjunctive function; trace each evidence field to its same-tuple producer; prove a satisfying candidate is classified together with any due after-current schedule before one terminal reservation; prove ordinary `NATURAL_END` emits/selects the existing repeat/queue target once, timer-consumed end only stops/exits, and insufficient evidence can only reject or perform bounded same-track recovery.

**Code Paths:** event listeners and progress snapshot in `src/core/trackPlayer/index.ts` and `src/service/index.ts`; natural-end evidence reducer in new `src/core/trackPlayer/playbackTransition.ts`; Content/Sentinel tagging in `src/core/trackPlayer/playbackSession.ts` and source application; existing repeat/queue target helpers; `src/core.defination/trackPlayer/index.ts` accepted-end event definition.

**Validates: Requirements 2.7, 2.8**

Property 7: Bug Condition - Playback Error Attribution and Idempotence

_For any_ playback or source error, F' SHALL execute the existing stop-or-next error policy at most once only when the error belongs to the current Content_Track Session_Tuple; stale, sentinel, proposed, duplicate or unattributable errors SHALL be recorded and rejected from changing the current logical track.

**Static Review Proof Obligation:** Trace native error and invalid-source producers to an immutable tuple snapshot; inspect the post-delay compare-and-set and error idempotency key; prove policy execution reuses `autoStopWhenError` and enters the executor once, while all rejection branches have no mutation sink.

**Code Paths:** `src/core/trackPlayer/index.ts` `PlaybackError`, `play` failure branch and replacement for `handlePlayFail`; error candidate/arbiter logic in new `src/core/trackPlayer/playbackTransition.ts`; session snapshot in `src/core/trackPlayer/playbackSession.ts`; app config read for `basic.autoStopWhenError`; executor in `playbackTransition.ts`.

**Validates: Requirements 2.9**

Property 8: Preservation - Explicit Controls and Legal Queue Changes Keep Their Semantics

_For any_ user/system media selection, previous/next command or legal queue edit, F' SHALL preserve the existing immediate target-selection and queue behavior, assign an explicit command or `QUEUE_CHANGE` reason, deduplicate only the same command id, and SHALL NOT require natural-end evidence for that explicit transition.

**Static Review Proof Obligation:** Trace each app button, gesture, direct selection, `RemoteNext/Previous`, add/remove/reorder/replace/clear path to a typed public API and then the arbiter/executor; prove the existing target helpers remain authoritative and no path is mislabeled as natural end, playback error or unknown automatic transition.

**Code Paths:** `src/pages/musicDetail/components/bottom/playControl.tsx`; `src/components/musicBar/musicInfo.tsx`; `src/service/index.ts`; `src/components/mediaItem/musicItem.tsx`; `src/components/musicList/index.tsx`; `src/components/musicSheetPage/components/sheetMusicList.tsx`; `src/components/base/playAllBar.tsx`; `src/components/panels/types/playList/body.tsx`; `src/components/panels/types/playList/header.tsx`; `src/pages/searchPage/components/resultPanel/results/musicResultItem.tsx`; `src/pages/home/components/homeBody/recentlyPlayed.tsx`; `src/core/trackPlayer/index.ts` public play/skip/add/remove/reorder/replace/clear methods; playback type definitions.

**Validates: Requirements 2.10, 2.11, 3.8, 3.9, 3.11, 3.12**

Property 9: Bug Condition - Schedule Token, Deadline, and One Close Decision

_For any_ schedule set, replacement, cancellation or callback, F' SHALL bind the callback to the current Schedule_Token and Absolute_Deadline, re-check both at callback time, give stale/cancelled/early/duplicate callbacks no playback effect, and execute each due immediate or after-current close exactly once as `TIMER_EXPIRED_STOP`, never as an ordinary next-track transition.

**Static Review Proof Obligation:** Trace all schedule UI calls to one controller; inspect token increments on set/replace/cancel, old timeout/waiter cleanup, callback deadline re-read, early re-arm, due-mode branch and consumed flag; prove after-current can consume only a same-session candidate that satisfies Property 6 while the current token/mode/deadline is still valid and due, converts that candidate to one final `TIMER_EXPIRED_STOP` before terminal reservation, and never commits a separate ordinary-next decision.

**Code Paths:** `src/components/panels/types/timingClose.tsx`; `src/utils/scheduleClose.ts`; natural-end validation inside `src/core/trackPlayer/playbackTransition.ts`; typed stop/exit executor in that module; `src/native/utils/index.ts` `exitApp` call site.

**Validates: Requirements 2.12, 3.10**

Property 10: Preservation - Ordered and Redacted Structured Diagnostics

_For any_ source selection, transition candidate, natural-end decision, error, explicit control, queue change, schedule callback or final decision recorded under the existing local diagnostics setting, F' SHALL emit a structured record with monotonic ordering and correlatable session/generation/source revision, anonymous track identity, source/reason, position/duration, timer state and execute/reject outcome, while omitting or redacting complete paths, URI path components, headers, cookies, credentials, secret tokens, raw plugin objects and private error text.

**Static Review Proof Obligation:** Inspect one schema and one logger-boundary allowlist/sanitizer; map every required producer to that API; prove sensitive values are transformed before logger invocation; inspect affected legacy trace calls and prove no raw object/path fallback remains; confirm transport remains local/user-initiated only.

**Code Paths:** `src/utils/log.ts`; new `src/core/trackPlayer/playbackDiagnostics.ts`; affected calls in `src/core/trackPlayer/index.ts`, `src/core/pluginManager/plugin.ts`, `src/utils/scheduleClose.ts`, `src/service/index.ts`; existing local log export paths.

**Validates: Requirements 2.13, 3.15**

Property 11: Completion - Static Review Only and Bounded Conclusion

_For any_ implementation submitted under this design, completion SHALL be determined only by the static proof obligations and code-path closure for Properties 1–10; it SHALL require no local build, workflow invocation, executable test, device evidence, repeated session or reproduction result, and its conclusion SHALL be limited to “闭合已识别不安全路径并完成防御性修复” with residual runtime risks retained.

**Static Review Proof Obligation:** Confirm each property has file/symbol evidence and no unclassified write sink; inspect the change/task scope for absence of execution prerequisites and workflow changes; record unresolved decoder, file-internal-integrity, compositor and runtime-race risks without speculative code expansion or stronger claim.

**Code Paths:** this `design.md`; `bugfix.md`; implementation diff and static review ledger; `.github/workflows/android-ci.yml` only as an unchanged/future-build reference.

**Validates: Requirements 2.14, 2.15, 2.16, 2.17**

## Fix Implementation

### Change Boundary

实施分为首页、启动和播放三个独立补丁面。它们共享“单一所有者、明确 identity、来源和幂等”原则，但不共享业务状态，也不把三个缺陷合并为一个根因。

本设计明确不包含：设备或 APK 探索 gate、基于约 2 分钟的特殊判断、媒体解码器替换、下载协议/复制流程重写、远程遥测、测试 harness、构建脚本或 GitHub Actions workflow 修改。

### 1. Home: one portrait layout owner, stable keys, one text layer, one navigation latch

**Files:**

- `src/pages/home/components/homeBody/index.tsx`
- `src/pages/home/components/homeBody/sheets.tsx`
- `src/pages/home/components/homeBody/operations.tsx`
- `src/pages/home/components/ActionButton.tsx`
- 新增 `src/pages/home/hooks/useHomeNavigationLatch.ts`
- `sheets.tsx` 导出不持有滚动容器的 `SheetSectionHeader`、`SheetRow` 与数据模型，供竖屏单一列表和既有横屏 wrapper 复用

**Specific Changes:**

1. **建立 Portrait_Layout_Owner**
   - 竖屏 `HomeBody` 改为一个 `FlashList` 拥有整个垂直流。
   - `ListHeaderComponent` 顺序承载 `ContinueListening`、`RecentlyPlayed` 和常用歌单 header/tab；`data` 只承载当前歌单行；`ListFooterComponent` 承载 `Operations`。
   - 移除竖屏外层 `ScrollView` 与内部同轴 `FlashList` 的嵌套。横向历史列表仍是正交滚动，不构成第二个垂直所有者。
   - 所有 section/row/footer 使用正常布局流；不得以绝对定位、负 margin 或 z-index 覆盖掩盖边界。
   - 横屏继续由 `HomeBodyHorizontal` 组合既有区域；共享的是纯展示 row/header，不共享竖屏列表所有权。

2. **建立 Stable_Business_Key**
   - 歌单列表级 `keyExtractor` 固定为规范化的 `${sheet.platform ?? localPluginPlatform}:${sheet.id}`。
   - 四个快捷入口各自声明不随翻译变化的 action id（或既有 route 常量），`map` 的 key 使用该稳定值，不再使用 `action.title`。
   - 所有 key 均不包含 index、当前 tab、标题、翻译文本或回收位置。
   - `extraData` 只携带真正影响 row 显示的稳定值，不能用每次 render 新建的对象破坏 identity。

3. **保持 Single_Text_Layer**
   - `ActionButton` 使用一个稳定 pressable 容器和一个 `ThemeText`。
   - 移除包裹标签的 entering/exiting animated layer；若保留装饰动画，只允许独立背景/图标层动画，不得复制、快照或重新挂载文字。
   - 按压反馈只改变单层 opacity/background/color，不改变 width、height、position、transform、margin 或 z-order。
   - 每个入口保留单行标签，不增加 text shadow 或第二个无障碍/视觉文本副本。

4. **固定快捷区几何所有权**
   - 快捷区容器使用可用宽度 `100%` 与既有 padding/gap，卡片使用 `flex: 1`、`minWidth: 0`，避免固定小数宽度累计越界。
   - 卡片 hit rect 保持在自己的布局盒内，不与相邻卡片重叠。

5. **增加 Home_Navigation_Latch**
   - 五个受影响入口统一调用 `guardedNavigate(route, params)`。
   - 仅在首页 focused 且 latch 尚未接受当前离开动作时提交；提交前同步锁定，避免同一 press/release/transition 周期重复派发。
   - 首页失焦期间保持锁定，返回并重新获得 focus 时解锁；不使用基于毫秒数的全局 debounce。
   - 最终仍调用既有 `navigation.navigate(route, params)`，不改变 route、params、back stack 或正常下一次交互。

### 2. Splash: complete vector, safe inset, contain surface, monotonic handoff

**Files:**

- `android/app/src/main/res/values/styles.xml`
- 新增专用完整资源，例如 `android/app/src/main/res/drawable/echomusic_splash_icon.xml`
- 删除 `android/app/src/main/res/drawable/echomusic_splash_animated.xml`
- 删除 `android/app/src/main/res/animator/echomusic_splash_trace.xml`
- `src/entry/bootstrap/BootstrapComponent.tsx`
- `src/entry/bootstrap/bootstrap.ts`
- 新增 `src/entry/bootstrap/launchHandoff.ts` 作为唯一 handoff 状态所有者

**Specific Changes:**

1. **移除系统路径裁切**
   - `windowSplashScreenAnimatedIcon` 直接引用专用静态完整 vector，不再引用 animated-vector。
   - 可达 splash 资源中不得存在 `trimPathStart`、`trimPathEnd`、clip-path、mask 或通过缺失几何制造动画的效果。
   - 删除不再使用的 trace animator，防止未来误接回主题；launcher foreground 保持不变。

2. **建立静态可证明的 safe inset**
   - 专用 vector 复用当前完整品牌 path/color，不改变左右轮廓、纵横比和视觉中心。
   - 专用资源使用现有 `108 x 108` viewport，以 `(54,54)` 为 pivot 对完整 path group 做 `0.75` 等比缩放；当前 stroke-inclusive 原始 bounds `x=[14.5,93.5]`、`y=[26.25,81.75]` 因而变为 `x=[24.375,83.625]`、`y=[33.1875,74.8125]`，四边保持明确正 inset。
   - path 或 stroke 若在实现中变化，必须在同一资源注释/审查记录中重新计算 bounds；不得通过设备图像、裁切或单边拉伸“校正”几何。

3. **App_Launch_Surface 使用 contain 与分层**
   - 品牌 `Image` 明确设置 `resizeMode="contain"`，使用正方形 aspect ratio 和独立透明 padding。
   - shadow/圆角背景位于兄弟或外层装饰 view；品牌 `Image` 移除内容裁切型 `borderRadius`，品牌内容 view 不使用 `overflow: hidden`，不让圆角成为 clip owner。
   - opacity/scale 脉冲作用于包含完整图标的安全容器，最大 scale 仍不越过容器内容边界。
   - 保留一个品牌 `Image` 和既有文案；不得用第二个图像层做 cross-fade。

4. **建立 Monotonic_Handoff owner**
   - 用一个启动进程状态所有者维护 `SYSTEM -> APP_SURFACE -> HOME`，只提供 compare-and-set 的向前转换。
   - `BootstrapComponent` 首个完整品牌 surface ready 后只通知一次；`bootstrap.ts` 的 native hide 只由该 owner 执行且保持幂等。
   - 若 ready 信号未到，使用不超过既有视觉上限的有界 fallback 继续向前，不能让启动层永久阻塞；fallback 不是验收 gate。
   - `APP_SURFACE` 一旦进入 EXITING/REMOVED，不因 Loading/Error/retry 状态重新变为可见。
   - 保持 `pointerEvents="none"`、既有 1200ms 视觉上限、背景与视觉中心；减少动态效果时使用完整静态图标并单调退出。

### 3. Playback: local-first source and one transition arbiter

**Files:**

- `src/core/trackPlayer/index.ts`
- 新增 `src/core/trackPlayer/playbackSession.ts`
- 新增 `src/core/trackPlayer/playbackTransition.ts`
- 新增 `src/core/trackPlayer/localPlaybackSource.ts`
- `src/core/pluginManager/plugin.ts`
- `src/utils/mediaUtils.ts`
- `src/utils/fileUtils.ts`（由本地 source 模块封装现有平台文件探测能力）
- `src/service/index.ts`
- `src/utils/scheduleClose.ts`
- `src/core.defination/trackPlayer/index.ts`
- `src/types/core/trackPlayer/index.d.ts`
- `src/utils/log.ts`
- 新增 `src/core/trackPlayer/playbackDiagnostics.ts`
- 所有显式控制/队列调用者只更新 typed origin 参数

`src/core/downloader.ts`、媒体解码器集成和 `.github/workflows/android-ci.yml` 不在本补丁范围。

#### 3.1 Session and candidate model

每次逻辑选择或重新开始曲目创建：

```text
PlaybackSession {
  sessionId
  generation
  trackKey
  sourceRevision
  terminalDecision
  acceptedEventIds
  lastProgressBySourceRevision
  trustedDurationBySourceRevision
  boundedRecoveryUsed
}
```

每个候选统一为：

```text
TransitionCandidate {
  eventId
  idempotencyKey
  monotonicSequence
  sessionId
  generation
  sourceRevision
  trackKey
  trackRole
  origin
  requestedReason
  position
  trustedDuration
  playerState
  queueSnapshot
  scheduleSnapshot
  errorClass
}
```

- `generation` 在每次新的逻辑 play intent（包括同曲重新开始）时递增。
- `sourceRevision` 在 proposed queue、真实 source、换音质或同会话恢复每次写入原生队列前递增。
- 原生 Content/Sentinel track 带内部字符串 tag：session、generation、source revision、role 和匿名 track key；这些字段不写回持久业务对象。
- 所有异步 closure 捕获完整 tuple；每次 `await` 后、任何 queue/current state 写入前重新比较当前 tuple。

#### 3.2 Local source resolution

```text
play intent
  -> create/capture session + generation
  -> resolveCompleteLocalSource(mediaItem)
       -> read local candidate from file/content URI or stored localPath
       -> normalize once into {probeLocation, playbackUri}
       -> verify resolvable + exists + readable + size > 0
       -> capture trusted duration for this source revision
       -> return LOCAL_FILE or classified NO_VALID_LOCAL_FILE
  -> if LOCAL_FILE: do not call cache/plugin/network resolver
  -> otherwise: invoke existing fallback chain unchanged
  -> compare Session_Tuple
  -> apply source with incremented source revision
```

- absolute path 转换为一个 `file://` playback URI；已有 `file://` 不重复加 scheme；`content://` 保持原 scheme。
- probe 使用平台支持的 stat/open 能力确认可读和正大小；失败只产生分类结果，不把未确认的瞬态失败当成删除持久 localPath 的依据。
- `Trusted_Duration` 必须是正有限值，并记录来源与当前 revision。若媒体 metadata 与当前 source 的播放器 duration 冲突，标记 `DURATION_CONFLICT`，该 revision 不可凭自然结束推进。
- 只有没有有效完整本地文件时，才调用现有 plugin wrapper，并保持缓存、替代插件、插件和原 URL 回退顺序。
- TrackPlayer 顶层执行该分支，因此插件缺失不能绕过本地文件。

#### 3.3 One arbiter and one executor

```text
FUNCTION submitTransition(candidate)
  IF candidate.idempotencyKey already seen
    RETURN REJECT(DUPLICATE)
  END IF

  IF candidate Session_Tuple != current Session_Tuple
    RETURN REJECT(STALE_SESSION_TUPLE)
  END IF

  IF candidate is automatic AND evidence is insufficient
    RETURN REJECT_OR_RECOVER_CURRENT(UNKNOWN)
  END IF

  IF candidate closes current session AND terminalDecision already exists
    RETURN REJECT(DUPLICATE_TERMINAL_DECISION)
  END IF

  decision := classifyWithExplicitReason(candidate)
  atomically reserve decision
  RETURN Transition_Executor.execute(decision)
END FUNCTION
```

- `Transition_Executor` 是唯一可提交新逻辑 current track、自然结束 replay/next、错误策略 stop/next、合法 queue-current replacement 或 timer stop/exit 的位置。
- 公共 `play/skipToNext/skipToPrevious/remove/replace/clear/reset` 改为 typed wrapper；wrapper 生成候选，不直接选择/写入最终逻辑状态。
- 原生 `setQueue` 只存在于 source application helper；其 active-track 副作用带 source-mutation 上下文并仍进入 arbiter，不得触发业务 next。
- metadata enrichment 使用独立 `updateCurrentMetadata`，只能更新同一 `platform/id` 的非 identity 字段，不能绕过 executor 改变逻辑曲目。
- `PlayEnd` 改为“已接受的自然结束”通知，只能在 terminal gate 原子关闭后发出一次；原始 sentinel 事件不得发出该通知。

#### 3.4 Reachable transition entry inventory

以下清单是实施时必须闭合的当前可达入口，不依赖概率复现决定是否处理：

| Existing entry | Classification | F' route | Forbidden bypass |
|---|---|---|---|
| `PlaybackActiveTrackChanged` 0→sentinel | automatic terminal candidate | tag snapshot → natural-end evidence → arbiter | 直接 `PlayEnd`、replay 或 next |
| 新增消费 `PlaybackState` terminal state | automatic evidence | same-tuple evidence reducer → arbiter | state 单独推进 |
| 新增消费 `PlaybackQueueEnded` | automatic evidence | same-tuple evidence reducer → arbiter | queue-ended 单独推进 |
| `PlaybackError` | automatic error candidate | immediate tuple snapshot → delayed recheck → arbiter | 延迟后直接 next |
| `play` 的 `INVALID_SOURCE` | automatic source-error candidate | captured tuple → error classification → arbiter | 直接 `handlePlayFail/next` |
| proposed/real/quality `setQueue` side effects | source mutation | increment/tag revision → event normalization → reject as mutation unless other evidence exists | 把 queue replacement 当自然结束 |
| current-track `play()` 对 native index 0 的 reactivation / `RECOVER_CURRENT` | same-logical-track recovery | typed recovery id + tuple/revision check → source helper/arbiter | 将 native index 变化误记为自然结束或新曲目 |
| `remove(current)` / replace / clear / add-to-empty | intentional queue change | `QUEUE_CHANGE` candidate → existing target algorithm → executor | 无原因地写 current/play/reset |
| app direct select/next/previous/gesture | explicit user command | `USER_SELECT/NEXT/PREVIOUS` + command id → arbiter | 无来源 `skip/play` |
| `RemoteNext/RemotePrevious` | explicit system command | `REMOTE_NEXT/PREVIOUS` + command id → arbiter | service 直接 skip |
| app exit / `RemoteStop` / explicit clear stop | explicit stop or queue clear | `USER_EXIT/REMOTE_STOP/QUEUE_CHANGE_CLEAR` → typed stop executor | raw native stop/reset with no origin |
| schedule callback / after-current waiter | timer terminal action | token/deadline check → `TIMER_EXPIRED_STOP` → arbiter/executor | raw `PlayEnd` listener 或直接 reset/exit |
| startup restore/autoplay current item | restore/resume, not automatic next | `RESTORE_SESSION/AUTO_RESUME` with tuple → source application | 旧 promise 覆盖新 session |
| cellular/network policy rejection | source-policy stop, not next | `SOURCE_POLICY_STOP` with current tuple → typed stop executor | raw reset without classification |

静态闭合还必须证明：

- `setCurrentMusic` 被替换为 executor 私有 commit；除同 identity metadata 更新外无 atom 直写。
- `skipToNext` 的所有调用者都提供 explicit/error/natural-end/queue reason，自动原因只能由 arbiter 产生。
- 原生 `reset/skip/setQueue` 的每个调用点都有明确分类；没有可改变逻辑曲目的未分类调用。
- `TrackPlayerEvents.PlayEnd` 不再由原始 active-track listener 直接发出，也不再被 schedule controller 当作无证据终止信号。

#### 3.5 Natural-end evidence

```text
FUNCTION hasNaturalEndEvidence(candidate, currentSession)
  INPUT: terminal candidate and current session
  OUTPUT: boolean

  RETURN candidate.contentTrackIdentity = currentSession Content_Track
    AND candidate Session_Tuple = currentSession Session_Tuple
    AND candidate.trustedDuration is positive and non-conflicting
    AND candidate.position belongs to the same Session_Tuple
    AND candidate.position >= candidate.trustedDuration
                              - boundedEndWindow(candidate.trustedDuration)
    AND candidate.terminalSignal IN {
          SAME_REVISION_SENTINEL_AFTER_CONTENT,
          SAME_REVISION_ENDED_STATE,
          SAME_REVISION_QUEUE_ENDED
        }
    AND candidate.terminalSignal Session_Tuple = currentSession Session_Tuple
    AND candidate is not caused only by source mutation
    AND currentSession.terminalDecision is empty
END FUNCTION
```

- `boundedEndWindow` 是与时长成比例且有小型上下界的集中函数，仅容纳播放器位置采样误差；它与“约 2 分钟”无关。
- sentinel、Stopped、placeholder、missing duration、duration conflict 或 far-from-end position 任一单独出现都不充分。
- 自然结束证据通过后，arbiter 先检查当前 due after-current 计划：没有待消费计划时最终 reason 为 `NATURAL_END`；有待消费计划时同一候选最终 reason 为 `TIMER_EXPIRED_STOP` 且记录 `trigger=NATURAL_END`。两者只能原子保留一个 terminal decision。
- 只有最终 `NATURAL_END` 才调用既有 repeat/queue 目标选择一次；timer 分支只 stop/exit，不先发起普通 next。已验证结束语义可作为同一最终决定的字段/通知记录，但不是第二个 terminal commit。
- 证据不足时记录并拒绝 next。若原生已激活 sentinel，可在同一逻辑 session 使用最后可信位置执行一次有界 `RECOVER_CURRENT`；同一 source revision 再次发生则暂停并保持当前逻辑曲目标识，避免无限恢复或静默跨曲。

#### 3.6 Playback error ownership

- native error 到达时立即捕获当前 native tag、active index、role、state 和 Session_Tuple，不在延迟后猜测归属。
- proposed/sentinel、旧 tuple、无法关联内容项或重复 id 的 error 只能拒绝。
- 保留既有短延迟时，closure 捕获原 tuple；延迟后 compare-and-set 当前 tuple 与 terminal gate。
- 匹配错误读取既有 `basic.autoStopWhenError`：停止配置保持 stop，自动恢复配置提交一次 `PLAYBACK_ERROR_POLICY` 并复用既有 next target。
- `INVALID_SOURCE` 使用相同错误归属和幂等边界；不得吞掉真实错误，也不得让旧错误推进新曲目。

#### 3.7 Explicit controls and queue reasons

- public methods接受内部 typed origin 与 command id；兼容调用必须在边界显式转换，不能默认为自动 next。
- 音乐详情按钮、迷你播放器手势、直接选择歌曲分别使用 `USER_PREVIOUS/NEXT/SELECT`。
- playback service 使用 `REMOTE_PREVIOUS/NEXT`；play/pause/seek 保持非逻辑曲目转换语义。
- 移除当前项、替换列表、清空列表和空队列添加后的自动播放使用 `QUEUE_CHANGE` 子原因。
- 显式/队列候选不需要自然结束证据，但仍进行当前 generation 与 command id 幂等检查。
- 最终目标继续使用现有 `getPlayListMusicAt`、shuffle 和 single-repeat 逻辑，不在 arbiter 中重写产品算法。

#### 3.8 Schedule token and deadline

```text
set / replace / cancel schedule
  -> increment Schedule_Token
  -> clear previous timeout and pending after-current waiter
  -> store {token, absoluteDeadline, mode, consumed=false}

callback(capturedToken)
  -> read current schedule
  -> reject if capturedToken != current token
  -> read wall clock now again
  -> if now < deadline: re-arm remaining duration; no playback action
  -> if cancelled or consumed: reject; no playback action
  -> if due + immediate: atomically consume; submit TIMER_EXPIRED_STOP
  -> if due + after-current: keep current token armed as due; no playback action

natural-end candidate satisfies Property 6
  -> arbiter reads current schedule and wall clock before terminal reservation
  -> if token is current, mode is after-current, now >= deadline, and not consumed:
       atomically consume token
       reserve one final TIMER_EXPIRED_STOP with trigger=NATURAL_END
       suppress ordinary next
  -> otherwise reserve one final NATURAL_END
       preserve existing natural-end target selection
```

- cancel/replacement increments token even if platform旧回调仍可到达。
- after-current 不再使用裸 `TrackPlayer.on(PlayEnd, exitApp)`；arbiter 对每个满足自然结束证据的候选自行重读当前 schedule token/mode/deadline，因此 timer callback 与结束事件无论先后都在同一 terminal reservation 中决策。
- stop/exit 具有 timer idempotency key，旧、提前或重复回调不能暂停、重置、退出或切歌。
- timer 使用 wall-clock deadline 保留产品语义；诊断排序使用 monotonic sequence。

#### 3.9 Structured redacted diagnostics

新增白名单 schema，复用现有 `debug.traceLog` 与本地文件 transport。每条相关记录包含：

- schema version、monotonic sequence/time 和可选 wall time；
- session id、generation、source revision、transition/event id；
- 安装级盐化 hash 后的 track key；
- `LOCAL_FILE/CACHE/PLUGIN/NETWORK/PROPOSED/SENTINEL` source class；
- 本地 probe 的布尔结果与大小分类，不含原路径；
- position、trusted/player duration、state、active/last index、track role；
- event origin、requested/final reason、execute/reject/recover result 和 rejection code；
- repeat mode、schedule mode、schedule generation、deadline remaining 分类；
- allowlist 中的规范化 error code，不含可能嵌入路径或服务数据的原始 message。

logger 边界只接受 schema 对象，并在写入前执行字段 allowlist 与递归 sanitizer。完整 path、URI path/query、Authorization、Cookie、认证 token、请求 headers、原始插件返回对象和用户私有值不得进入 logger 参数。受影响链中记录 `localPath` 或完整 `track` 的旧 trace 调用必须改为 schema API。日志仍仅在应用本地或用户主动导出边界内。

## Testing Strategy

### Static Review Strategy — No Executable Testing

本节因 bugfix design 格式要求保留 `Testing Strategy` 标题，但本设计**没有执行型测试方法或任务**。不安排单元、属性、集成、UI/Android 黑盒、截图、概率复现、设备会话、序列生成、循环运行、类型检查、构建或 GitHub Actions 执行。也不要求先观察未修复 APK 才实施任何修复。

唯一验证方法是逐文件、逐入口、逐调用链和逐写入口的静态审查。Fix Checking 与 Preservation Checking 是逻辑审查义务，不代表可执行测试。

### Static Review Inputs

- `bugfix.md` 中 requirements 2.1–2.17 与 3.1–3.17。
- 修复前静态代码/资源事实与修复 diff。
- 每个 Correctness Property 下的 proof obligation 和 code paths。
- 自动 transition 入口 inventory、逻辑状态写入口 inventory、资源引用图和 route/params 对照表。
- 剩余风险清单与有界结论模板。

### Review Procedure

1. **范围审查**
   - 确认 diff 只覆盖设计列出的首页、启动、播放、类型与本地日志文件。
   - 确认没有下载器/解码器猜测性改写、测试文件、构建配置或 workflow 改动。

2. **逐文件所有权审查**
   - 为每个受影响文件记录其唯一 owner、可写状态和对外入口。
   - 首页证明一个竖向 owner；启动证明一个 handoff owner；播放证明一个 arbiter/executor owner。

3. **逐入口调用链审查**
   - 从每个 UI、系统事件、播放器事件、队列操作、音源异步结果和 timer callback 追踪到唯一最终决定。
   - 每条链记录输入分类、tuple/token 校验、reason、idempotency key、允许的 sink 和拒绝分支。

4. **逐写入口与旁路审查**
   - 枚举 current track atom、session state、native queue、native skip/reset、accepted end、exitApp 和 navigation dispatch 的全部写入口。
   - 证明每个写入口只由批准的 owner 调用；任何未分类引用都阻止静态审查闭合。

5. **资源路径审查**
   - 从 Manifest/theme 追踪到唯一 splash drawable。
   - 审查 vector path、stroke bounds、viewport/inset 和所有 animator/clip 引用，证明无可达几何裁切。
   - 从 app root 追踪到唯一 `BootstrapComponent` 品牌层及单向 handoff 状态。

6. **保持性静态差分**
   - 对 route/params、横屏组合、source fallback、repeat target、error config、显式控制、queue target、timer mode、日志 transport 和 workflow 文件做前后静态对照。
   - 新字段和拒绝诊断不得改变非 bug-condition 的可观察目标。

7. **风险与结论审查**
   - 保留设备合成器、特定媒体解码器、下载文件内部完整性和真实运行时竞态风险。
   - 不把候选根因升级为设备唯一根因，不把剩余风险扩展为无证据修改。
   - 结论只能使用：**“闭合已识别不安全路径并完成防御性修复”**。

### Per-Domain Static Evidence Ledger

| Domain | Entry/owner evidence | Required sink evidence | Preservation evidence |
|---|---|---|---|
| Portrait home | `Home` orientation branch → one `HomeBody` vertical list → header/data/footer; stable key; one text node; guarded callbacks | one `navigation.navigate` per accepted latch cycle | routes/params/order, horizontal branch and unrelated entries unchanged |
| System splash | Manifest → theme → dedicated complete vector; no trim/clip/mask; positive static inset | one idempotent native hide controlled by forward-only handoff | brand path/color/background and launcher assets unchanged |
| App launch surface | root → one `BootstrapComponent` → one contain image; one-way visible state | `APP_SURFACE -> HOME` only, pointer passthrough | visual time bound, text and reduced-motion semantics retained |
| Local source | play/restore/replay → local resolver before plugin → tuple compare → source apply | one source application helper with revision increment/tagging | no-valid-local branch retains existing fallback order |
| Automatic transition | every row in reachable transition inventory → candidate → arbiter | only executor may commit logical next/replay/stop/exit | accepted natural end/error behavior reuses existing target/config |
| Explicit/queue transition | every app/remote/queue entry → typed reason + command id → arbiter | executor once; no natural-end proof imposed | immediate command and queue target semantics retained |
| Schedule | UI set/replace/cancel → controller token/deadline → due candidate | one consumed `TIMER_EXPIRED_STOP`; no raw PlayEnd/reset bypass | existing deadline and two close modes retained |
| Diagnostics | each source/event/decision producer → schema/sanitizer → local logger | allowlisted local record only | no remote telemetry; existing user-controlled export boundary retained |

### Logical Fix Checking

```text
FOR ALL input WHERE isBugCondition(input) DO
  LOCATE every reachable entry for input in F'
  TRACE entry through required owner, validity checks, and final decision
  ASSERT the corresponding Correctness Property proof obligation is closed
  ASSERT no reachable write bypass exists
END FOR
```

针对概率跳曲，静态审查枚举并闭合所有可达自动推进入口；它不声称执行过复现，也不根据未运行的结果宣称现象百分之百消失。

### Logical Preservation Checking

```text
FOR ALL input WHERE NOT isBugCondition(input) DO
  COMPARE affected branch, target selection, and observable sink in F and F'
  ASSERT observable_behavior(F(input)) = observable_behavior(F'(input))
  ASSERT new metadata/diagnostics do not alter the observable result
END FOR
```

### Static Completion Criteria

设计对应的实现仅在以下静态条件全部满足时可完成审查：

1. Properties 1–11 的每个 proof obligation 都有精确文件、symbol 和调用链记录。
2. 首页布局、文本、导航，启动资源/handoff，以及播放 source/session/transition/timer/logging 的全部已识别入口均到达唯一 owner。
3. 所有逻辑曲目、native queue/skip/reset、accepted end、timer exit 和导航写入口均已分类，不存在可达旁路。
4. 保持性对照覆盖 requirements 3.1–3.17，且下载器、解码器和 workflow 没有猜测性语义改写。
5. 当前完成条件中不存在本地构建、GitHub Actions 触发、APK、类型检查、执行型测试、设备证据、概率或重复次数要求。
6. 剩余风险被明确保留，事实与候选根因边界未被改写。
7. 审查结论严格限定为：**“闭合已识别不安全路径并完成防御性修复”**。
