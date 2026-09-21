## Why

模型 ID 需要手工查找和输入，难以比较翻译成本，也容易选到不支持文本生成的模型。将常用低价文本模型提供为下拉选项，降低配置门槛。

## What Changes

- 模型字段改为原生 select，内置四个低价多语言文本生成候选。
- 展示所选模型的输入/输出参考价格、核对日期和官方页面链接。
- 保留自定义模型 ID；已有模型原样回显，未保存的选择不修改配置或发起调用。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `translation-settings`: 低价模型选择、价格说明、自定义与旧配置兼容。

## Impact

影响 popup 表单、内置候选数据、设置 UI 回归及 README。保持现有 settings.model 字符串契约、翻译请求和持久记录匹配方式，不增加依赖或权限。
