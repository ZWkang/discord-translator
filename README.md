# Discord Translator

基于 WXT、SolidJS 和 TypeScript 的 Chrome 扩展。在 Discord 网页版文字频道的消息正文旁点击「翻译」，通过 OpenRouter 调用指定大模型，并在原文下一行显示译文。

## 使用

当前版本为 **0.1.0**，已接入双气泡线稿 logo。设置页右上角显示实际加载的版本号，可用于确认扩展是否更新。

1. 使用 Node.js 24+（见 `.nvmrc`），运行 `npm ci`、`npm run build`。
2. 在 Chrome 的 `chrome://extensions` 中开启开发者模式，加载已解压的扩展，选择本项目 `.output/chrome-mv3/`。
3. 打开扩展设置，填写自己的 OpenRouter API Key 和支持文本生成的完整模型 ID，选择目标语言后点击「保存设置」。默认简体中文，也支持英文、日文、韩文。保存不验证模型可用性；手动模式下不发起翻译，自动模式下按新配置处理已加载消息。仅支持 Chat Completions 的文本生成模型；例如 `typesafe/jev-1.13` 这类决策模型无法用于该翻译接口，错误区会提示更换模型。
4. 刷新 Discord 网页，在普通服务器文字频道点击消息旁的「翻译」。请求期间显示「翻译中…」，成功后显示译文，失败则显示原因、错误详情和「重试」。
5. 需要自动处理时，开启设置页顶部的「自动翻译」。开关默认关闭，点击即时保存；开启后处理当前已加载及新出现的文本消息，切换频道或原文更新后也会处理。关闭后停止新自动请求，已发出的请求继续完成，已有译文保留。失败消息只允许手动重试。

设置弹窗的内容宽度为 400px；从消息中的「打开设置」可进入独立设置标签页。独立页可适应 320px 宽度。成功译文使用紧凑文本行，不显示卡片边框或底色；语言标记为「简中 / EN / 日 / 韩」，悬停显示完整名称。原始消息保持可读，不发送 Discord 发言，不主动抓取未加载的频道历史。

移动或重命名项目文件夹后，浏览器中的扩展仍指向原加载路径，可能导致样式文件读取失败。重新构建后，在扩展管理页通过「加载已解压的扩展」选择新目录 `discord-translator/.output/chrome-mv3/`，再刷新 Discord；仅点击旧扩展的「重新加载」不会更新目录。

## 数据和失败行为

- API Key 保存在扩展的 `storage.local`，仅可信扩展上下文可读，不云同步。设置页默认遮蔽密钥，并提供清除操作；清除 Key 同时关闭自动翻译。本地存储不等于加密保险库。
- 每次翻译仅发送该条消息的可见正文与翻译指令给 OpenRouter 及所选模型提供方。自动模式会持续处理页面已加载的消息，可能增加费用。作者资料、回复预览、附件、隐藏文本、其他翻译扩展控件与已有译文不包含在请求内。调用可能产生费用。
- 请求使用用户指定模型；不自动重试、不切换模型、不截断正文。`lib/openrouter.ts` 明确设置 `provider.allow_fallbacks: false`，暴露上游提供方失败。
- 译文只保存在当前频道的页面内存。刷新、切频道、修改配置会清除状态；消息编辑使旧结果失效。同频道内滚动重挂载复用有效状态。
- 旧结果失效不保证已提交的上游请求取消或免计费。MV3 后台连接中断会显示失败，需要手动重试。
- 译文作为纯文本显示，不执行 HTML。凭据、请求正文和 provider 原始响应不写入日志。

## 开发与检查

```sh
npm ci
npm run dev             # Chrome 开发模式
npm run compile         # TypeScript
npm run test            # Vitest + jsdom，含真实 content/ShadowRoot/Solid 集成
npm run build           # .output/chrome-mv3/
npm run build:firefox    # 仅检查 Firefox 构建兼容性
npm run zip
```

V1 验收范围为 Chrome MV3 和 discord.com 普通服务器文字频道。私信、线程/论坛、桌面 Discord、OCR/附件/语音、输入翻译与自动发送不在本版范围。Firefox 尚未完成运行时验证；其构建仍提示扩展 ID 和数据收集声明缺失，不能据此宣称可上架或功能可用。

## 浏览器验证

默认使用 **ego lite**，操作入口为 `ego-browser`。Agent 先阅读 `.agents/skills/ego-browser/SKILL.md`；`npm run browser:*` 仅保留为旧的 agent-browser 辅助命令，不再作为默认验证方式。

```sh
ego-browser nodejs <<'EOF'
const task = await taskSpace('Discord Translator 验证');
console.log({ spaceId: task.spaceId, page: 'p1' });
const page = task.page('p1');
console.log(await page.snapshot());
EOF
```

通过扩展管理页读取本项目实际 ID，再打开 `chrome-extension://EXTENSION_ID/popup.html`。验证原生 popup 时还需打开 Chrome 工具栏中的扩展，不能仅用独立标签页截图替代。

同一验证目标只创建一个 TaskSpace，后续用输出的数字 ID 恢复。重建后先重载扩展和 Discord 页面，确保验证最新产物；其他已打开的 Discord 标签页也需刷新一次才能获得新版内容脚本。测试截图与验收记录保存在忽略目录 `.artifacts/verification/`。需要用户操作时调用 `task.handOff()`；验证完成后调用 `task.finish({ keep: [] })`，不关闭用户已有标签页、不清除登录态。不要提交 Cookie、登录状态或 API Key。

自动化测试在浏览器通信边界提供可控输入，验证真实解析、状态与组件代码；这些测试以及本地 UI 状态样本不代表真实 OpenRouter 调用通过。

2026-09-18 已在 ego lite 的真实 Discord 频道完成 OpenRouter 联调：实测 `qwen/qwen-2.5-7b-instruct` 的短句与多段文本翻译、缺配置/无效密钥/手动重试、后台中断、设置通知，以及在途请求期间切频道和本地正文变更的旧结果隔离。追加验证了自动开关即时保存、关闭后新消息保持 idle、开启后的频道切换和实时新消息自动触发。正文变更测试只修改浏览器本地 DOM 并恢复，没有向 Discord 发送或编辑发言。详细证据见 `.artifacts/verification/report.md`。50 个测试、类型检查、Chrome/Firefox 构建均通过；译文质量仅做样本检查，不是模型质量基准。

## 规划

当前变更位于 `openspec/changes/add-discord-message-translation/`，含行为规范、实现任务、真实 DOM 调查及新粗野主义 design token。任务清单只勾选已完成的实现与对应验证。

## 依赖安全修复

`addons-linter` 当前锁定 `image-size@2.0.2`，其 ICNS、JXL、HEIF 解析器存在畸形图片导致死循环的问题（[ICNS 公告](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr)、[JXL/HEIF 公告](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq)）。`package.json` 通过定向 `overrides` 将该依赖替换为已修复相关解析逻辑的 `2.0.4`，并由 `package-lock.json` 锁定。

升级 web-ext/addons-linter 后，若上游已采用修复版本，可删除该 override、重新安装，并运行 `npm audit`、类型检查、浏览器构建和 `web-ext lint` 验证。
