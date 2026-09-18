## 1. 共享契约与测试入口

- [x] 1.1 新增 `lib/messages.ts` 的设置/翻译消息契约、错误类型和输入检查；验证不合法请求被明确拒绝、公共配置类型不包含 API Key，并通过 `npm run compile`。
- [x] 1.2 添加 Vitest/jsdom 与 `npm run test`，按 `dom-evidence.md` 建立匿名化 DOM fixture；验证可运行真实提取/状态模块测试，fixture 不含用户聊天或凭据，不提供运行时 mock 翻译路径。

## 2. 设置存储与后台通信

- [x] 2.1 实现 `lib/settings.ts` 的单记录保存、revision、默认简体中文及 en/ja/ko、清除 Key 和可信上下文存储访问；以测试验证保存/恢复、写入失败不报成功、清 Key 保留模型/语言。
- [x] 2.2 实现后台设置 RPC、sender 校验和非敏感变更通知；验证 Discord 来源不能读取密钥或保存配置，popup 能完成设置操作，后台重启后公共配置可重新读取。
- [x] 2.3 更新 `wxt.config.ts` 权限和扩展元数据，准备 Discord 页面入口匹配；构建后检查 manifest 中只有必要 storage/Discord/OpenRouter 范围，没有 Google 示例或 all_urls。

## 3. OpenRouter 翻译服务

- [x] 3.1 实现 `lib/openrouter.ts` 固定 endpoint、用户选定模型、翻译 system prompt、单条 sourceText、非流式请求和 `allow_fallbacks: false`；契约测试核对 Bearer 请求、目标语言、没有频道上下文/身份信息/备用模型/自动重试。
- [x] 3.2 实现 HTTP/业务错误、choice 错误、空文本、非 JSON、截断/拒绝及 tool-only 响应处理；测试至少覆盖 401、402、429、5xx、HTTP 200 error、空结果、网络失败，验证没有原文回填与错误详情泄密。
- [x] 3.3 在后台接入翻译 RPC，读取一致的配置快照并核对 revision；测试缺配置与配置过期均不发模型请求，成功和失败都保留 requestId，消息通道失败可被调用方识别。

## 4. 新粗野主义设置页

- [x] 4.1 按 `design-tokens.md` 建立共享 `assets/styles/tokens.css`，替换 popup 模板布局、reset 和 HTML 标题/语言；在真实扩展页检查 400px/320px 布局、粗边框与硬阴影，无横向溢出。
- [x] 4.2 实现 Key/模型/语言字段、显示隐藏 Key、保存、清 Key、保存反馈与数据去向文案；通过浏览器验证关闭重开可恢复配置、缺字段提示准确、手动模式下保存不会调用模型，错误不会显示为成功。
- [x] 4.3 实现从消息错误区「打开设置」进入同一 popup.html 独立扩展标签页；验证能编辑/保存并使已有频道接收新公共配置，截图中不暴露 API Key。

## 5. Discord 消息适配与行内 UI

- [x] 5.1 按实查路径实现 `lib/discord-dom.ts` 的字符串 ID 解析、正文提取和注入排除；用 fixture 验证回复预览、作者、附件/投票、自有 host、`data-et-buttonswrapper` 和已有译文不进入请求，同时保留换行、链接显示文字、mention 与 emoji。
- [x] 5.2 实现 content script 初始扫描、增量 observer、SPA 导航与 WXT 失效清理；测试列表替换、新增消息和重复 mutation 不产生重复 host，自己的注入不会反复触发正文变更。
- [x] 5.3 实现正文末尾 action host 与正文后 result host，使用 ShadowRoot/Solid 及共享 token；实页验证原始节点不重建，正文/链接/头像/原生工具栏不被覆盖，长译文能撑开消息并保持正常滚动。
- [x] 5.4 实现 `lib/translation-state.ts` 与 idle/loading/success/error UI、单消息去重、独立消息并发和手动重试；测试快速重复点击只产生一个请求，A/B 乱序返回仍对应正确消息，成功只显示纯文本。
- [x] 5.5 实现正文编辑、配置 revision、频道 epoch、DOM 卸载/重挂载与迟到结果处理；测试旧响应无法覆盖新正文/新配置/新频道，同频道虚拟重挂载恢复有效结果且不自动请求。
- [x] 5.6 完成键盘操作、可见焦点、aria-busy/live 状态和 reduced-motion；浏览器验证 Enter/Space 可触发、loading 不抢焦点、不触发 Discord 快捷动作，深浅背景上的状态清晰。

## 6. 联调与交付验证

- [x] 6.1 使用可用 OpenRouter 配置完成一次真实「保存 → 消息点击 → loading → 译文下一行」调用，检查只发送所选正文；无有效凭据时将真实调用记录为未验证，不能以测试替身完成此项。
- [x] 6.2 对真实扩展验证缺配置、无效 Key、网络断开/后台 worker 中断、手动重试，以及频道切换/消息编辑时的迟到响应；确认 loading 均可结束且错误明确。编辑/删除使用有权修改的测试消息，不向公共频道发送测试发言。
- [x] 6.3 运行 `npm run compile`、`npm run test`、`npm run build`、`npm run build:firefox`；记录命令结果，并在生成的 Chrome manifest 核对权限与内容脚本范围。
- [x] 6.4 更新 README 的实际能力、配置流程、调用数据范围和已验证浏览器边界，补齐 popup/行内各状态截图及真实验收记录到 `.artifacts/`；确认不提交凭据/登录状态，使用 ego lite 的同一 TaskSpace 验证，成功后 finish，需用户操作时 handOff。

## 7. 自动翻译开关

- [x] 7.1 增加即时保存的自动翻译开关和本地设置字段；验证旧配置默认关闭、开关不改变翻译配置 revision、无配置时提示先保存、写入失败不伪造成功。
- [x] 7.2 接入已加载/新增/编辑消息及频道切换的自动触发；验证去重、关闭后不发新请求、在途请求继续完成、已有结果保留、失败不自动重试。
- [x] 7.3 补齐设置/后台权限与自动请求边界/内容脚本集成回归；运行类型检查、测试和浏览器构建并记录结果。
- [x] 7.4 在 ego lite 验证开关、真实自动翻译及关闭行为，更新 README、design/spec 和截图；完成后清理任务空间并保留有用的结果页。

## 8. 品牌素材接入与扩展更新

- [x] 8.1 将已生成的线稿 logo 接入 manifest 和 popup，更新包版本至 0.1.0 并展示实际运行版本；类型检查、Chrome/Firefox 构建和现有测试通过。
- [x] 8.2 在 ego lite 核对加载目录、重载扩展并读取运行时 manifest/新图标，打开刷新后的 Discord 页确认内容脚本，保留验证证据后完成任务空间。
