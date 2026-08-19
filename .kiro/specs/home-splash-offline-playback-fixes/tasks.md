# Implementation Plan

## Overview

本计划仅包含业务代码/资源改动与最终静态代码审查。唯一完成证据是可定位的源码、资源引用、调用链、写入口和 `git diff` 记录；不增加或执行运行型验收，不生成构建产物，不触发或修改 GitHub Actions workflow。若用户未来另行要求构建，只沿用现有 GitHub Actions workflow，且该未来动作不属于本计划完成条件。任务按依赖顺序执行，后续任务必须复用前序任务建立的 owner、tuple、candidate 与 executor 边界。

## Tasks

- [x] 1. 统一竖屏首页布局、条目 identity、文本层与导航所有权
  - 将 `src/pages/home/components/homeBody/index.tsx` 的竖屏内容改由单一 `FlashList` 持有：header 按既有顺序组合 `ContinueListening`、`RecentlyPlayed` 和常用歌单 header/tab，data 只承载歌单行，footer 承载 `Operations`；移除外层 `ScrollView` 与同轴内层列表的双重竖向所有权，所有 section/row/footer 留在正常布局流中。
  - 从 `sheets.tsx` 提取不持有滚动容器的歌单 header、row 和数据模型供竖屏 owner 与既有横屏组合复用；歌单列表级 key 固定为规范化 `platform + id`，快捷入口 key 固定为 action id 或 route，禁止使用 index、标题、翻译文本、tab 或回收位置。
  - 将 `ActionButton.tsx` 收敛为一个稳定 pressable 和一个 `ThemeText`；移除承载标签的 entering/exiting 动画层，按压反馈仅改变单层颜色、背景或透明度，不改变几何、层级或命中范围。快捷区使用自身布局盒、`flex: 1` 与 `minWidth: 0`，不以负 margin、绝对定位或重叠 hit rect 掩盖边界。
  - 新增 `src/pages/home/hooks/useHomeNavigationLatch.ts`，在首页 focused 且本轮离开动作尚未被接受时同步锁定并提交一次既有 `navigate(route, params)`；失焦期间保持锁定，返回并重新获得 focus 后解锁，不使用时间 debounce。将“我喜欢”和四个快捷入口全部迁移到该门闩。
  - 保持 `ContinueListening -> RecentlyPlayed -> 常用歌单 -> 快捷入口` 的信息顺序、纵向滚动、五个入口的既有 route/params/back 行为，以及 `HomeBodyHorizontal` 的信息结构和交互语义。
  - **静态完成条件**：从 `Home` 的 portrait 分支可追踪到唯一竖向 owner；每个复用条目都有稳定业务 key；五个入口各只有一个文本节点且全部经过同一 focus/transition latch；不存在这五个入口直达 `navigation.navigate` 的旁路；横屏分支、信息顺序、route 和 params 的差分无语义变化。
  - _Design: Correctness Property 1 (Home Single Ownership, Stable Identity, and Navigation); Property 2 (Preservation)_
  - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3, 3.17_

