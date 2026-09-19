# translation-settings Specification

## Purpose

让用户在扩展内明确配置 OpenRouter 凭据、模型和译文语言，并在下次使用时保留选择。配置流程应区分本地保存与远端验证，确保密钥不暴露给 Discord 页面，配置错误能够直接定位。

## Requirements

### Requirement: Explicit OpenRouter configuration

系统 SHALL 提供 API Key、模型 ID 和目标语言设置；仅支持 OpenRouter。目标语言默认简体中文，可选择英文、日文、韩文。API Key 和模型 ID MUST 由用户填写，不预置密钥或自动选择模型。

#### Scenario: First use
- **WHEN** 用户首次打开设置页
- **THEN** API Key 和模型 ID 为空，目标语言为简体中文，并说明需要填入 OpenRouter 配置

#### Scenario: Missing required fields
- **WHEN** 用户保存时 API Key 或模型 ID 去除首尾空白后为空
- **THEN** 对应字段显示错误，已保存配置保持不变，不发起网络请求

### Requirement: Persist settings only after successful explicit save

系统 SHALL 只在用户点击「保存设置」且写入成功后显示「已保存」；配置 SHALL 在关闭 popup、重启浏览器后保留。保存 MUST NOT 被表述为模型可用性验证；手动模式下保存 MUST NOT 触发翻译请求。自动模式下内容页按自动翻译规则响应配置变化。

#### Scenario: Save and reopen
- **WHEN** 用户保存有效的本地配置后重新打开设置页
- **THEN** 字段恢复为已保存值，API Key 默认遮蔽，模型和语言与保存值一致

#### Scenario: Storage failure
- **WHEN** 设置写入失败
- **THEN** 页面展示保存失败原因并保留用户输入，不显示保存成功

### Requirement: Protect and remove credentials

API Key SHALL 只持久化在扩展本地存储，不云同步、不进入页面 DOM、content script 消息、日志或源码；用户 SHALL 能在扩展设置页显式显示/隐藏及清除密钥。清除密钥 SHALL 保留模型和目标语言，并关闭自动翻译。

#### Scenario: Clear saved key
- **WHEN** 用户点击「清除 API Key」且存储操作成功
- **THEN** 已保存密钥被移除，后续手动翻译提示缺少配置，自动模式关闭，模型和目标语言仍保留

#### Scenario: Page access
- **WHEN** Discord 页面或频道翻译组件读取配置状态
- **THEN** 可获取是否已配置及模型、目标语言等非敏感信息，不能获取 API Key

### Requirement: Apply setting changes to subsequent translations

系统 SHALL 在成功保存后使后续点击使用新配置，既有译文与进行中请求 SHALL 不被冒充为新配置的结果；自动模式关闭时保存 MUST NOT 触发自动重译；自动模式开启时按新配置翻译当前已加载消息。仅切换自动模式 MUST NOT 清除已有译文或使已发出的请求失效。

#### Scenario: Change language or model
- **WHEN** 用户修改并保存模型或目标语言
- **THEN** 频道中的旧译文被移除，按钮恢复可翻译状态，下次点击使用新配置

#### Scenario: Configuration changes while loading
- **WHEN** 翻译进行中用户保存了新配置或清除了密钥
- **THEN** 旧请求的结果不能覆盖新状态，手动模式需要再次点击，自动模式按新配置处理已加载消息

### Requirement: Explain what is transmitted

设置页 SHALL 用简短文案说明：点击翻译会将该条消息的可见文本发送给 OpenRouter 及其模型提供方，调用可能产生费用；不会主动抓取未加载的历史消息；开启自动翻译后，已加载和新出现的频道消息会自动调用模型，可能增加费用。

#### Scenario: Review data flow before use
- **WHEN** 用户查看并保存设置
- **THEN** 页面可见上述数据去向及计费提示，无需额外弹窗才能了解

### Requirement: Persist an explicit automatic translation switch

系统 SHALL 提供默认关闭的「自动翻译」开关，并在切换时立即保存，无需再次点击保存设置。已有旧配置缺少该字段时 SHALL 保持手动模式，并保留已有凭据、模型和目标语言。开启前 SHALL 要求已保存有效格式的必填配置；开关变化 SHALL 只改变自动触发，不修改凭据或翻译参数。

#### Scenario: Toggle and reopen
- **WHEN** 用户开启自动翻译后重开设置页
- **THEN** 开关仍开启；当前 Discord 页面收到模式变更；关闭时停止新自动请求且保留已有译文

#### Scenario: Missing model configuration
- **WHEN** 未保存 API Key 或模型时尝试开启
- **THEN** 系统提示先保存配置，开关保持关闭，不调用模型

#### Scenario: Toggle persistence fails
- **WHEN** 保存开关失败
- **THEN** 开关保持原状态，界面明确显示错误，不宣称已开启或已关闭
