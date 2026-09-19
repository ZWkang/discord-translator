# Discord Translator · Design tokens

状态：V1 设计规范，运行时映射已写入 `assets/styles/tokens.css`。适用范围：扩展 popup / 同一设置页的独立标签页，以及 Discord 消息内的翻译控件。架构与布局见 [design.md](design.md)。

## 视觉方向

主题是「贴在消息旁的翻译便签」：电光黄按钮是主要记忆点，黑色粗线界定操作与内容，硬阴影表示可按下的控件。设置页采用完整的新粗野主义表达，频道内将边框与阴影缩小；译文以阅读为主，不给每条消息加大色块标题。

不使用渐变、磨砂、柔光阴影、药丸按钮、装饰性编号、循环弹跳、远程字体或大型品牌插画。信息左对齐，颜色始终对应操作或状态。

## Color

| 原始 token | 值 | 用途 |
| --- | --- | --- |
| `--dt-ink` | `#000000` | 正文、粗边框、硬阴影 |
| `--dt-paper` | `#F7F7F2` | 设置页底色 |
| `--dt-yellow` | `#FFE500` | 翻译、保存等主操作 |
| `--dt-cyan` | `#56DDF1` | loading 与说明状态 |
| `--dt-green` | `#B7EDB2` | 已保存、已翻译状态 |
| `--dt-coral` | `#FFC9C1` | 错误底色 |

辅助中性色：`--dt-white: #FFFFFF`、`--dt-muted: #52525B`、`--dt-disabled: #E4E4E7`；焦点专用色：`--dt-focus: #2541FF`。

| 语义 token | 引用 | 使用规则 |
| --- | --- | --- |
| `--dt-bg` | `--dt-paper` | popup 页面背景 |
| `--dt-surface` | `--dt-white` | 输入框、普通容器；成功译文使用透明背景 |
| `--dt-text` / `--dt-border` | `--dt-ink` | 所有彩色表面上的文字/边框 |
| `--dt-text-muted` | `--dt-muted` | 仅在 paper/white 上使用的辅助文案 |
| `--dt-action-bg` | `--dt-yellow` | 主操作默认态 |
| `--dt-loading-bg` | `--dt-cyan` | 正在处理 |
| `--dt-success-bg` | `--dt-green` | 已保存、已翻译状态按钮；译文语言标记不使用色块 |
| `--dt-error-bg` | `--dt-coral` | 错误提示区域 |
| `--dt-disabled-bg` | `--dt-disabled` | 未提交/已完成的不可执行控件 |

黑色文字在 paper、white、yellow、cyan、green、coral 六个表面的计算对比度均超过 13:1；muted/paper 为 7.19:1，focus/paper 为 5.96:1。此处是颜色数值核算，不等于浏览器无障碍验收通过。不要用白字放在黄/青/绿/粉背景上。

## Typography

| token | 值 | 用途 |
| --- | --- | --- |
| `--dt-font-body` | `Arial, "PingFang SC", "Microsoft YaHei", sans-serif` | 表单、译文、辅助文案 |
| `--dt-font-display` | `"Arial Black", Arial, "PingFang SC", "Microsoft YaHei", sans-serif` | 仅设置页主标题 |
| `--dt-type-title` / `--dt-leading-title` | `28px` / `32px` | 标题，weight 900 |
| `--dt-type-section` / `--dt-leading-section` | `18px` / `26px` | 区块标题，weight 700 |
| `--dt-type-body` / `--dt-leading-body` | `14px` / `22px` | 字段内容、译文，weight 400 |
| `--dt-type-label` / `--dt-leading-label` | `13px` / `18px` | 字段标签/按钮，weight 700 |
| `--dt-type-caption` / `--dt-leading-caption` | `12px` / `18px` | 辅助说明、目标语言标签 |

不用全大写小标签或大字距。长译文 `white-space: pre-wrap; overflow-wrap: anywhere`，阅读宽度不超过 `72ch` 且不超过父容器；不截断、不固定结果高度。中文正文不能使用 display 字体。

## Spacing, shape and elevation

| token | 值 | 典型使用 |
| --- | --- | --- |
| `--dt-space-1` 至 `--dt-space-8` | `4px, 8px, 12px, 16px, 20px, 24px, 28px, 32px` | 统一 4px 基础刻度 |
| `--dt-border-control` | `2px solid var(--dt-ink)` | 按钮、输入框、loading/错误区域；成功译文无边框 |
| `--dt-border-compact` | `1px solid var(--dt-ink)` | 消息旁的小号翻译按钮 |
| `--dt-border-frame` | `3px solid var(--dt-ink)` | 设置页主区域 |
| `--dt-radius` | `0px` | 主界面直角 |
| `--dt-shadow-control` | `4px 4px 0 var(--dt-ink)` | popup 主按钮 |
| `--dt-shadow-inline` | `2px 2px 0 var(--dt-ink)` | 菜单、设置开关和小型面板 |
| `--dt-shadow-compact` | `1px 1px 0 var(--dt-ink)` | 消息旁的小号翻译按钮 |
| `--dt-shadow-panel` | `6px 6px 0 var(--dt-ink)` | 设置页唯一主表单容器 |
| `--dt-popup-width` | `400px` | 独立页可用宽度不足时缩为 100% |
| `--dt-control-height` | `44px` | popup 字段与主按钮的最小高度 |
| `--dt-inline-height` | `24px` | 消息翻译按钮的最小高度 |
| `--dt-inline-icon-size` | `12px` | 消息按钮内的成功、菜单与 loading 图标 |
| `--dt-icon-size` | `16px` | 默认图标；消息按钮内局部使用 `--dt-inline-icon-size` |

