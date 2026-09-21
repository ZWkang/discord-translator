## MODIFIED Requirements

### Requirement: Explicit OpenRouter configuration

系统 SHALL 提供 API Key、模型选择和目标语言设置；仅支持 OpenRouter。目标语言默认简体中文，可选择英文、日文、韩文。API Key MUST 由用户填写，模型 MUST 由用户选择内置候选或填写自定义 ID，不预置密钥或自动替换模型。

#### Scenario: First use
- **WHEN** 用户首次打开设置页
- **THEN** API Key 为空，模型显示未选择，目标语言为简体中文，可选择低价候选或自定义模型

#### Scenario: Missing required fields
- **WHEN** 用户保存时 API Key、模型选择或自定义 ID 去除首尾空白后为空
- **THEN** 对应字段显示错误，已保存配置保持不变，不发起模型请求

## ADDED Requirements

### Requirement: Offer low-cost text model presets with dated prices

模型下拉框 SHALL 提供经官方目录核对的低价文本生成候选及自定义入口。选择候选后 SHALL 展示美元/百万 token 的输入和输出参考价格、核对日期及官方模型链接，不承诺固定账单价格。打开设置或切换选择 MUST NOT 自动保存、请求模型或切换正在使用的配置。

#### Scenario: Select a preset
- **WHEN** 用户选择一个内置模型
- **THEN** 表单显示该模型的价格信息；仅在成功保存后，后续翻译才按完整模型 ID 使用新配置

### Requirement: Preserve custom and existing model configuration

重新打开设置时，内置模型 SHALL 对应到正确选项；不在列表中的已有模型 SHALL 显示为自定义并保留原 ID。自定义输入 SHALL 支持任意合法的完整模型 ID，切换候选再切回自定义时保留尚未提交的自定义草稿。清除 Key SHALL 保留已保存的模型选择。保存失败 SHALL 保留当前草稿并显示失败原因。

#### Scenario: Existing custom model
- **WHEN** 已保存模型不在内置列表中
- **THEN** 选中自定义并显示原 ID，关闭设置或查看其他候选不会修改已保存模型

#### Scenario: Save and reopen a selection
- **WHEN** 用户保存内置模型或自定义 ID 后重新打开设置
- **THEN** 显示实际保存的选择，内置模型有对应价格，自定义模型不展示其他模型的价格

#### Scenario: Clear credentials or fail to save
- **WHEN** 用户清除密钥或保存失败
- **THEN** 清除密钥后已保存模型仍可正确回显；保存失败时草稿保持，旧配置不被替换
