# Discord Translator

基于 WXT、SolidJS 和 TypeScript 的 Chrome 扩展。在 Discord 网页版文字频道手动或自动翻译消息，将译文保存在本地；相同内容优先复用记录，未命中时通过 OpenRouter 调用指定大模型，在原文下一行显示译文。

## 使用

当前版本为 **0.2.0**，新增本地翻译记录、记录管理页和显式重新翻译。设置页右上角显示实际加载的版本号，可用于确认扩展是否更新。

1. 使用 Node.js 24+（见 `.nvmrc`），运行 `npm ci`、`npm run build`。
2. 在 Chrome 的 `chrome://extensions` 中开启开发者模式，加载已解压的扩展，选择本项目 `.output/chrome-mv3/`。
3. 打开扩展设置，填写自己的 OpenRouter API Key，从「翻译模型」下拉框选择低价候选，或选「自定义模型」填写完整模型 ID；选择目标语言后点击「保存设置」。默认简体中文，也支持英文、日文、韩文。切换选项只修改草稿，保存后生效。保存不验证模型可用性；手动模式下不发起翻译，自动模式下按新配置处理已加载消息。仅支持 Chat Completions 的文本生成模型；例如 `typesafe/jev-1.13` 这类决策模型无法用于该翻译接口，错误区会提示更换模型。
4. 刷新 Discord 网页，在普通服务器文字频道点击消息旁的「翻译」。优先查询本地记录，命中时不调用模型；未命中时显示「翻译中…」，成功后显示译文并保存。两种成功结果均显示「已翻译」，本地记录来源通过悬停提示和可访问说明展示。失败显示原因、错误详情和「重试」。
5. 需要自动处理时，开启设置页顶部的「自动翻译」。开关默认关闭，点击即时保存；开启后处理当前已加载及新出现的文本消息，切换频道或原文更新后也会处理。关闭后停止新自动请求，已发出的请求继续完成，已有译文保留。失败消息只允许手动重试。
6. 在 popup 点击「翻译记录」，进入独立页面。按服务器、频道、目标语言和模型筛选，搜索原文或译文，展开完整内容与来源，或跳转到 Discord 原消息。记录按首次生成时间排列，较早记录可继续加载；新记录在刷新后显示。
7. 对译文不满意时，打开消息「已翻译」按钮的菜单，选择「重新翻译」。按钮右侧的线稿箭头表示菜单入口，展开时朝上。该操作绕过缓存并调用当前模型，等待时保留旧译文；新结果生成且保存成功才替换。失败保留旧记录并显示原因，保存失败的新文本可以作为未保存候选查看。

设置弹窗的内容宽度为 400px；从消息中的「打开设置」可进入独立设置标签页。独立页可适应 320px 宽度。成功译文使用紧凑文本行，不显示卡片边框或底色；语言标记为「简中 / EN / 日 / 韩」，悬停显示完整名称。原始消息保持可读，不发送 Discord 发言，不主动抓取未加载的频道历史。

移动或重命名项目文件夹后，浏览器中的扩展仍指向原加载路径，可能导致样式文件读取失败。重新构建后，在扩展管理页通过「加载已解压的扩展」选择新目录 `discord-translator/.output/chrome-mv3/`，再刷新 Discord；仅点击旧扩展的「重新加载」不会更新目录。

## 数据和失败行为