popup 外边距/内边距 20px，字段组间距 16px，label 到字段 8px；底部为硬阴影预留空间。正文末尾按钮与原文间距 8px；成功译文与原文垂直间距 4px，无 padding、边框、底色和阴影。语言标记与译文基线对齐，水平间距 8px；单行结果为 22px 行高。loading/错误保留独立状态底色与原有 padding。扩展 host 不使用全局浮层或超过 Discord 弹窗的 z-index。

消息按钮使用 12px/18px 字号与行高、2px 6px 内边距、4px 图文间距，最小高度 24px；边框和硬阴影各 1px。各状态复用这一尺寸，避免密集消息列表被操作按钮撑高。菜单与设置页继续使用各自原有尺寸。

成功译文复用 Discord 实页已有的 `--text-default`，语言标记复用 `--text-muted`，随宿主深浅主题变化；不得直接继承父级 contents 的 color，该父级在实查深色主题中为暗色，而原文通过 `--text-default` 使用浅色。popup 与状态按钮继续使用扩展自己的语义色。

行内语言标记使用短标签：简体中文为「简中」、英文为「EN」、日文为「日」、韩文为「韩」。悬停展示完整语言名称；设置页保留完整选项名称。

## Interaction and state tokens

| 状态 | 按钮 | 结果区域 | 动作 |
| --- | --- | --- | --- |
| idle | 黄底「翻译」，2px 黑框/阴影 | 不占位 | 点击开始 |
| hover | 黄底，向左上 1px，阴影相应增加 1px | 不变 | 不改变按钮尺寸或正文流 |
| pressed | 向右下 1px，阴影减少 1px | 不变 | 有按下反馈 |
| loading | 青底「翻译中…」，`aria-disabled=true` | 青底小状态行，图标 + 文案 | 拒绝重复提交；保留焦点 |
| success | 绿底「已翻译」，`aria-disabled=true` | 透明背景，语言标记和译文在同一行，无独立卡片 | 不自动重译 |
| error | 粉底「重试」 | 粉底原因 + 错误码（若有） | 仅主动重试 |
| unconfigured | 「翻译」仍可聚焦 | 点击后显示缺失项和「打开设置」 | 不发请求 |
| disabled form control | 灰底/黑字，无阴影 | 文案说明原因 | 不靠 opacity 降低可读性 |

焦点：`2px` paper 间隔加 `3px` focus 外环，不能被硬阴影遮挡；颜色外还保留轮廓形状。对深色 Discord 背景同样使用明确的浅色控件表面，V1 不做独立暗色 token 组。

`--dt-motion-fast: 120ms`、`--dt-motion-ease: ease-out`；只用于交互位移与阴影变化。loading 图标可 `800ms linear infinite` 旋转，不显示虚假百分比。`prefers-reduced-motion: reduce` 时取消旋转、过渡和位移，仍显示静态图标与「翻译中…」。

## Runtime mapping contract

实现时将本文件的 token 映射到单一 `assets/styles/tokens.css`，popup 与 content UI 共用导入；不要复制两套颜色值。CSS 变量统一 `--dt-` 前缀，组件类名统一 `dt-` 前缀。

```css
/* 核心颜色映射；完整运行时定义见 assets/styles/tokens.css。 */
:root,
:host {
  --dt-ink: #000000;
  --dt-paper: #f7f7f2;
  --dt-yellow: #ffe500;
  --dt-cyan: #56ddf1;
  --dt-green: #b7edb2;
  --dt-coral: #ffc9c1;
  --dt-white: #ffffff;
  --dt-muted: #52525b;
  --dt-disabled: #e4e4e7;
  --dt-focus: #2541ff;
  --dt-bg: var(--dt-paper);
  --dt-surface: var(--dt-white);
  --dt-text: var(--dt-ink);
  --dt-border: var(--dt-ink);
  --dt-text-muted: var(--dt-muted);
  --dt-action-bg: var(--dt-yellow);
  --dt-loading-bg: var(--dt-cyan);
  --dt-success-bg: var(--dt-green);
  --dt-error-bg: var(--dt-coral);
  --dt-disabled-bg: var(--dt-disabled);
}
```

content UI 使用隔离的 ShadowRoot 并在自身根部设定字体/字号/box-sizing，尺寸 token 用 px 避免依赖 Discord 根节点的 rem 比例；浏览器缩放仍有效。popup 的 reset 只加载到 popup，不注入 Discord 全局。

## Design review

- 风格与任务一致：突出一次主动翻译，视觉焦点在消息旁的黄色按钮。
- 根据用户对占位的反馈，成功译文从白色卡片收敛为紧凑文本行；保留语言标记、完整译文和自然换行。
- 设置页只有一个纵向表单，不扩展为 dashboard；提供商固定显示 OpenRouter，不放无实际用途的 provider 选择器。
- 下一阶段视觉验收以真实 popup 和频道截图为依据；本文件不是截图验证记录。

## 自动翻译开关

设置页标题下提供即时保存的 switch。尺寸 52×32px，2px 黑框与 2px 硬阴影，白色直角滑块；关闭为灰底，开启为电光黄。支持原生按钮键盘操作、aria-checked、完整名称和焦点描边；reduced-motion 下不执行滑块动画。旁边说明处理已加载/新出现消息及调用费用。
