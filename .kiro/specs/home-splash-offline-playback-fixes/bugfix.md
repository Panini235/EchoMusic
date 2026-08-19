# Bugfix Requirements Document

## Introduction

本规格定义三个相互独立但一并交付的缺陷目标：修复竖屏首页交互后偶发的元素重叠与文字重影；保证系统启动画面和应用内启动承接画面的品牌图标完整且不被裁切；修复离线播放完整本地文件并启用 45 分钟定时关闭时，歌曲在自然结束前约 2 分钟概率性切换到下一曲的问题。三个目标共享同一回归原则，但不得被归并为同一根因。

本次采用**完整代码结构、事件链和资源路径的静态审查**指导修复并作为唯一验收证据。静态审查需要逐项闭合首页布局与导航路径、系统与应用内启动资源路径、本地音源解析路径、全部自动切曲事件路径、自然结束证据链、错误与显式控制路径、队列变化路径、定时器路径以及日志脱敏路径。本次不安排或要求单元测试、属性测试、集成测试、Android 黑盒测试、概率复现会话、截图矩阵或设备验收，也不设置任何运行次数、序列数量、设备配置数量或会话数量要求。本文中的“Fix Checking”和“Preservation Checking”是供代码审查使用的逻辑性质，不代表属性测试或其他可执行测试任务。

本次不在本地构建，也不以触发构建、类型检查、测试或 GitHub Actions workflow 作为规格完成前置条件。若用户未来另行决定生成应用构建，仍只允许使用 GitHub Actions workflow；该未来选择不属于本次 requirements 阶段的完成条件。

事实与假设必须保持分离。现有系统启动资源对品牌主路径使用从不完整值开始的 `trimPath` 裁切动画，因此动画开始和中间阶段不包含完整品牌几何；这是静态代码与资源可直接确认的问题。首页偶发重叠/文字重影以及约 2 分钟概率跳曲是用户报告的真实设备现象，但其具体根因仍属于候选假设；静态审查可以识别并消除不安全代码路径，却不能证明某个候选就是设备现象的唯一原因。现有静态事件链也不能支持“45 分钟定时器在约 2 分钟直接调用下一曲”这一结论，除非未来出现新的运行证据。

静态审查完成后不得宣称真实设备上的首页现象或概率跳曲已被百分之百证明消失。剩余风险明确包括设备合成器行为、特定媒体解码器行为和仅在真实运行时出现的竞态。可作出的结论仅限于：已识别的不安全代码路径已经闭合，要求的防御性不变量已经由可追踪的代码审查证据建立。

本规格以 `F` 表示修复前行为，以 `F'` 表示修复后行为。“完整本地文件”指下载状态已完成、本地 URI 可解析、目标存在且可读、文件大小大于零，并具有可用于当前会话的可信媒体时长。“自然播放结束证据”指当前内容曲目的结束候选同时携带当前位置、可信时长、当前播放会话标识、会话代数和音源修订版本，并且位置接近时长且终止状态属于同一会话。“显式切歌”指用户在应用内选择歌曲或点击上一曲/下一曲、系统媒体控制发出上一曲/下一曲命令，或者队列编辑明确移除或替换当前曲目。“过早曲目切换”指在没有自然播放结束证据、显式切歌、同一会话已确认的错误策略、合法队列变化或已到期定时关闭语义时，当前逻辑曲目标识发生变化。