模型候选包括 Qwen2.5 7B Instruct、Qwen3 30B A3B Instruct 2507、Ministral 3 3B 和 Gemini 2.5 Flash-Lite。下拉框展示所选模型的输入/输出参考价格（美元/百万 token）、核对日期和官方链接；价格快照来自 [OpenRouter 模型目录](https://openrouter.ai/api/v1/models)，核对于 2026-09-20，不在打开 popup 时联网刷新，实际费用以提供方计费为准。已有模型会原样回显，列表外的 ID 显示为自定义，不自动替换。

- API Key 保存在扩展的 `storage.local`，仅可信扩展上下文可读，不云同步。设置页默认遮蔽密钥，并提供清除操作；清除 Key 同时关闭自动翻译。本地存储不等于加密保险库。
- 只有未命中记录或用户显式重新翻译时，才将该条消息的可见正文与翻译指令发送给 OpenRouter 及所选模型提供方。自动模式会持续处理页面已加载的消息，可能增加费用。作者资料、回复预览、附件、隐藏文本、其他翻译扩展控件与已有译文不包含在请求内。
- 请求使用用户指定模型；不自动重试、不切换模型、不截断正文。`lib/openrouter.ts` 明确设置 `provider.allow_fallbacks: false`，暴露上游提供方失败。
- 成功译文、原文、翻译参数、时间和 Discord 消息来源保存在扩展本地 IndexedDB，不云同步，不保存密钥或作者资料。刷新和切频道会清除页面内状态，后续处理可再次读取持久记录；同频道内滚动重挂载复用有效展示状态。
- 复用要求原文、目标语言、模型、提供方和翻译指令版本完全一致，允许跨 Discord 频道复用，并保留各自来源。换密钥不影响兼容记录；换模型/语言或编辑原文不会误用旧译文。手动模式仍需点击触发，不自动展开历史译文。
- 相同未命中请求共享一次生成及保存过程。记录按首次生成时间分页，复用和重译不会挪动原有位置；模型成功但保存失败会明确标记未保存，读取失败不会静默改成付费调用。
- 清除密钥会关闭自动翻译，保留模型、目标语言和记录；此后仍可手动复用已有记录，未命中和强制重译则需要重新配置凭据。
- 删除单条词条会同时删除它在所有频道的来源关联；「清空全部记录」作用于整个记录库，不限当前筛选。操作需要确认，失败不会假报成功。删除不会修改 Discord 消息或当前页面已经显示的译文，也不会自动重译；删除前的迟到结果不能重新写回，删除后新发起的翻译仍可生成记录。
- 本功能从启用后的成功翻译开始积累，不补回此前仅存在页面内存的结果。来源是保存时的快照，原消息可能已编辑、删除或失去访问权限。卸载扩展、更换浏览器配置或更换扩展 ID 不会自动迁移记录。
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

`entrypoints/history/` 是普通扩展页面。WXT 将 `history` 视为保留入口名，因此 `wxt.config.ts` 用 `entrypoints:found` 将其明确设为 `unlisted-page`；构建产物应包含 `history.html` 且不含 `chrome_url_overrides`。`fake-indexeddb` 仅用于测试，生产使用浏览器 IndexedDB。

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

2026-09-18 已在 ego lite 的真实 Discord 频道完成 OpenRouter 联调：实测 `qwen/qwen-2.5-7b-instruct` 的短句与多段翻译、缺配置/无效密钥/手动重试、后台中断、设置通知，以及在途请求期间切频道和本地正文变更的旧结果隔离。0.2.0 追加验证了真实保存、零模型调用的记录复用、无密钥复用、一次模型调用的显式重译、失败保留旧译文、跨频道来源、分页、搜索和删除。存储异常通过一次性 IndexedDB 故障注入验证，模型请求仍是真实调用；观察器和注入均在结束时还原。

SPA 来源验证使用浏览器原生 `sender.tab.url` 核对当前频道；`sender.url` 在 Discord 单页导航后可能仍是最初注入的文档地址。实页发现的问题已补回归。旧版验证详见 `.artifacts/verification/report.md`，本次详见 `.artifacts/verification/history-v020-report.md`。测试替身不代替真实模型验收，译文质量仅做样本检查，不是模型质量基准。没有向 Discord 发送、编辑或删除发言。

## 规划

当前变更为 `openspec/changes/add-discord-translation-memory/`，含本地记录、优先复用、重译及管理页规格。基础翻译与新粗野主义 design token 位于 `openspec/changes/add-discord-message-translation/`；已有能力基线已同步至 `openspec/specs/`。任务清单只勾选已完成的实现与对应验证。

## 依赖安全修复

`addons-linter` 当前锁定 `image-size@2.0.2`，其 ICNS、JXL、HEIF 解析器存在畸形图片导致死循环的问题（[ICNS 公告](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr)、[JXL/HEIF 公告](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq)）。`package.json` 通过定向 `overrides` 将该依赖替换为已修复相关解析逻辑的 `2.0.4`，并由 `package-lock.json` 锁定。

升级 web-ext/addons-linter 后，若上游已采用修复版本，可删除该 override、重新安装，并运行 `npm audit`、类型检查、浏览器构建和 `web-ext lint` 验证。
