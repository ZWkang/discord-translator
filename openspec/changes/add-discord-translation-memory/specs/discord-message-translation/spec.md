## MODIFIED Requirements

### Requirement: Respect the selected translation mode

手动模式下系统 SHALL 仅在用户点击「翻译」、失败后的「重试」或显式选择「重新翻译」时处理所选消息；显式开启自动模式后 SHALL 处理已加载且尚未处理的文本消息。普通翻译与普通失败重试 SHALL 先查找兼容的本地词条，未命中且配置完整时才请求 OpenRouter；显式重新翻译 SHALL 绕过已保存结果并要求完整模型配置，自动模式 MUST NOT 自行触发强制重译。发送给模型的内容 SHALL 仅含该条消息的可见正文和翻译指令。系统 MUST NOT 把作者资料、相邻消息、引用预览、附件内容、未展开的隐藏文本或先前译文拼入正文，MUST NOT 自动检测语言后跳过调用；命中已保存词条是明确的复用行为。

#### Scenario: Single-message request
- **WHEN** 配置完整的用户点击一条消息的翻译按钮
- **THEN** 系统处理该消息的一次翻译，先查词条；命中时零模型调用，未命中才发起一次模型请求；不翻译其他消息，也不向 Discord 发送发言

#### Scenario: Missing configuration
- **WHEN** 用户未保存 API Key 或模型 ID 就点击翻译，且不存在与当前翻译条件兼容的记录
- **THEN** 消息下方显示具体缺失项和「打开设置」入口，不请求 OpenRouter

#### Scenario: Existing injected controls
- **WHEN** 消息区域已经存在其他扩展的翻译按钮或译文
- **THEN** 查找词条和模型请求均仅使用原始可见正文，不发送已有按钮文案或译文，不删除其他扩展的节点

#### Scenario: Manual mode revisits stored messages
- **WHEN** 手动模式下刷新页面或进入已存在词条的频道
- **THEN** 新挂载的消息仍等待用户点击；点击后可复用记录，不额外自动请求模型

### Requirement: Render complete translated text below the original

成功时系统 SHALL 保持 Discord 原始正文不变，在其下一行、同一消息容器内显示目标语言标签和译文。模型成功和记录命中 SHALL 使用同一紧凑布局，明确区分来源及保存失败状态。译文 SHALL 作为纯文本显示，保留换行并允许长内容换行；系统 MUST NOT 将返回内容作为 HTML 执行。

#### Scenario: Successful translation
- **WHEN** OpenRouter 返回完整、非空的译文
- **THEN** loading 被译文替换，按钮显示「已翻译」且不会因再次点击状态按钮重复提交普通请求；用户可从操作菜单主动重译，无需打开 popup 阅读结果；若保存失败，另行明确标记未保存

#### Scenario: Markup in output
- **WHEN** 模型或记录返回含 HTML 标签或脚本样式字符串的文本
- **THEN** 界面只显示文字，不执行脚本、不加载返回内容中描述的资源

#### Scenario: Stored translation returned
- **WHEN** 本地词条匹配成功
- **THEN** loading 被已保存译文替换，按钮显示「已翻译」，通过悬停提示和可访问说明表达来自本地记录、未调用模型，结果位于对应原文下一行

### Requirement: Surface failures and allow manual retry

系统 SHALL 对认证失败、额度不足、限流、模型/参数错误、网络错误、后台连接中断、空响应、截断结果、响应解析错误以及记录读取失败显示明确失败状态，终止 loading 并提供手动重试。系统 MUST NOT 自动重试、切换模型、用原文冒充译文或显示伪造成功结果。已获得真实译文但保存失败 SHALL 单独标记未保存，不能误报为模型翻译失败或诱导自动重复计费。

#### Scenario: Provider rejects request
- **WHEN** OpenRouter 返回错误，包括 HTTP 成功状态中的业务错误
- **THEN** 消息下方展示可读原因和可用的错误码；该条消息可以手动重试；凭据和原始请求正文不出现在错误详情中

#### Scenario: Invalid or incomplete response
- **WHEN** 返回无可用译文、无法解析的内容或明确标记为截断/拒绝的结果
- **THEN** 系统显示响应失败或结果不完整，不能标为已翻译，也不保存成功词条

