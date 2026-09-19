## MODIFIED Requirements

### Requirement: Protect and remove credentials

API Key SHALL 只持久化在扩展本地设置，不云同步、不进入 Discord 页面 DOM、content script 消息、翻译记录、日志或源码；用户 SHALL 能在扩展设置页显式显示/隐藏及清除密钥。清除密钥 SHALL 保留模型、目标语言与已有翻译记录，并关闭自动翻译。手动触发仍 SHALL 可复用兼容记录；未命中的模型请求要求重新配置凭据。

#### Scenario: Clear saved key
- **WHEN** 用户点击「清除 API Key」且存储操作成功
- **THEN** 密钥被移除且自动模式关闭，模型、目标语言和词条保留；后续手动操作先查记录，未命中时才提示缺少配置

#### Scenario: Page access
- **WHEN** Discord 页面或频道翻译组件读取配置状态
- **THEN** 可获取是否已配置及模型、目标语言等非敏感信息，不能获取 API Key 或枚举整个记录库

### Requirement: Explain what is transmitted

设置页 SHALL 用简短文案说明：普通翻译先查询本地记录，命中时不会向模型发送消息；未命中或用户显式选择「重新翻译」时，才将所选消息可见文本发送给 OpenRouter 及模型提供方，调用可能产生费用。成功译文及原文、Discord 来源 SHALL 保存在本浏览器，可在记录页查看和删除；不云同步，不主动抓取未加载历史。自动模式 SHALL 使用相同的记录优先规则处理已加载和新出现的消息，不自行强制重译。

#### Scenario: Review data flow before use
- **WHEN** 用户查看并保存设置
- **THEN** 页面可见记录保存、复用、删除入口及未命中时的数据去向和计费说明，无需额外弹窗才能了解

## ADDED Requirements

### Requirement: Open history independently of translation configuration

设置页 SHALL 提供独立可访问的「翻译记录」入口；未填写 API Key 或模型时入口仍可用。打开记录页 MUST NOT 保存尚未提交的配置，也不得触发翻译。

#### Scenario: Open history with an incomplete form
- **WHEN** 用户尚未填完设置字段而点击「翻译记录」
- **THEN** 记录页正常打开，未保存表单和已保存配置均不被改写，不调用模型