- [x] 2. 使用完整专用 splash 资源并建立单调启动交接
  - 新增 `android/app/src/main/res/drawable/echomusic_splash_icon.xml`，复用既有完整品牌 path/color，在 `108 x 108` viewport 中围绕 `(54,54)` 等比缩放并保留 stroke-inclusive 正安全边距；在资源或审查记录中保留设计给出的 bounds/inset 计算，不改变品牌轮廓、比例或视觉中心。
  - 令 `styles.xml` 的 `windowSplashScreenAnimatedIcon` 直接引用该完整 vector；删除可达的 `echomusic_splash_animated.xml` 与 `echomusic_splash_trace.xml`，且系统 splash 引用图中不保留 `trimPathStart`、`trimPathEnd`、clip、mask 或以缺失路径制造动画的资源。launcher 与通知图标保持不变。
  - 在 `BootstrapComponent.tsx` 中让唯一品牌 `Image` 显式使用 `contain`、正方形内容盒与透明 safe inset；将品牌内容和 shadow/圆角背景分层，内容层不成为 clip owner。脉冲/淡出只能作用于容纳完整图标的安全容器，不创建第二个品牌内容层。
  - 新增 `launchHandoff.ts` 作为唯一状态 owner，只允许 `SYSTEM -> APP_SURFACE -> HOME` 向前转换；完整 app surface ready 后幂等隐藏 native splash，有界 fallback 也只能向前推进，已退出 surface 不因 loading/error/retry 重新出现。
  - 保持 `pointerEvents="none"`、既有 1200ms 视觉上限与 260ms 淡出、背景/文案/视觉中心及 reduced-motion 语义；首页可见后启动层不得拦截输入。
  - **静态完成条件**：Manifest → theme → drawable 引用图只到达完整专用 vector，资源中可计算出四边正 inset 且无几何裁切链；React root 只到达一个 contain 品牌层，shadow 与内容 owner 分离；native hide 和 surface 可见性只由 forward-only handoff owner 改变；pointerEvents 与既有视觉时限未改变。
  - _Design: Correctness Property 3 (Complete Splash Geometry and Monotonic Handoff); Property 2 (Preservation)_
  - _Requirements: 2.3, 2.4, 3.4, 3.5, 3.6, 3.17_

- [ ] 3. 建立播放 session/source revision 基础模型与统一本地音源解析
  - 新增 `playbackSession.ts` 并同步 `src/core.defination/trackPlayer/index.ts`、`src/types/core/trackPlayer/index.d.ts`：定义 `sessionId`、单调 `generation`、`sourceRevision`、匿名 `trackKey`、terminal reservation、accepted ids、同 revision progress/trusted duration 和 bounded recovery 状态。
  - 新逻辑选曲或同曲重新开始时创建 session 并递增 generation；暂停、恢复和同会话 seek 不创建 session。为 Content、Sentinel、Proposed/real source 写入内部 tuple/tag：`sessionId + generation + sourceRevision + trackKey + role`，不污染持久业务对象。
  - 新增 `localPlaybackSource.ts` 作为 `setupTrackPlayer`、play、restore/replay 和质量/音源替换共用的 resolver：规范化 absolute path、`file://` 与 `content://`，确认可解析、存在、可读、size > 0，并把正有限且来源可追踪的时长绑定到当前 source revision；探测失败只返回分类结果，不删除持久 localPath。
  - 在 TrackPlayer 顶层先执行本地 resolver，再进行插件获取、缓存、替代插件或网络解析；命中完整本地文件时短路后续链，未命中时完整保留现有 fallback 顺序、网络策略与错误策略。
  - 收敛 native source application helper：每次 proposed/real/quality/recovery queue 写入前递增 revision 并写入 tag；每个异步 closure 捕获完整 tuple，在每次 `await` 后及任何 queue/current state 写入前比较当前 tuple，不让旧结果覆盖新 session 或 revision。
  - **静态完成条件**：所有播放/恢复/换源入口都先到达同一个本地 resolver；插件缺失不能绕过本地文件；所有异步音源结果在生效前有 tuple compare-and-set；所有 native queue source 写入都由唯一 helper 递增并标记 revision；无有效本地文件分支仍调用原 fallback，downloader、文件管理和 codec 集成无猜测性修改。
  - _Design: Correctness Property 4 (Complete Local File First and Fresh Source Application); Property 2 (Preservation)_
  - _Requirements: 2.5, 3.7, 3.13, 3.14, 3.17_

