# translation-interface Specification

## Purpose

为扩展设置页和 Discord 行内翻译建立统一、紧凑的新粗野主义视觉语言，让翻译操作、等待过程、结果和错误可以迅速区分。设计需保持频道可读性，并覆盖键盘操作、屏幕阅读器和减少动态效果的偏好。

## Requirements

### Requirement: Shared neobrutalist visual language

设置页与行内翻译 SHALL 使用 `openspec/changes/add-discord-message-translation/design-tokens.md` 定义的语义色、字号、边框、间距和状态规则；核心视觉为电光黄主操作、粗黑边框、直角与无模糊硬阴影。行内控件 SHALL 使用较小阴影和字号，且只影响扩展自己的界面。

#### Scenario: Settings and channel consistency
- **WHEN** 用户依次查看设置页和 Discord 频道内翻译控件
- **THEN** 两者的主操作、焦点、错误和文字角色一致，Discord 原有按钮和消息样式不被修改

### Requirement: Visible adjacent action and inline result

「翻译」按钮 SHALL 常驻在对应消息正文旁，不依赖 hover 才可发现；loading、译文与错误 SHALL 出现在原文下方的同一结果位置。空间不足时按钮可换行，但 MUST NOT 覆盖正文、头像或 Discord 原生操作。

成功译文 SHALL 使用无边框、无卡片底色的紧凑文本布局，语言标记和译文首行对齐，与原文间隔 4px；短译文不为语言标记单独占用一行，长译文仍完整自然换行。

#### Scenario: Long source text and narrow channel
- **WHEN** 消息包含长链接或频道可用宽度减小
- **THEN** 原文与按钮不重叠，译文自动换行，扩展区域不产生横向滚动

### Requirement: Accessible controls and status announcements

操作 SHALL 使用可聚焦、有明确名称的控件，支持 Tab、Enter/Space，并显示清晰焦点；loading SHALL 带文字与忙碌语义，结果 SHALL 可被辅助技术感知，错误 MUST NOT 只通过颜色表达。

#### Scenario: Keyboard translation
- **WHEN** 用户通过键盘聚焦翻译按钮并按 Enter 或 Space
- **THEN** 触发与鼠标点击相同的单条翻译流程，不触发 Discord 消息快捷操作

#### Scenario: Loading and error announcement
- **WHEN** 消息从空闲进入 loading，随后返回失败
- **THEN** 辅助技术可感知等待与失败文本，焦点不会被强制转移，重试入口可通过键盘使用

### Requirement: Readable compact layouts and reduced motion

设置页 SHALL 在 320 CSS px 可用宽度下无横向溢出；译文正文 SHALL 保持至少 14px 字号及可读行高。扩展控件 SHALL 在 Discord 浅色和深色背景下保持对比；减少动态效果开启时 SHALL 停止非必要旋转和位移动画，并保留「翻译中…」文字。

#### Scenario: Reduced motion
- **WHEN** 用户启用减少动态效果并发起翻译
- **THEN** loading 用静态图形与文字表达，不依赖动画传递状态

#### Scenario: Light and dark Discord themes
- **WHEN** Discord 切换浅色和深色主题
- **THEN** 成功译文跟随 Discord 消息文字色，按钮和错误使用扩展自己的表面与文字色，内容和焦点均清晰可辨