```pascal
FUNCTION isHomeBugCondition(X)
  INPUT: X of type HomeInteractionInput
  OUTPUT: boolean

  RETURN X.orientation = PORTRAIT
    AND X.homeIsStable = true
    AND X.target IN {MY_FAVORITES, RECOMMENDED_PLAYLISTS, TOP_LIST,
                     PLAY_HISTORY, LOCAL_MUSIC}
    AND X.phase IN {PRESS, RELEASE, NAVIGATION_TRANSITION, RETURN_TO_HOME}
END FUNCTION

FUNCTION isSplashBugCondition(X)
  INPUT: X of type ColdStartInput
  OUTPUT: boolean

  RETURN X.isColdStart = true
    AND X.stage IN {SYSTEM_SPLASH, APP_LAUNCH_SURFACE, HANDOFF_TO_HOME}
    AND X.deviceConfiguration IN SUPPORTED_ANDROID_CONFIGURATIONS
END FUNCTION

FUNCTION isOfflinePlaybackBugCondition(X)
  INPUT: X of type PlaybackTransitionInput
  OUTPUT: boolean

  RETURN X.network = OFFLINE
    AND X.completeLocalFileAvailable = true
    AND X.queueHasFollowingTrack = true
    AND X.scheduleCloseDuration = 45_MINUTES
    AND X.scheduleCloseDeadline > X.now
    AND X.candidateRequestsAutomaticTrackChange = true
    AND X.explicitTransition = false
    AND X.intentionalQueueChange = false
    AND X.confirmedSameSessionPlaybackError = false
    AND X.evidencedNaturalEnd = false
END FUNCTION

FUNCTION isBugCondition(X)
  INPUT: X of type HomeInteractionInput OR ColdStartInput OR PlaybackTransitionInput
  OUTPUT: boolean

  RETURN isHomeBugCondition(X)
    OR isSplashBugCondition(X)
    OR isOfflinePlaybackBugCondition(X)
END FUNCTION
```

## Bug Analysis

### Current Behavior (Defect)

以下条款区分可观察缺陷、可直接确认的实现事实和候选根因。除 `trimPath` 裁切外，不把任何首页布局机制、设备合成行为、音源选择、播放器事件、错误、队列变化或定时器路径写成已证实根因。

1.1 WHEN 竖屏首页稳定显示且用户点击“我喜欢”入口 THEN the system 偶发将“我喜欢”的图标或卡片内容与其下方“推荐歌单”“榜单”“播放历史”“本地音乐”快捷入口显示为相互重叠的布局；该真实设备现象已由用户报告，但具体触发机制仍未由静态证据唯一确认

1.2 WHEN 用户点击“推荐歌单”“榜单”“播放历史”或“本地音乐”任一快捷入口 THEN the system 偶发在按压、页面切换或返回首页期间显示重复、残留或错位的标签字形，形成文字重影；布局所有权、元素 identity 和合成层交互仅作为候选根因，不作为已证实事实

1.3 WHEN 应用冷启动并显示系统启动画面或应用内启动承接画面 THEN the system 可能显示左右内容不完整的品牌图标；其中系统启动资源的 `trimPath` 动画会在开始和中间阶段主动只绘制部分品牌路径，这是可由现有资源直接确认的缺陷，而应用内画面是否还受设备裁切或合成影响仍是假设

1.4 WHEN 设备离线、完整本地文件可用、播放队列存在下一曲、45 分钟定时关闭尚未到期且不存在显式切歌、合法队列变化或已确认同会话播放错误 THEN the system 被用户报告会在单曲播放约 2 分钟且明显早于自然结束时概率性自动切换到下一曲；约 2 分钟是现象描述而不是允许硬编码的判断阈值

1.5 WHEN 自动切曲候选来自音源异步解析、活动曲目变化、结束状态、播放错误、自动恢复、队列变化或定时器回调且事件发生重复、延迟或乱序 THEN the system 现有静态事件链不能保证每次候选均以当前 session、generation 和 source revision 完成归属，也不能保证每次实际曲目变化都具有唯一且证据充分的最终原因

### Expected Behavior (Correct)

以下条款同时定义修复行为和静态审查完成标准。验收证据必须能从入口沿代码结构、事件链或资源引用追踪到唯一结果，不依赖构建、测试、截图、概率统计或设备运行结果。

2.1 WHEN `isHomeBugCondition(X)` 为真 THEN the system SHALL 让竖屏首页由单一纵向布局所有者按确定顺序拥有全部相关内容，为每个可复用条目提供基于业务标识的稳定 identity，并使“我喜欢”区域与四个快捷入口在正常布局流中具有唯一且不相交的所有权边界

2.2 WHEN 用户对“我喜欢”或任一快捷入口发起一次有效交互 THEN the system SHALL 为每个入口仅保留一个稳定文本层，并通过与当前焦点/转场关联的防重复机制恰好提交一次既有导航；按压、释放、转场和返回路径不得创建标签副本、重复导航或激活相邻入口

