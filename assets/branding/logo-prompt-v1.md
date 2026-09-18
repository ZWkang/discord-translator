# Discord Translator 线稿 logo

生成方式：内置 imagegen。2026-09-18。

- `discord-translator-line-v1.png`：透明背景原图。
- `discord-translator-line-white-v1.png`：白底展示版。

## 原始提示词

Use case: logo-brand.
Create ONE original finished line-art logo for a browser extension that translates Discord chat messages. This is a compact app icon, not a brand presentation sheet.
Primary concept: two interlocking angular speech bubbles, with two very simple opposing directional arrow strokes integrated into the conversation symbol to suggest translation between languages. Make the whole mark feel like one coherent, immediately recognizable symbol rather than a collection of icons.
Style: confident contemporary monoline line art with a restrained neobrutalist character. Bold uniform black outlines, deliberate square corners and a few precise 45-degree joins, balanced negative space, crisp vector-like geometry, clean and polished. No sketch hatching or distressed texture. It must remain legible as a small browser toolbar icon.
Composition: a single centered compact mark on a square canvas, occupying about 72 percent of the canvas with generous even clear space. Flat front view.
Color: pure black line work only; unfilled interiors and a genuinely transparent alpha background.
Text: no brand name, no tagline, no letters.
Avoid: an enclosing badge or app tile, background color, gradients, shadows, 3D, mockup scenes, decorative extra lines, multiple variants, watermark, and Discord's existing mascot shape.
Deliver the logo itself at high resolution, suitable for extracting as a transparent PNG.

## 白底展示图提示词

Use case: precise-object-edit.
Edit the supplied transparent PNG logo. Produce a presentation preview by compositing this exact black line-art logo onto a completely solid pure white (#FFFFFF) background.
Preserve the logo's exact geometry, black strokes, composition, proportions, spacing, and canvas dimensions. The only change is replacing transparent pixels with white so the existing black outlined mark is clearly visible.
Do not redesign, add new symbols, introduce text, add shadows, add texture, or draw a border around the canvas. One centered logo, pure black and pure white.

## 接入记录

- 0.1.0 起，popup 顶部使用透明版 logo。
- `public/icon/discord-translator.png` 是白底展示版的原样副本，由 manifest 的 icons 映射引用，浏览器按所需尺寸显示。
- 保留原始生成文件，不覆盖源稿；当前已接入的图标不再引用绿色模板素材。