- [ ] 4. 建立 transition candidate/arbiter/executor 并迁移全部自动推进写入口
  - 新增 `playbackTransition.ts`，定义带 `eventId`、idempotency key、monotonic sequence、Session_Tuple、track role、origin、requested reason、position/duration/state、queue/schedule snapshot 和 error class 的 `TransitionCandidate`，以及显式的 final reason/rejection code。
  - 实现唯一 `submitTransition` arbiter：先去重，再核对当前 tuple，再检查自动候选证据与 terminal reservation；`UNKNOWN`、证据不足、旧 tuple、重复事件或重复终止决定只能拒绝或执行同曲有界恢复，不能选择后续曲目。
  - 实现唯一 `Transition_Executor`，使逻辑 current-track commit、自然结束 replay/next、错误策略 stop/next、合法 queue-current replacement、timer stop/exit 只能由 executor 执行；same-identity metadata 更新独立且不得改写逻辑 identity，native `setQueue` 仍只属于任务 3 的 source helper。
  - 按 design 的 reachable transition inventory 枚举并迁移 `PlaybackActiveTrackChanged`、`PlaybackState`、`PlaybackQueueEnded`、source mutation side effects、自动恢复、startup restore/autoplay、source-policy stop、播放/source error、队列副作用与 timer effect：每个入口先生成 typed candidate，再进入 arbiter；错误与定时器候选先接入统一边界，其专属归属/消费规则分别在任务 5、6 完成。
  - 将 Sentinel 激活降级为终止候选。集中实现自然结束合取谓词：Content identity、session、generation、source revision 全部一致；position 属于同 tuple 且接近正有限、不冲突的 Trusted_Duration；同 revision 终止信号存在；事件不只由 source mutation 造成；terminal reservation 尚为空。Stopped、占位/哨兵激活、缺失/冲突时长或远离时长的位置均不得单独推进。
  - 只有被 arbiter 接受的 `NATURAL_END` 才复用既有 repeat/shuffle/queue 目标算法并在 terminal gate 关闭后发出一次 accepted-end 通知；原始 active-track/sentinel 事件不得直接发出 `PlayEnd`、replay 或 next。恢复同一逻辑曲目时限制为每 revision 一次，后续不足证据事件保持曲目标识并停止继续恢复。
  - **静态完成条件**：inventory 中每个自动 producer 都有 candidate origin、tuple/tag、idempotency key、允许 sink 和拒绝分支；所有自动逻辑曲目变化都经 `submitTransition -> Transition_Executor`；自然结束是单一合取谓词且“约 2 分钟”未成为常量或分支；旧、重复、UNKNOWN 和证据不足路径没有 next/current-track mutation sink。
  - _Design: Correctness Property 5 (One Transition Arbiter and No Automatic-Advance Bypass); Property 6 (Natural End Evidence); Property 2 (Preservation)_
  - _Requirements: 2.6, 2.7, 2.8, 2.14, 3.8, 3.17_

- [ ] 5. 收敛错误归属、显式 app/remote 控制与合法队列变化原因
  - 在 native `PlaybackError` 到达时立即捕获 immutable Session_Tuple、native tag/index/role/state 和 error id；`INVALID_SOURCE` 也生成同模型 candidate。若保留短延迟，closure 必须携带原 tuple，并在执行前对当前 tuple、terminal reservation 与 idempotency key 做 compare-and-set。
  - 仅当前 Content_Track 的同 session/generation/source revision 真实错误可按既有 `basic.autoStopWhenError` 提交一次 `PLAYBACK_ERROR_POLICY`；旧、sentinel/proposed、重复或无法归属错误只记录拒绝，不得改变当前曲目。移除 `handlePlayFail` 等延迟后直接 next 的旁路。
  - 为 public play/select/previous/next/stop API 增加内部 typed origin 与 command id；迁移音乐详情按钮、迷你播放器手势、列表直接选择及其他 app 入口为 `USER_*`，迁移 `RemoteNext/RemotePrevious/RemoteStop` 为 `REMOTE_*`，相同 command id 只提交一次且不要求自然结束证据。
  - 将 remove-current、replace、clear、reorder、add-to-empty 与 queue-current replacement 迁移为带子原因的 `QUEUE_CHANGE` candidate；保留现有 `getPlayListMusicAt`、single-repeat、shuffle 和 queue target 算法，不把队列变化标成自然结束、播放错误或 UNKNOWN。
  - 将 app exit、显式 clear stop、remote stop 和 source-policy stop 接到 typed executor reason；暂停、恢复、seek、rate 与 same-identity metadata enrichment 保持非逻辑曲目转换语义。
  - **静态完成条件**：native error 与 invalid-source 调用链都在到达 executor 前完成同 tuple 归属和幂等检查；所有 app/remote 选曲、上一曲、下一曲和 stop 入口都有明确 origin/command id；所有合法队列 current 变化都有 `QUEUE_CHANGE` 子原因；既有目标选择与 error config 仍是最终语义来源，任何拒绝分支均无逻辑曲目写入口。
  - _Design: Correctness Property 7 (Playback Error Attribution and Idempotence); Property 8 (Explicit Controls and Legal Queue Changes); Property 2 (Preservation)_
  - _Requirements: 2.9, 2.10, 2.11, 3.8, 3.9, 3.11, 3.12, 3.17_

