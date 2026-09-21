# 开发与验证

[返回 README](../README.md)


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

## 依赖安全修复


`addons-linter` 当前锁定 `image-size@2.0.2`，其 ICNS、JXL、HEIF 解析器存在畸形图片导致死循环的问题（[ICNS 公告](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr)、[JXL/HEIF 公告](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq)）。`package.json` 通过定向 `overrides` 将该依赖替换为已修复相关解析逻辑的 `2.0.4`，并由 `package-lock.json` 锁定。

升级 web-ext/addons-linter 后，若上游已采用修复版本，可删除该 override、重新安装，并运行 `npm audit`、类型检查、浏览器构建和 `web-ext lint` 验证。
