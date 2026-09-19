## ADDED Requirements

### Requirement: Identify reused results without increasing normal row spacing

记录命中的行内结果 SHALL 继续使用当前无卡片底色、无边框、原文下方 4px 间距、语言标记与译文首行对齐的布局。本地记录与模型生成的成功结果，操作按钮 SHALL 统一显示「已翻译」；本地来源及未调用模型的信息 SHALL 通过悬停提示和可访问说明表达。正常复用 MUST NOT 为完整语言名称、来源网址或记录详情新增单独一行。

#### Scenario: Short reused translation
- **WHEN** 一条短消息命中本地记录
- **THEN** 「简中」等简短标签和译文同一行显示，按钮为「已翻译」，成功结果区域的占位与普通短译文一致

#### Scenario: Explain reuse without a mouse
- **WHEN** 用户通过键盘或辅助技术访问命中本地记录的「已翻译」按钮
- **THEN** 可以得知译文来自本地记录且未调用模型，不依赖颜色或鼠标悬停单独传达状态

### Requirement: Distinguish translation success from persistence failure

已返回真实译文但词条或来源保存失败时，结果 SHALL 保持可读，旁边出现简短「未保存」提示，并能展开非敏感错误详情。该提示 SHALL 只在异常或用户删除导致本次不保存时出现，MUST NOT 常驻增加每条正常译文的空间；存储失败不能显示为已保存。

#### Scenario: Successful model output cannot be stored
- **WHEN** 模型翻译成功但本地提交失败
- **THEN** 用户同时看到真实译文及未保存提示，可查看保存失败原因；界面不会自动重试模型

### Requirement: Offer compact and accessible regeneration controls

成功结果的状态按钮 SHALL 提供可通过鼠标及键盘打开的操作菜单，菜单内明确标为「重新翻译」，并说明该操作会重新调用模型。打开菜单 MUST NOT 本身触发请求。正常状态下 MUST NOT 为重译常驻新增一行操作或卡片。重译期间 SHALL 保留原译文，显示「重新翻译中…」及忙碌语义；完成或取消菜单时焦点应有明确返回位置。

消息旁的操作按钮 SHALL 使用 24px 最小高度、12px/18px 字号与行高、2px 6px 内边距、4px 图文间距，以及 1px 边框和硬阴影，各状态保持紧凑且文字完整可读。成功标记和菜单箭头 SHALL 使用统一线稿 SVG，复用 `--dt-inline-icon-size` 的 12px 尺寸、继承按钮颜色并垂直居中，不用字体字符充当图标。菜单箭头 SHALL 在关闭时朝下、展开时朝上；装饰图标 SHALL 对辅助技术隐藏，按钮通过 `aria-haspopup` 和 `aria-expanded` 表达菜单状态。

#### Scenario: Open the regeneration menu
- **WHEN** 用户点击或通过键盘打开已翻译消息的操作菜单
- **THEN** 菜单可访问并展示重新翻译动作，不触发 Discord 原生快捷操作，不调用模型

#### Scenario: Choose regeneration
- **WHEN** 用户明确选择「重新翻译」
- **THEN** 操作进入忙碌状态并禁止重复提交，原译文保留，辅助技术可感知本次操作进度

#### Scenario: Close without regeneration
- **WHEN** 用户按 Escape 或关闭菜单而未选择动作
- **THEN** 焦点回到状态按钮，原译文保持不变且没有模型请求