2.3 WHEN `isSplashBugCondition(X)` 为真 THEN the system SHALL 使系统启动资源与应用内启动资源在其每个可达显示状态都包含完整、未变形且居中的既有品牌几何，并 SHALL NOT 使用 `trimPath`、clip-path、遮罩、溢出裁切或任何会令品牌路径在动画阶段不完整的效果

2.4 WHEN 系统启动画面交接到应用内启动承接画面或首页 THEN the system SHALL 保持完整品牌几何、既有背景与视觉中心连续，只允许一个单调退出且不拦截首页输入的启动承接路径，不得重新显示已退出的覆盖层或创建第二个品牌内容层

2.5 WHEN 离线播放请求对应一个可解析、存在、可读且大小大于零的完整本地文件 THEN the system SHALL 在插件、缓存、替代源或网络解析之前优先选择规范化本地 URI，并在异步结果应用前确认其仍属于当前 session、generation 和 source revision

2.6 WHEN 任一自动切曲入口产生候选 THEN the system SHALL 使该候选统一经过单一仲裁边界，并携带当前 session、generation、source revision、事件来源和幂等标识；所有活动曲目变化、结束事件/状态、错误恢复、自动队列推进和定时器相关路径均不得绕过该边界直接改变当前逻辑曲目

2.7 WHEN 自动切曲候选声称当前曲目已自然结束 THEN the system SHALL 仅在当前位置接近可信时长、结束状态或结束事件属于当前内容曲目，且 session、generation 和 source revision 全部一致时接受 `NATURAL_END`；单独的活动索引变化、占位/哨兵激活、停止状态或远离时长的位置不得作为充分证据

2.8 WHEN 自动切曲候选缺少自然结束证据、属于旧 session/generation/source revision、重复到达或原因不明 THEN the system SHALL 将其拒绝或限定为保持/恢复当前曲目的防御性处理，不得由该候选单独推进下一曲，并且同一会话的终止决定最多执行一次

2.9 WHEN 当前内容曲目产生可归属于同一 session、generation 和 source revision 的真实播放错误 THEN the system SHALL 按既有“错误时停止或自动下一曲”配置执行一次处理；旧会话、占位/哨兵、重复或无法归属的错误不得改变当前曲目

2.10 WHEN 用户或系统媒体控制显式选择歌曲、上一曲或下一曲 THEN the system SHALL 保持既有即时控制语义和目标选择逻辑，同时为请求记录明确来源并防止同一命令重复提交；显式控制不得被错误地要求提供自然结束证据

2.11 WHEN 用户执行合法队列编辑、移除当前曲目或替换播放队列 THEN the system SHALL 保持既有队列变化语义，以明确的 `QUEUE_CHANGE` 类原因完成一次仲裁，并不得把队列变化误记为自然结束、播放错误或未知自动切曲

2.12 WHEN 定时关闭被设置、替换、取消或触发 THEN the system SHALL 使用与当前计划绑定的 token 和绝对 deadline 在回调执行时重新确认有效性；旧 token、提前回调、已取消回调或重复回调不得暂停、重置、退出或切换当前曲目，到期后的“立即关闭”与“当前歌曲播放完成后关闭”仍须保持既有语义且不得伪装成普通下一曲

2.13 WHEN 系统记录音源选择、自动切曲候选、自然结束、播放错误、显式控制、队列变化、定时器回调或最终仲裁决定 THEN the system SHALL 提供可按单调顺序关联 session、generation、source revision、匿名曲目标识、来源分类、位置/时长、定时器状态、候选来源和执行/拒绝结果的结构化证据，并 SHALL 省略或脱敏完整本地路径、URI 路径部分、认证头、cookie、令牌、原始插件返回对象和其他用户隐私数据

2.14 WHEN 修复实现提交审查 THEN the system SHALL 通过完整代码结构、事件链与资源路径审查证明 2.1 至 2.13 的每个入口均可追踪到唯一所有者、有效性检查和最终决定，并证明不存在绕过这些不变量的可达业务路径

2.15 WHEN 本规格判断修复是否满足完成标准 THEN the system SHALL 仅采用 2.14 所述静态代码审查证据，且 SHALL NOT 安排或要求单元测试、属性测试、集成测试、Android 黑盒测试、概率复现会话、截图矩阵、设备验收或任何指定数量的重复运行