- [ ] 6. 用 schedule token/deadline 和一次性 after-current 消费收敛定时关闭
  - 重构 `scheduleClose.ts` 为唯一 schedule controller：每次 set/replace/cancel 都递增 token，清理旧 timeout/pending waiter，并存储 `{token, absoluteDeadline, mode, consumed}`；所有 timing-close UI 调用只进入该 controller。
  - callback 使用 captured token 重新读取当前计划和 wall clock：旧 token、取消、已消费或重复 callback 不产生播放作用；`now < deadline` 时仅按剩余时间重新安排；到期 immediate 模式原子 consume 后提交带 timer idempotency key 的 `TIMER_EXPIRED_STOP`。
  - after-current 模式到期时只标记当前 token 已 armed，不监听裸 `PlayEnd`。任务 4 的 arbiter 在接受同 tuple 自然结束、预留 terminal decision 之前重新读取 token/mode/deadline；若当前且到期且未消费，则原子转换为一次 `TIMER_EXPIRED_STOP(trigger=NATURAL_END)` 并抑制普通 next，否则保留普通 `NATURAL_END`。
  - 将 pause/reset/exit 统一放入 typed stop executor，schedule controller 不直接改变 current track、调用普通 next 或执行 `exitApp`；旧、提前和重复 callback 没有 pause/reset/exit/next sink。
  - 保持 10/20/30/45/60 分钟、自定义、取消、立即关闭和“当前歌曲播放完成后关闭”的既有选择与 deadline 语义。
  - **静态完成条件**：set/replace/cancel/callback 全部可追踪到当前 token 与 absolute deadline 检查；after-current 只消费任务 4 已接受的同会话自然结束并与普通 next 共享一个 terminal reservation；不存在 schedule 使用 raw `PlayEnd` listener、伪装普通 next 或绕过 executor 直接 reset/exit 的路径；各既有模式的用户目标未改变。
  - _Design: Correctness Property 9 (Schedule Token, Deadline, and One Close Decision); Property 6 (Natural End Evidence); Property 5 (One Arbiter); Property 2 (Preservation)_
  - _Requirements: 2.6, 2.7, 2.8, 2.12, 3.10, 3.17_

- [ ] 7. 建立有序、结构化且脱敏的本地诊断边界
  - 新增 `playbackDiagnostics.ts` 白名单 schema 与 monotonic sequence，覆盖 source resolution、transition candidate、natural-end decision、error、explicit control、queue change、schedule callback 和 final execute/reject/recover；记录可关联的 session/generation/source revision、匿名 track hash、origin/reason、position/duration、timer 状态及结果分类。
  - 在 `src/utils/log.ts` 的 logger 边界只接受 schema 对象，写入前执行字段 allowlist 与递归 sanitizer；本地 URI/path 只记录 probe 布尔值与 size/source 分类，error 只记录规范化 allowlisted code。
  - 替换 `trackPlayer/index.ts`、`plugin.ts`、`scheduleClose.ts`、`service/index.ts` 中会把完整 `localPath`、URI 路径/query、headers/cookie/token、原始 track、原始插件对象或私有 error message 传给 trace 的受影响调用；敏感值必须在调用 logger 前完成省略或脱敏。
  - 复用现有本地日志与用户主动复制/导出 transport，不新增远程遥测，不改变用户控制的导出边界。
  - **静态完成条件**：每类 source/event/decision producer 都映射到同一 schema API；字段可按 monotonic sequence 和 tuple 关联；受影响调用链不存在完整路径、凭据、原始 track/plugin object 的 logger 参数或 raw-object fallback；日志 transport diff 不包含新网络出口。
  - _Design: Correctness Property 10 (Ordered and Redacted Structured Diagnostics); Property 2 (Preservation)_
  - _Requirements: 2.13, 3.15, 3.17_