#### Scenario: Manual retry
- **WHEN** 用户在失败后点击「重试」
- **THEN** 使用当前设置和当前消息正文重新处理，再次先查记录，未命中才允许新的模型请求，并显示等待状态

### Requirement: Keep translations attached to the correct message revision

系统 SHALL 将结果与频道、消息、正文版本及配置关联，记录命中和模型返回都适用同样的生命周期校验。正文编辑后 SHALL 清除旧展示，手动模式等待新的主动点击，自动模式处理新正文；消息删除、频道切换或配置改变后，晚返回的结果 MUST NOT 写入其他消息或覆盖新状态。原请求成功生成的历史快照 SHALL 可以保留在原来源之下，不得伪装为编辑后的正文或当前频道结果。

#### Scenario: Edit while request is pending
- **WHEN** 用户点击翻译后原文被修改，随后旧请求返回
- **THEN** 旧结果不展示，新正文旁只保留一个可操作按钮，手动模式重新翻译必须再次点击，自动模式使用新正文；旧词条只与原正文快照关联

#### Scenario: Navigate away
- **WHEN** 请求期间用户切换频道或原消息被删除
- **THEN** 返回结果不能注入当前频道的其他消息；手动模式下频道切换不触发翻译请求；自动模式对新频道已加载消息先查记录再按需调用模型

#### Scenario: Reload the Discord page
- **WHEN** 用户刷新 Discord 页面
- **THEN** 本次页面内状态清空，已保存配置与持久词条保留；手动模式等待点击后查询词条，自动模式按已保存开关恢复并优先复用

### Requirement: Translate automatically without repeated attempts

自动模式 SHALL 在消息 UI 挂载或正文版本变化时处理翻译，并在开启开关时处理当前已加载的空闲消息；每次处理 SHALL 优先查找兼容记录，未命中才调用模型。系统 MUST NOT 主动抓取未加载的频道历史。相同正文和翻译参数下，进行中、已成功和已失败的消息 MUST NOT 因 DOM 重复变化、滚动重挂载或重复开启开关而再次自动请求；失败只提供手动重试。

#### Scenario: Enable with current and new messages
- **WHEN** 配置完整的用户开启自动翻译，随后出现新消息
- **THEN** 当前已加载的空闲文本消息与新消息自动处理；命中记录的不调用模型，未命中的显示模型等待状态，结果分别附着在各自原文下方

#### Scenario: Disable while work is in flight
- **WHEN** 用户关闭自动翻译
- **THEN** 不再发起新自动处理；已接受的请求可完成，已有译文保留；后台拒绝尚未开始的过期自动请求

#### Scenario: Automatic request fails
- **WHEN** 自动翻译或记录读取失败，页面随后发生其他更新或开关再次开启
- **THEN** 错误保留且不自动重试，只有用户点击「重试」才发起新的尝试

## ADDED Requirements

### Requirement: Regenerate a translated message on explicit user action

系统 SHALL 在翻译成功的消息操作菜单提供「重新翻译」，包括来自本地记录的译文，无需先删除词条或刷新 Discord。操作 SHALL 使用点击时的当前可见正文与已保存翻译设置，绕过缓存结果；等待期间原译文保持可读，重复操作禁用。只有新译文完整且保存成功后，当前消息和对应记录才 SHALL 更新。模型或持久化失败时 SHALL 保留原译文与原记录、显示失败原因；重译重试必须由用户再次显式选择，不能被自动模式或 DOM 变化触发。

#### Scenario: Regenerate without deleting history
- **WHEN** 用户对来自本地记录的译文选择「重新翻译」
- **THEN** 发起一次显式模型生成，保留原译文并显示重新翻译中的状态；保存成功后显示新译文，且无需删除记录或刷新页面

#### Scenario: Regeneration fails with a previous result
- **WHEN** 显式重译在模型调用或记录保存阶段失败
- **THEN** 原译文继续显示，错误清楚标为本次重新翻译失败；未保存的新文本若存在则以候选结果提供查看，原记录不变

#### Scenario: Regeneration finishes after the message changes
- **WHEN** 重译期间正文、频道或翻译设置改变，随后旧操作完成
- **THEN** 旧结果和原译文快照均不得恢复到新消息状态；保存操作只作用于原请求对应的兼容性键，且遵循删除规则