2.16 WHEN 用户未来另行决定生成应用构建 THEN the system SHALL 仅通过 GitHub Actions workflow 生成构建，且本规格当前完成 SHALL NOT 以本地构建、触发 workflow、生成 APK、运行类型检查或执行任何测试为前置条件

2.17 WHEN 静态审查结论被记录 THEN the system SHALL 将结论限定为“已消除审查中识别的不安全代码路径并完成防御性修复”，且 SHALL NOT 宣称静态审查已百分之百证明真实设备上的首页重叠/文字重影或约 2 分钟概率跳曲消失；结论必须保留设备合成器、特定媒体解码器和真实运行时竞态尚未被验证的风险

```pascal
// Logical Property: Fix Checking - Home (static review obligation, not a test)
FOR ALL X WHERE isHomeBugCondition(X) DO
  result ← F'(X)
  ASSERT one_portrait_layout_owner(result)
  ASSERT stable_business_identity(result)
  ASSERT exactly_one_text_layer_per_entry(result)
  ASSERT at_most_one_navigation_commit_per_valid_action(result)
END FOR

// Logical Property: Fix Checking - Splash (static review obligation, not a test)
FOR ALL X WHERE isSplashBugCondition(X) DO
  result ← F'(X)
  ASSERT every_launch_resource_contains_complete_brand_geometry(result)
  ASSERT no_geometry_clipping_animation(result)
  ASSERT launch_handoff_is_single_and_monotonic(result)
END FOR

// Logical Property: Fix Checking - Offline Playback (static review obligation, not a test)
FOR ALL X WHERE isOfflinePlaybackBugCondition(X) DO
  result ← F'(X)
  ASSERT complete_local_file_is_resolved_first(result)
  ASSERT every_automatic_transition_passes_session_arbiter(result)
  ASSERT natural_end_requires_position_duration_and_same_session_evidence(result)
  ASSERT stale_or_unknown_candidate_cannot_advance_track(result)
  ASSERT timer_callback_requires_current_token_and_due_deadline(result)
  ASSERT diagnostic_fields_are_redacted(result)
END FOR
```

静态代码路径闭合清单如下；每一项只接受可定位的代码/资源引用和调用链证据，不接受运行次数或设备结果替代：

- [ ] **首页闭合（2.1–2.2）**：竖屏首页只有一个布局所有者；所有可复用条目具有稳定业务 identity；每个入口只有一个文本层；一次交互只有一个导航提交点。
- [ ] **启动闭合（2.3–2.4）**：系统与应用内资源都引用完整品牌几何；不存在裁切几何的动画或容器；系统、应用内承接层和首页形成单调交接。
- [ ] **本地源闭合（2.5）**：完整本地文件分支先于缓存、插件与网络分支；异步源结果受 session、generation 和 source revision 约束。
- [ ] **自动切曲闭合（2.6–2.8）**：所有自动切曲入口均进入同一仲裁边界；自然结束拥有位置、时长和同会话证据；旧、重复或未知候选无法推进曲目。
- [ ] **既有语义闭合（2.9–2.12）**：真实错误、显式控制、合法队列变化和定时关闭各自保留原语义及唯一原因；定时器旧回调受 token/deadline 阻断。
- [ ] **诊断闭合（2.13）**：仲裁证据可关联且按序；敏感路径、凭据和用户数据在进入日志前完成省略或脱敏。
- [ ] **结论闭合（2.14–2.17）**：无测试与构建前置条件；未来构建仅限 GitHub Actions；审查结论明确剩余设备与运行时风险，不作百分之百消失声明。

当前缺陷与正确行为的追踪关系为：`1.1 → 2.1, 2.2`；`1.2 → 2.1, 2.2`；`1.3 → 2.3, 2.4`；`1.4 → 2.5–2.12`；`1.5 → 2.6–2.13`。流程与结论约束由 `2.14–2.17` 横向约束全部缺陷。

### Unchanged Behavior (Regression Prevention)

以下条款界定非缺陷输入和必须保留的既有语义。新增的静态不变量只约束缺陷路径，不得扩大为首页重设计、品牌更换、播放器策略重写或交付流程变更。

