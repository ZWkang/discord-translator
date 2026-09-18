# Discord Translate

基于 WXT、SolidJS 和 TypeScript 的浏览器扩展项目。目前仍是模板：popup 展示计数器，content script 匹配 Google 页面，尚未实现 Discord 翻译。

## 本地开发

使用 Node.js 24+（`.nvmrc` 指定 24）和 npm。

```sh
npm ci
npm run dev             # Chrome 开发模式，支持 HMR
npm run dev:firefox     # Firefox 开发模式
npm run compile         # TypeScript 类型检查
npm run build           # 输出到 .output/chrome-mv3/
npm run build:firefox   # Firefox 构建
npm run zip             # 打包 Chrome 扩展
```

## 依赖安全修复

`addons-linter` 当前锁定 `image-size@2.0.2`，其 ICNS、JXL、HEIF 解析器存在畸形图片导致死循环的问题（[ICNS 公告](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr)、[JXL/HEIF 公告](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq)）。`package.json` 通过定向 `overrides` 将该依赖替换为已修复相关解析逻辑的 `2.0.4`，并由 `package-lock.json` 锁定。

升级 web-ext/addons-linter 后，若上游已采用修复版本，可删除该 override、重新安装，并运行 `npm audit`、类型检查、浏览器构建和 `web-ext lint` 验证。

## 使用 agent-browser 验证扩展

[agent-browser](https://github.com/vercel-labs/agent-browser) 是开发阶段的浏览器自动化 CLI，已固定为开发依赖 `0.38.1`。通过 npm scripts 使用项目版本；本机全局版本可能不同。

```sh
npm run browser:install                 # 首次下载 Chrome for Testing
npm run browser -- skills get core      # 读取与安装版本匹配的操作指南
npm run browser:open                    # 构建、加载扩展，打开 chrome://extensions
npm run browser -- snapshot -i          # 获取交互元素及 @eN 引用
```

所有 `npm run browser -- ...` 命令使用独立的 `discord-translate` 会话。默认无头运行；需要查看浏览器窗口时，先关闭会话，再以可见模式加载构建产物：

```sh
npm run browser -- close
npm run browser -- --headed --extension .output/chrome-mv3 open chrome://extensions
```

在扩展管理页开启开发者模式，查看本项目的扩展 ID，再打开其真实 popup 页面。无头模式下，可以先从 `snapshot -i` 找到“开发者模式”按钮，用 `npm run browser -- click @eN` 点击，再用 `npm run browser -- snapshot`（不加 `-i`）读取 ID：

```sh
npm run browser -- open chrome-extension://EXTENSION_ID/popup.html
npm run browser -- snapshot -i
npm run browser -- find role button click --name "count is 0"
npm run browser -- snapshot -i            # 确认计数变为 1，并刷新元素引用
mkdir -p .artifacts/agent-browser
npm run browser -- screenshot ./.artifacts/agent-browser/popup.png
npm run browser -- errors
npm run browser -- close
```

将 `EXTENSION_ID` 替换为当前加载的扩展 ID。源代码修改后，先 `npm run browser -- close`，再 `npm run browser:open`，确保新会话加载最新构建；该流程不会自动跟随 WXT 开发服务热更新。

官方发现型 Skill 位于 `.agents/skills/agent-browser/SKILL.md`，并链接到 `.claude/skills/agent-browser`，安装来源为上游 `v0.38.1`。Agent 应先读取该 Skill，再通过项目命令加载完整指南。后续更新 CLI 时也应核对上游 Skill。

截图保存在已忽略的 `.artifacts/` 下。不要提交浏览器登录状态、Cookie 或令牌。当前没有自动化测试框架或覆盖率门槛；提交前至少完成类型检查、构建和受影响扩展流程的浏览器验证。
