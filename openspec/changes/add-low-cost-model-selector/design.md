## Context

当前 popup 直接编辑 model 字符串，经 settings.save 持久化。后台和翻译记录以完整模型 ID 为准，自动模式在保存后响应配置变化。动机见 proposal.md。

## Goals / Non-Goals

目标是简化模型选择，说明价格并保持旧配置兼容。不实现实时模型搜索、价格保证、自动换模型或质量排行榜。

## Decisions

- 内置候选及价格快照放在独立数据模块；打开 popup 不调用远程模型目录。少量精选候选足够满足当前需求，避免为简单选择引入目录加载与错误状态。
- 原生 select 复用 dt-input，保留键盘行为、400px popup 与 320px 独立设置页。模型详情在下方显示参考输入/输出价格（美元/百万 token）、核对日期和官方链接。
- 以 modelChoice 和 customModel 表示表单草稿，提交时产生原有 model 字符串；未知旧模型明确进入自定义模式，空配置保持未选，不静默替换。切换选项只改草稿，仍需显式保存。
- 候选依据 2026-09-20 的 [官方模型目录](https://openrouter.ai/api/v1/models) 和模型页面，均支持文本输入/输出。选择非思考或默认不思考的文本生成模型，避免额外改变现有翻译请求。

| 模型 | 输入 USD / 百万 token | 输出 USD / 百万 token | 依据 |
| --- | ---: | ---: | --- |
| Qwen2.5 7B Instruct | 0.10 | 0.20 | [官方页面](https://openrouter.ai/qwen/qwen-2.5-7b-instruct)，项目已有真实翻译验证 |
| Qwen3 30B A3B Instruct 2507 | 0.04815 | 0.19305 | [官方页面](https://openrouter.ai/qwen/qwen3-30b-a3b-instruct-2507)，非思考模式、多语言 |
| Ministral 3 3B 2512 | 0.10 | 0.10 | [官方页面](https://openrouter.ai/mistralai/ministral-3b-2512)，小型多语言生成模型 |
| Gemini 2.5 Flash-Lite | 0.10 | 0.40 | [官方页面](https://openrouter.ai/google/gemini-2.5-flash-lite)，默认关闭思考 |

## Risks / Trade-offs

- 价格与提供方随时间变化 → 明确标注日期和参考性质，链接官方页面；不将目录价格视为最终路由价格。
- 候选支持文本生成不代表每次请求可用或翻译质量有保证 → 保留已有明确错误；保存成功只代表本地配置已保存。
- 动态原生 option 回显容易与表单值失配 → 覆盖异步加载、预设/自定义切换和重新打开的回归。

## Migration Plan

无存储迁移。重建并重载扩展；回退 UI 后仍可用原文本输入框编辑相同的 model 字符串。