3.1 WHEN 用户浏览首页但未触发缺陷入口交互 THEN the system SHALL CONTINUE TO 显示既有的继续聆听、最近播放、常用歌单、快捷入口、迷你播放器和底部控制区域，并保持既有内容顺序与滚动能力

3.2 WHEN 用户点击“我喜欢”“推荐歌单”“榜单”“播放历史”或“本地音乐” THEN the system SHALL CONTINUE TO 导航到各自既有目标页面并保留既有路由参数和返回首页行为

3.3 WHEN 首页以横屏或其他当前受支持的非缺陷布局显示 THEN the system SHALL CONTINUE TO 使用既有信息结构、入口集合和交互语义

3.4 WHEN 应用显示系统或应用内启动体验 THEN the system SHALL CONTINUE TO 使用既有品牌图形、颜色、启动文案和完整几何上的动画意图，不以更换品牌资产或增加新启动流程作为修复方式

3.5 WHEN 首页已经可见或初始化耗时超过启动承接画面的既有视觉时限 THEN the system SHALL CONTINUE TO 允许首页交互且不让启动覆盖层拦截触摸，也不得在首页可见后重新显示覆盖层

3.6 WHEN 系统启用“减少动态效果”或类似无障碍设置 THEN the system SHALL CONTINUE TO 遵循该设置，同时保持完整品牌几何和非阻塞交接

3.7 WHEN 设备离线播放完整本地文件且未启用定时关闭 THEN the system SHALL CONTINUE TO 无需网络即可播放，并保持暂停、恢复、拖动进度和播放速率等既有能力

3.8 WHEN 当前曲目具有充分自然结束证据 THEN the system SHALL CONTINUE TO 按既有队列循环、单曲循环或随机播放语义恰好选择后续目标一次

3.9 WHEN 当前曲目发生可归属于当前会话的真实播放错误 THEN the system SHALL CONTINUE TO 遵循用户既有的错误停止或自动下一曲配置，而不是一律禁止错误恢复

3.10 WHEN 用户设置 10、20、30、45、60 分钟或自定义定时关闭、取消定时关闭，或者选择“当前歌曲播放完成后关闭” THEN the system SHALL CONTINUE TO 使用既有选择、deadline 和关闭语义

3.11 WHEN 用户通过应用按钮、手势、通知或其他系统媒体控制显式执行播放、暂停、上一曲、下一曲或拖动进度 THEN the system SHALL CONTINUE TO 执行对应控制，并将显式来源与自动事件明确区分

3.12 WHEN 用户添加、移除、重排或替换播放队列中的曲目 THEN the system SHALL CONTINUE TO 使用既有队列编辑、当前项选择和后续目标语义，不因新增仲裁而吞掉合法队列变化

3.13 WHEN 用户播放在线、缓存或插件提供的非完整本地音频 THEN the system SHALL CONTINUE TO 使用既有音源选择顺序、网络限制和错误策略；本地文件优先要求不得重写无有效本地文件时的回退能力

3.14 WHEN 用户下载、导入、查看或删除本地音乐 THEN the system SHALL CONTINUE TO 保持既有本地音乐清单、文件元数据和文件管理语义，不得通过忽略已下载文件或强制重新联网规避跳曲问题

3.15 WHEN 诊断记录被保存、查看、复制或由用户主动导出 THEN the system SHALL CONTINUE TO 将数据保留在现有本地/用户主动导出边界内，不新增远程遥测，并持续省略或脱敏完整路径、请求头、令牌和其他敏感数据

3.16 WHEN 用户未来主动触发现有 GitHub Actions Pull Request、标签或手动 workflow THEN the system SHALL CONTINUE TO 保持既有触发、Release APK 产物和校验语义；本次 requirements 更新不触发 workflow，也不要求开发者在本地构建

3.17 WHEN 输入不满足任一已定义 bug condition THEN the system SHALL CONTINUE TO 保持修复前相同的可观察首页、启动、播放、队列、定时关闭、显式控制、本地文件管理和交付行为

```pascal
// Logical Property: Preservation Checking (static review obligation, not a test)
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT observable_behavior(F(X)) = observable_behavior(F'(X))
END FOR
```
