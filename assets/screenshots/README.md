# 产品截图

[返回项目 README](../../README.md)

2026-09-21 使用 ego lite / ego-browser 从当前 v0.2.0 扩展拍摄，涵盖模型选择变更。PNG 可用于项目介绍，引用示例见项目 README。

| 文件 | 内容 | 像素尺寸 |
| --- | --- | --- |
| [inline-translation.png](inline-translation.png) | Discord 真实消息与行内中文译文 | 970 × 220 |
| [retranslate-menu.png](retranslate-menu.png) | 「已翻译」展开后的重新翻译菜单 | 970 × 240 |
| [settings.png](settings.png) | 完整设置页、自动开关、模型价格与目标语言 | 440 × 920 |
| [custom-model.png](custom-model.png) | 未保存的自定义模型草稿界面 | 440 × 990 |
| [popup.png](popup.png) | 工具栏原生 popup 的可滚动视口 | 415 × 600 |
| [history.png](history.png) | 记录列表、搜索与筛选入口 | 1280 × 960 |
| [history-detail.png](history-detail.png) | 完整内容、时间和原消息入口 | 1280 × 620 |

## 拍摄与脱敏

- 使用实际构建和真实浏览器 UI，不使用模型生成的界面图或模拟翻译响应。
- API Key 保持密码输入框遮蔽；未显示或导出其明文。
- Discord 图裁去侧栏、账号、头像和作者身份；记录详情中的频道名和服务器/频道 ID 使用临时 CSS 实色遮蔽，原文、译文、按钮和状态未改写。
- 自定义模型截图仅切换表单草稿，未保存。完成后比对公共设置（含 revision）与拍摄前一致。
- 未向 Discord 发送、编辑或删除消息。拍摄菜单时没有点击重新翻译，也没有删除记录。
- 自动翻译按已有配置保持开启，真实频道加载时会按该配置正常处理消息。截图不是模型质量或费用的比较测试。
- 原生 popup 高度 600px，需要滚动；完整界面使用独立设置页截图展示。
- 临时遮蔽样式已移除，TaskSpace 10 已结束。原始验收记录继续留在忽略目录 `.artifacts/`；本目录是面向 README 的精选素材。

更新截图时先构建并重载扩展与 Discord，复核加载版本；保持敏感信息遮蔽，逐张检查可读性，并同步本表和 README。