- [ ] 8. 完成逐入口、逐调用链、逐资源引用和逐写入口的静态 evidence ledger
  - 在规格目录记录最终静态 evidence ledger；每一行至少包含 requirement/property、入口或 producer、文件与 symbol、owner、tuple/token/focus 校验、typed reason、idempotency key、允许 sink、拒绝分支及 preservation 对照。覆盖首页五个入口、系统与应用内 splash、全部 source 入口、design transition inventory 的每一行、错误、显式控制、队列操作、schedule 和 diagnostics。
  - 沿 Manifest/theme/drawable 建立系统资源引用链，沿 React root/handoff 建立应用内启动链；沿每个 UI/system/player/timer producer 建立到 arbiter/executor 的调用链；枚举 navigation dispatch、logical current-track、session state、native queue/skip/reset、accepted end 和 timer exit 的全部写入口并为每个入口指定唯一批准 owner。
  - 使用 repository 源码搜索确认不存在以下可达旁路：executor 外的自动 `skipToNext`/后续目标选择；executor 外的逻辑 current-track identity 写入；source helper/executor 外未分类的 native `setQueue/skip/reset`；原始 active-track 直接发出 `PlayEnd`；schedule 裸 `PlayEnd` listener 或直接 pause/reset/exit/next；五个首页入口绕过 navigation latch。对 same-identity metadata、显式命令和 source application 例外逐项记录其分类依据。
  - 使用 `git diff` 做保持性静态审查：逐项对照首页信息顺序、route/params/back、横屏结构、品牌 path/color/background、pointerEvents/视觉时限、无本地文件 fallback、repeat/shuffle target、error config、显式控制、queue target、timer mode 与本地日志 transport；确认 downloader、codec 集成、launcher/通知图标和 `.github/workflows/android-ci.yml` 无猜测性语义改动。
  - 将设备合成器、特定媒体解码器、下载文件内部完整性和真实运行时竞态记录为剩余风险，不据此扩展修改，也不把候选根因写成唯一已证实根因。
  - **静态完成条件**：Properties 1–11 与 requirements 2.1–2.17、3.1–3.17 均有精确文件/symbol/调用链证据；inventory 与写入口清单无未分类项；保持性 diff 与未改范围有记录；剩余风险完整保留。最终结论只能写为“闭合已识别不安全路径并完成防御性修复”，不得作真实设备现象百分之百消失的声明。
  - _Design: Correctness Properties 1–11; Static Completion Criteria_
  - _Requirements: 2.1–2.17, 3.1–3.17_
## Notes

- 本计划不以测试或构建为前置条件；不得新增或执行运行型测试/验收，不得执行本地或 CI 构建，不得生成构建产物，也不得触发或修改任何 GitHub Actions workflow。完成判定仅依据任务 8 定义的静态 evidence ledger、源码/资源引用、调用链、写入口与 `git diff` 记录。
- 若未来确需构建，只能由用户另行明确触发现有 GitHub Actions workflow；该动作不属于本计划、任何任务或完成条件，本计划本身不触发 workflow。
- 最终结论边界保持为“闭合已识别不安全路径并完成防御性修复”；不得据此宣称真实设备现象已百分之百消失，也不得把候选根因表述为唯一已证实根因。
- 剩余风险继续包括设备/模拟器差异、特定媒体解码器行为、下载文件内部完整性及真实运行时竞态；这些风险仅记录于静态 evidence ledger，不据此扩展修改范围或新增执行型验证任务。