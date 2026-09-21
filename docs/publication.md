# 公开发布文件范围

源码使用 Git 提交或 `git archive` 导出，不直接压缩本地项目文件夹。`.gitignore` 不会约束 Finder 或普通压缩工具。

## 源码包

在需要发布的改动已提交后运行：

```sh
mkdir -p .artifacts/releases
git archive --format=zip --prefix=discord-translator/ --output=.artifacts/releases/discord-translator-source.zip HEAD
```

该命令只包含 `HEAD` 已提交的文件，不包含未提交或被忽略的本地文件。`.gitattributes` 额外排除本地验证资料、环境配置和生成目录。示例环境文件仅允许使用 `.env.example` 或 `.env.*.example` 命名，内容必须是无凭据的占位符。

## 扩展包

使用 `npm run zip` 生成 Chrome 扩展，只发布 `.output/*-chrome.zip`，不要上传整个 `.output/` 或项目目录。

## 本地资料

`.artifacts/` 用于截图、验证报告和临时数据，保留在本机，不作为公开素材目录。对外展示的截图应单独检查并脱敏，避免暴露真实聊天、频道、账号或密钥。

`.env`、`.env.*`（示例文件除外）和 `web-ext.config.ts` 不提交。公开源码包也不包含 `.git/`；公开 Git 仓库则会公开提交历史，删除当前文件不能清除其历史版本。
