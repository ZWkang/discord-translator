# Discord DOM 实查记录

检查日期：2026-09-18。目标：用户指定的 Discord 普通服务器文字频道（真实服务器、频道和消息 ID 已脱敏）。

通过用户现有 Google Chrome 窗口中已打开的 DevTools Elements 面板读取 DOM，并查看页面截图；没有发送消息、点击翻译、切换频道或调用模型。`agent-browser --auto-connect` 连到的是 Ardot 实例，因此改用原生 Chrome 可访问性工具读取现有 DevTools。检查后已结束项目的 agent-browser 会话。

## 已观察的结构

以下为去掉消息内容和用户资料后的结构摘要；占位符不是实际选择器值：

```text
main[aria-label="general （频道）"]
└─ div[data-jump-section="global"][role="group"]  ← 滚动容器
   └─ …
      └─ ol[data-list-id="chat-messages"][role="list"]
         ├─ div[role="separator"]                  ← 日期/未读分隔，不是消息
         └─ li#chat-messages-{channelId}-{messageId}
            └─ div[role="article"]
               [data-list-item-id="chat-messages___chat-messages-{channelId}-{messageId}"]
               ├─ div#message-reply-context-{messageId}  ← 回复预览
               ├─ div.contents_c19a55
               │  ├─ img + h3                     ← 作者/时间
               │  ├─ div#message-content-{messageId}
               │  │  ├─ span / text / link / emoji ← 原始正文
               │  │  └─ div[data-et-buttonswrapper] ← 已有扩展控件
               │  └─ div[data-et-translateresultdiv]← 已有扩展的结果区域
               ├─ div#message-accessories-{messageId} ← 附件/嵌入/反应区域
               └─ div.buttonContainer_c19a55       ← Discord 原生消息操作
```

样本 message ID 以 `{messageId}` 表示；实查同时看到多个其他 `li#chat-messages-…`、短文本、长多行正文、回复预览、链接嵌入、纯 emoji 和投票。这里只记录 DOM 结构，不保存频道发言副本。

## 对实现的直接约束

| 目的 | 决策 |
| --- | --- |
| 消息列表入口 | 在主聊天区定位 `ol[data-list-id="chat-messages"]`；不依赖本地化 aria-label 文案 |
| 消息身份 | 使用 `li` 的 `chat-messages-{channelId}-{messageId}`，所有 snowflake 保持字符串，不转换成 JS Number |
| 正文 | 只取该消息内精确匹配的 `#message-content-{messageId}`；不能用整个 article 的 innerText |
| 操作按钮 | 自有 inline ShadowRoot host 追加在正文末尾，保留现有正文节点与样式 |
| 译文/loading/错误 | 自有 block ShadowRoot host 放在正文之后、同一 contents 容器中，位于 accessories 外 |
| 排除范围 | 回复预览、作者/时间、附件卡片、投票、原生操作、已有扩展按钮与结果、自有 host 均不进入源文本 |
| 其他扩展 | `data-et-*` 来自当前环境的已有注入，不能作为 Discord 原生定位依赖；只在正文清洗时排除已观察到的注入子树，不删除它们 |
| 易变选择器 | `contents_c19a55`、`messageContent_c19a55` 等 hash class 只作为结构证据，不硬编码为主选择器 |

特别注意：不能一概删除所有 button/[role="button"]，因为 Discord 的 mention/emoji 也可能是可交互元素；应保留它们的可见文字或 emoji alt，仅剔除已知控件子树。

## 证据边界

- 当前浏览器已有名为「Discord 翻译器」的扩展和 `data-et-*` 注入，但当前仓库源码仍是 WXT 模板；没有证据证明二者来自同一项目。
- 实查证明了此频道、当前布局的消息结构与候选插入位置；没有修改 DOM 来验证挂载、React 重渲染或滚动高度更新。
- 没有进行真实 API 调用，也没有验证新消息、编辑、删除、虚拟滚动、紧凑布局、深浅主题切换。这些属于实现后的集成验收，不应把本次 DOM 检查描述为功能测试通过。
