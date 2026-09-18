## Purpose

在 Discord 网页版文字频道中，将用户主动选择的单条消息交给 OpenRouter 大模型翻译，并把译文关联到原始消息。消息动态变化、网络失败和配置变更时，界面仍应准确反映当前消息和真实请求状态。

## ADDED Requirements

### Requirement: Discover eligible channel messages

系统 SHALL 在 `https://discord.com` 普通服务器文字频道为已渲染、含可见正文文本的消息提供一个「翻译」按钮，覆盖初始消息、新消息和滚动后重新挂载的消息；同一消息 MUST NOT 出现重复按钮。纯附件、贴纸或无正文系统消息不显示按钮。

#### Scenario: Initial and incoming messages
- **WHEN** 自动翻译关闭时打开普通文字频道或收到一条新的文本消息
- **THEN** 每条已渲染的合格消息旁均出现一个翻译按钮，尚未发出任何翻译请求

#### Scenario: Virtualized list remount
- **WHEN** 消息滚出视区后重新挂载到当前频道
- **THEN** 消息只出现一个按钮；当前频道内仍有效的进行中状态或已完成译文恢复展示

### Requirement: Respect the selected translation mode

手动模式下系统 SHALL 仅在用户点击「翻译」或失败后的「重试」时请求 OpenRouter；显式开启自动模式后 SHALL 自动请求已加载且尚未处理的文本消息；发送内容 SHALL 仅含该条消息的可见正文和翻译指令。系统 MUST NOT 把作者资料、相邻消息、引用预览、附件内容、未展开的隐藏文本或先前译文拼入正文，MUST NOT 自动检测语言后跳过调用。

#### Scenario: Single-message request
- **WHEN** 配置完整的用户点击一条消息的翻译按钮
- **THEN** 系统发起该消息的一次翻译请求，不翻译其他消息，也不向 Discord 发送发言

#### Scenario: Missing configuration
- **WHEN** 用户未保存 API Key 或模型 ID 就点击翻译
- **THEN** 消息下方显示具体缺失项和「打开设置」入口，不请求 OpenRouter

#### Scenario: Existing injected controls
- **WHEN** 消息区域已经存在其他扩展的翻译按钮或译文
- **THEN** 本次翻译仅使用原始可见正文，不发送已有按钮文案或译文，不删除其他扩展的节点

### Requirement: Show per-message loading and prevent duplicate submissions

请求开始时系统 SHALL 立即为该条消息显示「翻译中…」，并使该消息的翻译操作在本次请求结束前不可重复提交；其他消息 SHALL 保持独立可操作。

#### Scenario: Rapid repeated clicks
- **WHEN** 用户连续点击同一条消息的翻译按钮
- **THEN** 当前翻译仅发出一次请求，loading 保持到成功、失败或消息状态失效

#### Scenario: Two independent messages
- **WHEN** 消息 A 正在翻译时用户点击消息 B
- **THEN** B 独立进入 loading，返回结果分别附着在各自的原文下方

### Requirement: Render complete translated text below the original

成功时系统 SHALL 保持 Discord 原始正文不变，在其下一行、同一消息容器内显示目标语言标签和译文。译文 SHALL 作为纯文本显示，保留换行并允许长内容换行；系统 MUST NOT 将返回内容作为 HTML 执行。

#### Scenario: Successful translation
- **WHEN** OpenRouter 返回完整、非空的译文
- **THEN** loading 被译文替换，按钮显示不可重复提交的「已翻译」，无需打开 popup 阅读结果

#### Scenario: Markup in output
- **WHEN** 模型返回含 HTML 标签或脚本样式字符串的文本
- **THEN** 界面只显示文字，不执行脚本、不加载返回内容中描述的资源

### Requirement: Surface failures and allow manual retry

系统 SHALL 对认证失败、额度不足、限流、模型/参数错误、网络错误、后台连接中断、空响应、截断结果和响应解析错误显示明确失败状态，终止 loading 并提供手动重试。系统 MUST NOT 自动重试、切换模型、用原文冒充译文或显示伪造成功结果。

#### Scenario: Provider rejects request
- **WHEN** OpenRouter 返回错误，包括 HTTP 成功状态中的业务错误
- **THEN** 消息下方展示可读原因和可用的错误码；该条消息可以手动重试；凭据和原始请求正文不出现在错误详情中

#### Scenario: Invalid or incomplete response
- **WHEN** 返回无可用译文、无法解析的内容或明确标记为截断/拒绝的结果
- **THEN** 系统显示响应失败或结果不完整，不能标为已翻译

#### Scenario: Manual retry
- **WHEN** 用户在失败后点击「重试」
- **THEN** 使用当前已保存配置和当前消息正文发起新请求，再次显示 loading

### Requirement: Keep translations attached to the correct message revision

系统 SHALL 将结果与频道、消息、正文版本及配置关联。正文编辑后 SHALL 清除旧译文，手动模式等待新的主动点击，自动模式翻译新正文；消息删除、频道切换或配置改变后，晚返回的结果 MUST NOT 写入其他消息或覆盖新状态。

#### Scenario: Edit while request is pending
- **WHEN** 用户点击翻译后原文被修改，随后旧请求返回
- **THEN** 旧结果不展示，新正文旁只保留一个可操作按钮，手动模式重新翻译必须再次点击，自动模式使用新正文

#### Scenario: Navigate away
- **WHEN** 请求期间用户切换频道或原消息被删除
- **THEN** 返回结果不能注入当前频道的其他消息；手动模式下频道切换不触发翻译请求；自动模式处理新频道已加载的消息

#### Scenario: Reload the Discord page
- **WHEN** 用户刷新 Discord 页面
- **THEN** 本次页面内的译文状态清空，已保存配置保留，手动模式下消息等待用户主动点击，自动模式按已保存开关恢复

### Requirement: Translate automatically without repeated attempts

自动模式 SHALL 在消息 UI 挂载或正文版本变化时发起翻译，并在开启开关时处理当前已加载的空闲消息。系统 MUST NOT 主动抓取未加载的频道历史。相同正文和翻译参数下，进行中、已成功和已失败的消息 MUST NOT 因 DOM 重复变化、滚动重挂载或重复开启开关而再次自动请求；失败只提供手动重试。

#### Scenario: Enable with current and new messages
- **WHEN** 配置完整的用户开启自动翻译，随后出现新消息
- **THEN** 当前已加载的空闲文本消息与新消息自动进入 loading，译文显示在各自原文下方

#### Scenario: Disable while work is in flight
- **WHEN** 用户关闭自动翻译
- **THEN** 不再发起新自动请求；已发出的请求可完成，已有译文保留；后台拒绝尚未开始的过期自动请求

#### Scenario: Automatic request fails
- **WHEN** 自动翻译失败，页面随后发生其他更新或开关再次开启
- **THEN** 错误保留且不自动重试，只有用户点击「重试」才发起新的尝试
