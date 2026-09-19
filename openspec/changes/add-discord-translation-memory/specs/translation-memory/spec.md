## Purpose

将 Discord 已成功生成的译文与原文及来源保存在扩展本地，使相同翻译条件下的重复请求可以直接复用，并在刷新、切换频道和重启后继续查看。记录必须能准确关联原消息，明确区分命中、未命中和存储失败。

## ADDED Requirements

### Requirement: Persist successful translations with source snapshots

系统 SHALL 在模型返回完整有效译文后保存原文、译文、目标语言、模型、提供方、翻译指令版本、创建和最近使用时间，并关联 Discord 服务器 ID、频道 ID、消息 ID、来源标题及原消息链接。相同词条 SHALL 允许关联多个来源；同一词条与同一消息的重复使用 MUST NOT 新增重复来源记录。记录 SHALL 在正常关闭并重启浏览器后保留，仅从功能启用后的成功翻译积累，不回溯抓取频道历史。

#### Scenario: Save and reopen
- **WHEN** 一条完整译文和来源保存成功，用户刷新或重启浏览器
- **THEN** 记录页仍能查看完整原文、译文、翻译参数与原消息链接

#### Scenario: Reuse in another channel
- **WHEN** 频道 B 的消息命中曾在频道 A 保存的同一词条
- **THEN** 复用原译文并新增 B 的来源关联；用户分别筛选 A 和 B 时均可找到该词条及对应来源

#### Scenario: Repeat the same source
- **WHEN** 同一消息反复挂载或在相同翻译条件下被再次处理
- **THEN** 词条及该消息的来源关联各保留一份，不以重复渲染虚增记录数量

### Requirement: Reuse only an exact compatible translation

普通翻译请求 SHALL 仅在 Discord 站点、完整原文、目标语言、提供方、用户选择的模型 ID 和翻译指令版本均一致时复用词条；用户显式「重新翻译」 SHALL 绕过该结果复用。原文仅沿用现有正文提取时的换行与首尾空白处理，MUST NOT 为提高命中率而忽略大小写、删除标点、合并正文内空白或采用模糊/语义匹配。服务器、频道、消息 ID、API Key 和配置保存次数 MUST NOT 成为词条兼容性条件。更换语言、模型或指令版本 SHALL 保留旧记录供查看，但不能错误复用。

#### Scenario: Compatible record exists
- **WHEN** 用户触发普通翻译且存在完全兼容的词条
- **THEN** 系统直接返回已保存译文，标明来自记录，并且不发起 OpenRouter 请求

#### Scenario: Translation conditions change
- **WHEN** 原文、目标语言、模型或翻译指令版本与已有词条不同
- **THEN** 该词条不命中，旧记录仍可查看，新请求按当前设置处理

#### Scenario: Credentials are removed
- **WHEN** 用户清除 API Key 后，对保留的模型和目标语言触发一条已记录原文的翻译
- **THEN** 仍可返回兼容记录；未命中才提示补齐模型调用所需配置

### Requirement: Preserve real outcomes when storage fails

读取失败 MUST NOT 被当作无记录并静默调用模型；失败、空内容、截断、拒绝和其他无效模型响应 MUST NOT 保存为成功词条。新译文和首个来源 SHALL 作为一次完整保存操作提交。模型成功但保存失败时，系统 SHALL 显示真实译文并明确标记「未保存」，提供非敏感的错误原因，MUST NOT 宣称记录已保存或自动再次调用模型。命中记录但追加来源失败时 SHALL 保留可读译文并说明来源未保存。系统 MUST NOT 静默删除旧记录、截断内容或设置自动过期来掩盖存储失败。

#### Scenario: Record lookup fails
- **WHEN** 本地记录无法读取
- **THEN** 结束等待并显示记录读取失败，提供手动重试；本次不调用 OpenRouter

#### Scenario: Provider response is invalid
- **WHEN** 模型请求失败或返回不完整译文
- **THEN** 按现有错误流程展示，不创建词条或来源关联

#### Scenario: Commit fails after translation
- **WHEN** 模型返回完整译文，但记录提交失败
- **THEN** 译文仍可阅读且标记未保存；没有残缺词条或仅来源的孤立记录，也不产生第二次模型调用

#### Scenario: Source association fails on a hit
- **WHEN** 已有记录可读但本次来源无法保存
- **THEN** 复用译文仍可阅读，界面明确提示此次来源未保存，已有记录保持完整

### Requirement: Coalesce compatible simultaneous requests

同一后台实例内，同时到达且原文、翻译参数与当前配置版本均一致的未命中请求 SHALL 共享一次生成工作，该工作 SHALL 覆盖模型调用、响应校验，以及词条与首次来源的持久提交，直到提交成功或明确失败；每个调用方 SHALL 收到属于自身请求和来源的结果。模型已返回但保存尚未结束的窗口 MUST NOT 使相同请求再次调用模型。不同词条的请求保持独立。共享请求失败 SHALL 对各调用方暴露相同的真实失败，不自动重试。后台重启后不假定旧的在途请求仍存在。

#### Scenario: Two tabs request the same text
- **WHEN** 两个 Discord 标签页同时翻译兼容的同一原文，尚无持久记录
- **THEN** 只产生一次模型请求；两条原消息各显示正确译文，各自的来源均被保存

