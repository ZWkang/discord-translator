## Why

在 Discord 阅读外语频道时，用户需要离开当前消息才能完成翻译，难以对照上下文。本次在现有浏览器扩展模板上建立最小可用流程：用户点击消息旁的按钮，通过 OpenRouter 调用大模型，在原文下一行阅读译文。

## What Changes

- 将 Google 示例 content script 替换为 Discord 网页版的频道消息识别，处理初次加载、新消息、消息编辑、滚动重挂载和频道切换。
- 每条有可见文本的频道消息提供常驻「翻译」按钮；点击后显示 loading，成功后在同一条消息的原文下方显示译文；失败显示原因与手动重试入口。
- 仅接入 OpenRouter，由扩展后台发起单条文本翻译；默认手动翻译，可显式开启自动翻译；不自动重试、不自动切换模型，也不发送 Discord 发言。
- 将模板 popup 改为设置页，配置 API Key、明确的模型 ID 和目标语言；配置保存在扩展本地，密钥不传入 Discord 页面。
- 默认目标语言暂定简体中文，提供英文、日文、韩文选项。此项是草案假设，尚未收到用户对语言范围的确认；原文语言由模型识别。
- 确立新粗野主义视觉：电光黄主操作、粗黑边框、直角、无模糊硬阴影；设置页表达完整风格，频道内组件保持小体积与可读性。
- 在本 change 的 `design.md` 记录架构与交互，在 `design-tokens.md` 记录可直接映射为 CSS 自定义属性的 token、组件规范与状态规则。

## Capabilities

### New Capabilities

- `translation-settings`: OpenRouter 配置、目标语言、显式保存与密钥本地管理。
- `discord-message-translation`: Discord 消息识别、按需翻译、行内状态、请求与消息生命周期管理。
- `translation-interface`: popup 与行内翻译的设计 token、新粗野主义视觉、键盘与无障碍行为。

### Modified Capabilities

无。`openspec/specs/` 当前没有已有 capability。

## Impact

- 现有入口：`entrypoints/content.ts`、`entrypoints/background.ts`、`entrypoints/popup/`、`wxt.config.ts`。
- 拟新增共享设置/消息契约、OpenRouter 客户端、Discord DOM 适配器、翻译状态管理和共用样式 token；沿用 SolidJS、TypeScript、WXT 和原生 fetch。
- 权限：扩展 storage、Discord 页面匹配、OpenRouter host permission；不需要 Discord Bot、用户 token 或自建服务端。
- V1 验收基线为 Chrome MV3 + `discord.com` 网页版普通服务器文字频道；Firefox 保留构建兼容检查，不宣称已完成运行时验收。桌面客户端、私信、线程/论坛、其他 Discord 域名不计入首版验收。
- 不包含整频道翻译、输入框翻译、发送消息、附件/OCR/语音翻译、翻译历史、术语库、多提供商、模型市场或云同步。
- 实现与验证进度见 `tasks.md`；按用户追加要求增加默认关闭、即时保存的自动翻译开关，仅处理页面已加载的消息。
