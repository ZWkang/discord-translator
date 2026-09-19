## Purpose

为用户提供独立的 Discord 翻译记录页面，集中查看和搜索不同服务器、频道积累的原文与译文，并能回到原消息或删除不再需要的记录。页面应让本地数据的来源、内容与保存状态清楚可见，保持现有扩展的设计语言。

## ADDED Requirements

### Requirement: Open a dedicated translation history page

popup SHALL 提供「翻译记录」入口，打开独立扩展页面；用户无需 API Key 即可打开和浏览本地记录。页面 SHALL 展示真实的加载、空列表和读取失败状态，不以空列表掩盖错误。页面 SHALL 沿用现有新粗野主义语义色、直角边框、硬阴影与可见焦点，不将完整列表塞入 popup。

#### Scenario: Open without credentials
- **WHEN** 用户未配置或已清除密钥，在 popup 点击「翻译记录」
- **THEN** 独立页面打开并读取本地记录，不发起模型请求

#### Scenario: Empty collection
- **WHEN** 记录读取成功且尚无保存内容
- **THEN** 页面说明完成一次翻译后会出现记录，不显示伪造样例

#### Scenario: Collection cannot be read
- **WHEN** 加载记录失败
- **THEN** 页面显示明确错误与重新加载操作，不展示为正常空库

### Requirement: Browse and search records by Discord source

页面 SHALL 按词条首次生成时间从新到旧展示记录；最近使用时间与重译更新时间仅作为信息展示，复用或重译 MUST NOT 改变现有词条的排序位置。页面 SHALL 提供服务器、频道、目标语言、模型筛选以及原文/译文子串搜索，筛选和搜索共同生效；频道选项 SHALL 与所选服务器一致。相同词条在一次列表查询中只出现一次，其详情展示实际关联的来源。页面 SHALL 支持逐页加载全部符合当前查询的既有记录，不通过固定截断隐藏较早数据，也不一次渲染整个记录库；查询期间新增词条在刷新后纳入。筛选切换后晚返回的旧查询 MUST NOT 覆盖新列表。

#### Scenario: Filter a channel
- **WHEN** 用户选择服务器 A 和频道 B
- **THEN** 只显示至少关联该频道一条消息的词条，并能查看该频道内的匹配来源

#### Scenario: Combine search and filters
- **WHEN** 用户在频道筛选基础上搜索原文或译文中的词组，并选择目标语言或模型
- **THEN** 只显示同时符合条件的词条；无匹配时明确显示无搜索结果

#### Scenario: Browse older records
- **WHEN** 符合条件的记录多于当前页
- **THEN** 用户可继续加载更早记录，完整内容没有被丢弃或截断保存

#### Scenario: Rapid filter changes
- **WHEN** 用户连续切换频道，旧查询在新查询之后返回
- **THEN** 页面仍显示最新筛选条件对应的数据

#### Scenario: Reuse while browsing later pages
- **WHEN** 用户加载第一页后，一条尚未浏览的词条被再次复用或成功重译
- **THEN** 该词条仍处于原首次生成时间对应的位置，不因最近使用或更新时间变化而在后续分页中遗漏或重复

#### Scenario: New entries arrive during pagination
- **WHEN** 翻页过程中又生成了新词条
- **THEN** 当前查询继续遍历既有记录，新词条在刷新后进入列表，不挤动已加载页面

#### Scenario: Preserve active selections when filter options change
- **WHEN** 查询刷新重新生成频道选项，或删除导致当前所选来源/模型没有剩余记录
- **THEN** 筛选控件仍准确显示当前查询条件；已无记录的选择以其身份和暂无记录状态显示，不冒充“全部”或静默扩大查询范围

### Requirement: Inspect complete text and original message sources

每个词条 SHALL 展示原文、译文、目标语言、模型、首次生成、最近使用及重译更新时间，并提供完整内容详情。来源 SHALL 显示服务器和频道身份、页面标题快照及原消息链接；身份 ID 与可获得的名称明确区分，不能伪造不存在的名称。打开来源 SHALL 导航至对应 Discord 消息，不修改或发送发言。来源标题只是记录时的快照，不宣称保持实时更新或保证用户仍有访问权限。

#### Scenario: Open a long translation
- **WHEN** 用户查看多段或包含代码的词条详情
- **THEN** 原文和译文完整可读，保留换行，不把 HTML 作为页面执行

#### Scenario: Open an original message
- **WHEN** 用户点击某个来源的「查看原消息」
- **THEN** 新标签页打开由该来源服务器、频道、消息 ID 构成的 Discord 链接；原消息删除或权限变化由 Discord 展示实际结果

### Requirement: Delete records with explicit feedback

页面 SHALL 提供单条词条删除和全部清空；操作前 SHALL 明确展示删除范围并让用户确认，取消不修改数据。清空 SHALL 明确作用于全部记录而非当前筛选。操作成功后刷新列表及详情；失败时保留原数据并显示错误，MUST NOT 乐观宣称删除成功。打开中的记录页 SHALL 能刷新以查看新翻译及其他记录页完成的删除。

#### Scenario: Cancel deletion
- **WHEN** 用户取消单条删除或清空确认
- **THEN** 数据保持不变，不发起模型请求

#### Scenario: Clear while filtered
- **WHEN** 用户筛选某个频道后确认「清空全部记录」
- **THEN** 所有频道的记录被删除，而非仅当前列表；界面在确认前已明确告知该范围

#### Scenario: Delete fails
- **WHEN** 删除事务失败
- **THEN** 页面保留词条和来源，显示失败原因，不显示已删除

### Requirement: Keep history usable on narrow screens and with a keyboard

记录页 SHALL 在窄屏下将筛选、列表和详情顺序排列，320 CSS px 下不产生页面横向溢出；原文与译文 SHALL 使用至少 14px 的正文字号。搜索、筛选、分页、详情、来源链接和确认/取消操作 SHALL 可通过键盘完成，有明确可访问名称与焦点；列表加载和错误 SHALL 可被辅助技术感知。

#### Scenario: Narrow record details
- **WHEN** 用户在 320 CSS px 宽度查看长词条或长链接
- **THEN** 文本可换行且全部操作可访问，无需横向拖动页面才能使用

#### Scenario: Keyboard deletion
- **WHEN** 用户通过键盘打开删除确认并取消
- **THEN** 焦点返回触发操作，记录保持不变