#### Scenario: Shared request fails
- **WHEN** 共享的模型调用返回失败
- **THEN** 所有等待方结束等待并显示失败；无成功记录，不自动重发

#### Scenario: A request arrives during persistence
- **WHEN** 第一个相同请求的模型已返回，但记录提交尚未结束，第二个请求到达
- **THEN** 第二个请求共享正在保存的生成工作，不再调用模型；提交成功后取得同一译文并关联各自来源，提交失败则明确报告未保存

#### Scenario: A prior miss becomes stale
- **WHEN** 某请求早先查找未命中，但准备创建生成工作时另一请求已经保存了兼容词条
- **THEN** 系统使用新近提交的词条，不因先前的未命中结果额外调用模型

### Requirement: Replace translations only after a successful explicit regeneration

用户显式重新翻译 SHALL 绕过已保存译文，使用当前原文与已保存的目标语言、模型及现行指令调用 OpenRouter。旧词条 MUST NOT 被预先删除；只有取得完整有效的新译文并且保存事务成功时，系统才 SHALL 原子更新同一兼容性键的译文及更新时间，同时保留来源关联、首次生成时间与排序身份。当前条件对应另一个键时 SHALL 创建独立词条，不能覆盖不兼容的旧记录。模型或保存失败 SHALL 保留旧记录与页面原译文，并报告明确失败；已经生成但未保存的新文本 SHALL 作为未保存候选结果可查看，不冒充已更新记录。

同一词条同时发生的显式重译 SHALL 合并一次重译工作；重译 MUST NOT 使用更早的普通生成工作充当新的结果。普通生成的迟到写入 MUST NOT 覆盖成功重译。重译期间，普通缓存命中 SHALL 可继续读取已提交的旧记录，成功提交后的新查找 SHALL 读取新译文。删除和清空规则同样适用于重译，删除优先于删除前已经启动的重译写回。

#### Scenario: Regenerate an existing entry
- **WHEN** 用户显式重新翻译一条已有兼容词条的消息，模型和保存均成功
- **THEN** 调用模型生成新译文，当前结果和词条更新；来源关联保留，首次生成时间及列表位置不变

#### Scenario: Regeneration fails before commit
- **WHEN** 重译遇到缺少密钥、上游错误、无效响应或记录保存失败
- **THEN** 保留旧词条和原译文并展示失败原因，不自动重试；存在未保存的新译文时明确区分候选文本与当前记录

#### Scenario: Duplicate explicit regeneration
- **WHEN** 两个页面同时显式重译同一个兼容词条，首个重译尚未完成提交
- **THEN** 两个操作共享一次重译调用及提交结果，不创建两个互相覆盖的新版本

#### Scenario: Older generation completes before regeneration
- **WHEN** 普通生成仍在进行时，同键的显式重译到达
- **THEN** 显式重译等待已有工作结束后执行新的模型调用，多个同时到达的显式重译合并；旧普通结果不能在新结果提交后覆盖它

#### Scenario: Delete during regeneration
- **WHEN** 用户删除或清空记录成功后，删除前启动的重译才返回
- **THEN** 该结果不能重新创建已删除词条，页面明确说明新结果未保存

### Requirement: Delete stored entries without unintended resurrection

用户删除单条词条时，系统 SHALL 删除其全部来源关联并从后续持久查询中排除它；清空时 SHALL 删除全部词条和来源。删除成功前启动的对应操作 MUST NOT 在稍后完成时重建已删除数据。删除不修改 Discord 原文、不自动触发模型调用，也不擦除当前页面已经显示的译文。删除后的新翻译请求 SHALL 可重新生成并保存；界面 SHALL 明确说明删除作用于记录与后续复用。

#### Scenario: Remove an entry
- **WHEN** 用户确认删除一条被多个频道关联的词条且操作成功
- **THEN** 该词条从所有来源筛选和后续持久匹配中消失，当前已显示的译文保持，且不会因此自动重译

#### Scenario: Clear during translation
- **WHEN** 用户清空记录成功后，清空前发出的翻译请求才返回
- **THEN** 该请求仍可在有效的原消息位置显示真实译文，但标明未保存，不能使已清空的记录重新出现

#### Scenario: Start after deletion
- **WHEN** 删除完成后用户重新发起未命中的翻译，或后来出现新的自动翻译请求
- **THEN** 请求可正常生成新记录；删除不是永久禁止保存

### Requirement: Keep the collection private to trusted extension pages

记录 SHALL 仅存于扩展本地，不包含 API Key、授权 Header、作者资料或隐藏消息内容，不同步到云端。记录浏览、搜索、详情和删除 SHALL 仅向本扩展的记录页开放；Discord 内容脚本只能对当前支持的消息发起翻译并获得该次结果，MUST NOT 枚举完整记录库或删除数据。原文、译文与标题均 SHALL 作为纯文本处理。

#### Scenario: Content script attempts bulk access
- **WHEN** Discord 内容脚本或其他来源请求列出、搜索或删除记录
- **THEN** 操作被明确拒绝，不返回其他记录及凭据

#### Scenario: Text contains markup
- **WHEN** 记录的原文、译文或来源标题含 HTML 或脚本样式字符串
- **THEN** 记录页只展示文字，不执行脚本或加载文本描述的资源
