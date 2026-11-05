<div align="center">

# custom-svga

面向 Vue 3 与现代浏览器的 SVGA 动画播放器 —— **gzip 13.3KB，零运行时依赖**。

[English](./README.md) | **简体中文**

[![npm version](https://img.shields.io/npm/v/custom-svga)](https://www.npmjs.com/package/custom-svga)
[![npm downloads](https://img.shields.io/npm/dm/custom-svga)](https://www.npmjs.com/package/custom-svga)
[![minzipped size](https://img.shields.io/bundlephobia/minzip/custom-svga)](https://bundlephobia.com/package/custom-svga)
[![license](https://img.shields.io/npm/l/custom-svga)](https://www.npmjs.com/package/custom-svga)
[![GitHub stars](https://img.shields.io/github/stars/1707979815/SVGA-Web?style=social&label=Star)](https://github.com/1707979815/SVGA-Web)

```
同构内联 Worker · 动态精灵/文本替换 · 抽帧渲染 · DPR 上限 · 可摇树
```

</div>

<!-- TODO: 录屏后替换为真实 GIF：![preview](./docs/preview.gif) -->
**[在线演示](https://1707979815.github.io/SVGA-Web/)** —— 展示页、单实例回归页与多实例压力页。

- **同构内联 Worker 解析**：真实 Web Worker 可用时自动在 Worker 内解析；不支持/受限时主线程 `MockWorker`（沙箱 `new Function`）复用同一份代码降级，零配置。
- **构建期内联**：解析代码在打包时编译为字符串内联进主包，单入口、无独立 worker 产物、无需额外部署 worker 文件。
- **动态精灵/文本替换**、海报、正/逆序、缩放适配、帧区间/播放至指定帧、循环与结束行为。
- **为移动端调优**：抽帧渲染、Path2D 预缓存、帧位图缓存、DPR 上限、视口外自动暂停。

## 为什么选 custom-svga

**同类里体积最小，可调项却最多。** gzip 体积约为官方包的一半到三分之一，同时额外提供一批贴近业务场景的播放控制项。

包体积（gzip，整包，无代码分割）：

| 包 | 版本 | gzip | 相对本包 |
|---|---|---|---|
| **custom-svga** | 2.4.1 | **13.3 KB** | — |
| `svga.lite` | 1.6.x | ~27 KB（其 README 自述） | 约 2 倍 |
| `svgaplayerweb` | 2.3.x | ~34 KB（Bundlephobia） | 约 2.6 倍 |

除了基本播放，还额外提供：

| 能力 | 作用 |
|---|---|
| **内联 worker** | 解析器随主包一起走，不需要往 `public/` 部署 worker 文件，也没有版本同步问题 |
| **同构降级** | 真 Worker 不可用（CSP、旧 webview）时，同一份代码在主线程运行，动画不会白屏 |
| **`frameThrottling`** | 复杂动效可限制画面刷新率（如 15fps），时间轴、时长与事件完全不受影响 |
| **`maxDpr`** | 按画布封顶 `devicePixelRatio`：光栅化像素更少、内存更低，低端安卓收益明显 |
| **`cacheFrames`** | 循环区间能装进 `maxCacheFrames` 时，把已绘制帧缓存成位图，回放退化为纯 `drawImage` |
| **`defaultPoster`** | 播放前、加载失败、`fillMode: 'clear'` 停播后的静态封面，规避白屏 |
| **`onPoster` 事件** | 告知海报出现的**原因**（`defaultPoster` / `external`），便于打点统计失败率 |
| **`invisibleBehavior`** | 滚出视口时可选 `pause`（停时间轴）或 `skip`（只跳绘制、时间轴继续） |
| **`skipRender()`** | 挂起绘制但保留时间轴，适合切 tab、弹窗遮挡等场景 |
| **完整 TypeScript** | 配置项、事件载荷、数据结构全部有类型，业务侧不需要 `any` 断言 |

还有一处迁移后立刻能感知的行为差异：**每一次循环的最后一帧都一定会被绘制**，详见 [循环播放](#循环播放最后一帧一定会画出来)。

## 极致轻量 · 为移动端而生

- **体积极小、冷启动快**：单包 gzip 仅 ~13KB、零运行时依赖，不引入任何 UI 框架与重型运行时，首帧可快速拉起，特别适合移动端低端机与包体敏感场景。
- **移动端更省电省内存**：
  - 复杂动效**抽帧渲染**（`frameThrottling`，目标渲染帧率可调）：动画时间轴照常推进、动效时长不变，仅降低画面刷新频率，显著降低单帧绘制对主线程的阻塞；
  - **Path2D 预缓存 / 帧位图缓存 / 动态文本位图化**，把每帧重计算与重复光栅化降到最低，显著降低 GPU/CPU 负载；
  - 大画布 / 低端机可**封顶 DPR**（`maxDpr`，默认不限制）：把每帧光栅化像素从 9× 降到 4×/2.25×，用少量清晰度换明显性能（`frameThrottling` 管时间维度，`maxDpr` 管空间维度）；
  - 视口不可见时自动**暂停播放**（`useIntersectionObserver`），滚动列表外动画零开销。
- **按需装配**：解析与渲染均为函数式、可摇树（`sideEffects: false`），按打包工具自动剔除未用代码，最终体积进一步收缩。

## 安装

```bash
npm i custom-svga
# 或 CDN <script src="https://unpkg.com/custom-svga"></script> → window.CustomSvga
```

## 快速开始（Vue3）

```vue
<script setup>
import { ref, onBeforeUnmount } from 'vue'
import { Player, Parser } from 'custom-svga'

const canvas = ref(null)
let player = null

async function load() {
  player?.destroy()
  player = new Player(canvas.value, { loop: 0, scaleMode: 'AspectFit' })
  player.onReady(() => player.play())
  const movie = await Parser.loadUrl('https://example.com/anim.svga')
  player.setVideoItem(movie)
}
onBeforeUnmount(() => player?.destroy())
</script>

<template><canvas ref="canvas"></canvas></template>
```

## 从 svgaplayerweb / svga.lite 迁移

API 有意保持接近，多数项目只需要改「加载入口」和「播放入口」两处：

| `svgaplayerweb` | `custom-svga` | 说明 |
|---|---|---|
| `new SVGA.Player(canvas)` | `new Player(canvas \| div, config?)` | 传容器 `div` 时 canvas 由库自动创建与管理 |
| `new SVGA.Parser()` + `parser.load(url, cb)` | `await Parser.loadUrl(url)` | Promise 化，共用 Worker，内置 LRU 缓存 |
| `player.setVideoItem(item)` | 同名 | 只接受 `Parser` 的解析结果；下载 / 解析请先走 `Parser.loadUrl` |
| `player.startAnimation()` | `player.play(config?)` | 配置通过参数传入，而非实例属性 |
| `player.pauseAnimation()` | `player.pause()` | |
| `player.stopAnimation()` | `player.stop()` | 按 `fillMode` 决定停在末帧/首帧/清空 |
| `player.stepToFrame(n, play)` | `player.stepToFrame(n, andPlay?)` | |
| `player.stepToPercentage(p)` | 同名 | |
| `player.setImage(url, key)` | 同名 | |
| `player.setText(dynamicText, key)` | 同名 | `{ text, size, color, family }` |
| `player.clearDynamicObjects()` | `player.clearDynamic(key?)` | 省略 `key` 时清空全部 |
| `player.loops = n` | `play({ loop: n })` | `0` 为无限循环 |
| `player.clearsAfterStop = true/false` | `fillMode: 'clear' \| 'forwards' \| 'backwards'` | |
| `player.onFrame(cb)` | `player.onProcess(cb)` | 回调参数为当前帧号 |
| `player.onFinished(cb)` | `player.onEnd(cb)` / `player.onLoopEnd(cb)` | `onEnd` 仅在有限 `loop` 结束时触发 |

切换前需要知道的三点差异：

- **解析是 Promise 而非回调**，缓存与并发去重已内置（`Parser.clear()` / `Parser.delete(key)`）。
- **Worker 随包内联**，不需要再往 `public/` 拷 `svga.worker.js`，也不存在解析器与播放器版本不一致的问题。
- **循环边界是完整的**：每次循环的最后一帧都会先绘制再回绕，慢速礼物动效不会再出现「结尾被吞掉」的观感，详见 [循环播放](#循环播放最后一帧一定会画出来)。

如果你在迁移中遇到映射不上的写法，欢迎带代码片段提 issue —— 迁移断层会当作 bug 处理。

## Player

### 构造函数

```ts
new Player(element, config?)
// element: HTMLCanvasElement | HTMLDivElement（div 容器模式会自动创建并管理画布）
```

### 方法

| 方法 | 返回值 | 说明 |
|---|---|---|
| `setVideoItem(movie)` | `Promise<void>` | 装载 `Parser` 的解析结果（`MovieData`）。装载失败先回落到 `defaultPoster`，再按「有 `onError` 监听就只回调、无监听才 reject」的单一通道报错。 |
| `play(config?)` | `void` | 开始 / 恢复播放。传入的 `config` 会**持久写入**实例。上一次自然循环结束后再调用，会从区间进入帧重新开始。 |
| `setConfig(config?)` | `void` | 仅更新配置，不触发播放；播放中同样即时生效（`frameThrottling` 下一帧生效）。 |
| `playRange(startFrame, endFrame, config?)` | `void` | 播放指定帧区间，等价于 `setConfig({ startFrame, endFrame })` + `play()`。 |
| `pause()` | `void` | 暂停在当前帧，画面保持不动。 |
| `stop()` | `void` | 结束播放并按 `fillMode` 收尾（`forwards` 停在末帧 / `backwards` 回顾首帧 / `clear` 清屏并补海报）。 |
| `skipRender(skip?)` | `boolean` | 挂起 / 恢复绘制，帧时间轴照常推进。不传参即切换，返回切换后的状态。 |
| `stepToFrame(frame, andPlay?)` | `void` | 跳转到绝对帧，越界值被忽略。`andPlay` 默认 `false`（跳转后暂停）。 |
| `stepToPercentage(p, andPlay?)` | `void` | 按进度跳转，`p` 会被钳制到 `[0, 1]`。 |
| `setImage(img \| url, key)` | `Promise<void>` | 替换图层图片，支持 `HTMLImageElement` / `ImageBitmap` / `HTMLCanvasElement` / URL 字符串。`key` 必须是素材中真实存在的 `imageKey`。 |
| `setText(text \| DynamicText, key)` | `void` | 把图层替换为文本，详见下方 `DynamicText`。 |
| `clearDynamic(key?)` | `void` | 清除指定图层的动态替换；不传 `key` 则清空全部。 |
| `renderPoster(url)` | `Promise<void>` | 立即把一张外链图片画到画布（一次性的，区别于 `defaultPoster` 的常驻兜底）。 |
| `resize()` | `void` | 重新测量容器尺寸与 DPR 并调整后备存储；容器尺寸变化时会自动调用。 |
| `clear()` | `void` | 清空当前动画数据与画布，实例保留，可再次 `setVideoItem`。 |
| `destroy()` | `void` | 彻底销毁：画布（内部创建的）、监听、RAF、缓存位图与海报全部释放，之后需要重新 `new Player`。 |

### DynamicText

`setText` 的第二个参数既可以是纯字符串，也可以是配置对象：

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `text` | `string` | — | 文本内容（必填） |
| `size` | `string \| number` | `'14px'` | 字号，如 `'18px'` 或 `18` |
| `family` | `string` | `'Arial'` | 字体族 |
| `color` | `string` | `'#000000'` | 填充色，任意 CSS 颜色 |
| `offset` | `{ x: number; y: number }` | `{ x: 0, y: 0 }` | 相对图层自身中心的偏移量 |

文本以被替换图层的布局盒为基准居中绘制，需要微调基线或位置时用 `offset`。

### SCALE_MODE

| 值 | 枚举 | 行为 |
|---|---|---|
| `Fill` | `SCALE_MODE.FILL` | 拉伸充满容器，不保持宽高比 |
| `AspectFill` | `SCALE_MODE.ASPECT_FILL` | 保持宽高比，裁剪居中覆盖（类似 `cover`） |
| `AspectFit` | `SCALE_MODE.ASPECT_FIT` | 保持宽高比，完整显示并留白居中（类似 `contain`，默认） |

### 运行时更新配置

`setConfig` 只更新配置、不触发播放，适合实例化后动态调整；`play(config)` 等价于「先 `setConfig` 再播放」，配置会持久写入实例。

```ts
import { SCALE_MODE } from 'custom-svga'

// 静默更新（未播放时可改适配模式、帧缓存、海报等）
player.setConfig({ scaleMode: SCALE_MODE.ASPECT_FILL, maxCacheFrames: 200 })

// 播放中改 fps / 帧区间 / 抽帧同样即时生效
player.setConfig({ fps: 30, frameThrottling: 20 })

// 大画布 / 低端机：封顶 DPR 降像素量（0 = 取消限制）
player.setConfig({ maxDpr: 2 })

// play(config) = setConfig(config) + 播放，且配置持久保留
player.play({ loop: 2 })
```

### 事件

| 事件 | 回调参数 | 触发时机 |
|---|---|---|
| `onReady` | `MovieData?` | 数据就绪 |
| `onError` | `Error` | 运行/加载异常 |
| `onStart` / `onPause` / `onStop` | - | 对应生命周期 |
| `onLoopEnd` | - | 每轮循环结束（含最后一轮） |
| `onEnd` | - | 播放彻底结束（仅当配置有限 `loop` 达到上限停摆时触发；`loop: 0` 无限循环与手动 `stop`/`pause` 不触发） |
| `onProcess` | `frame: number` | 每推进一帧 |
| `onPoster` | `PosterEventInfo` | 海报展示/隐藏切换 |

## Parser

静态方法（多个调用**共用同一共享 Worker 线程**）：

```ts
Parser.load(source, options?)          // source: url | File | Blob
Parser.loadUrl(url, options?)
Parser.loadFile(file, options?)
Parser.parseBuffer(buffer, options?)
Parser.delete(key)                     // 清除单个缓存
Parser.clear()                         // 清空全部缓存（保留共享 Worker）
Parser.destroy()                       // 清空全部缓存并释放共享 Worker（下次解析按需重建）
```

实例化（**每个实例持有独立 Worker**，解析配置在实例化时一次性声明，方法不再逐次传 options）：

```ts
const parser = new Parser({ useWorker: true, cache: true, autoClose: false })
await parser.loadUrl(url)              // 与静态签名一致，但走独立 Worker 线程
await parser.load(file)                // loadUrl / loadFile / parseBuffer 同理
parser.delete(key) / parser.clear() / parser.destroy()
```

内存/文件信息（独立导出，内部复用全局缓存）：

```ts
import { queryMemoryInfo } from 'custom-svga'
await queryMemoryInfo(url, true)       // log=true 打印表格
```

### ParserOptions

| 选项 | 默认值 | 说明 |
|---|---|---|
| `useWorker` | `true` | 传 `false` 时强制走同构 `MockWorker` 在主线程解析（同一份代码，不占线程） |
| `cache` | `true` | 是否写入全局 20 条 LRU 缓存 |
| `useImageBitmap` | `false` | 是否解码为 `ImageBitmap`（绘制更快，但淘汰时需要显式 `close()` 释放）；环境缺少 `createImageBitmap` 时自动降级为主线程 `HTMLImageElement`，不会失显 |
| `movieDataId` | - | 显式缓存键。缓冲解析想进缓存必须传它；实例形态下同时作为实例级缓存键 |
| `autoClose` | `false` | 仅实例可用：每次解析成功后释放 Worker，适合低频 / 一次性解析 |

缓冲解析（`loadFile` / `parseBuffer`）只有在显式传入 `movieDataId` 时才写入缓存：匿名缓冲没有稳定键，不缓存以免污染 LRU。

### queryMemoryInfo

```ts
const info = await queryMemoryInfo(url, true) // log = false 可关闭 console.table
// { fileSize, imageMemory, dictionaryMemory, version, fps, frames, width, height, desc }
```

`fileSize` 是 SVGA 原始大小；`imageMemory` 按每张图 `width × height × 4` 估算解码后的位图内存；`dictionaryMemory` 是 params + sprites 的 JSON 体积。排查「这个动效为什么这么吃内存」时很有用。

## PlayConfig

| 配置 | 默认 | 说明 |
|---|---|---|
| `loop` | `0` | 循环次数，0=无限 |
| `fps` | 源文件 | 覆盖帧率 |
| `fillMode` | `forwards` | 播放结束行为：`forwards`末帧 / `backwards`首帧 / `clear`清空 |
| `startFrame` / `endFrame` | - | 播放区间 |
| `direction` | `forward` | 播放方向：`forward` / `backward`（逆序） |
| `scaleMode` | `AspectFit` | `SCALE_MODE`：`AspectFit` / `AspectFill` / `Fill` |
| `maxDpr` | 不限制 | `devicePixelRatio` 上限：画布按 `min(devicePixelRatio, maxDpr)` 出图。大画布 / 低端机降像素量换性能（画面会变软），小尺寸动效无需设置；`0`/不传 = 不限制 |
| `useIntersectionObserver` | `true` | 视口不可见优化 |
| `invisibleBehavior` | `pause` | 不可见时 `pause`（停走）或 `skip`（仅跳绘制，帧仍走） |
| `frameThrottling` | `0` | 抽帧渲染（适合复杂动效）：目标渲染帧率上限（fps），时间轴照常推进、时长不变 |
| `cacheFrames` / `maxCacheFrames` | `false` / `100` | 帧缓存（位图化）。仅当循环区间帧数 ≤ `maxCacheFrames` 时启用，装不下则整体禁用并提示；大画布建议改用 `frameThrottling` |
| `defaultPoster` | - | 默认静态封面：播放前、加载失败、`fillMode: 'clear'` 停播后显示，详见 [默认静态海报](#默认静态海报defaultposter) |
| `autoPlay` | `false` | `setVideoItem` 装载完成后是否立即自动播放 |

## 默认静态海报（defaultPoster）

`defaultPoster` 是一张**外链图片**，用来盖住「当前没有动画可画」的那些时刻。它不是独立图层，而是画在同一条 canvas 上的兜底帧。

### 什么时候出现

| 时机 | 原因 |
|---|---|
| 实例创建后、`setVideoItem` 之前 | 容器先显示封面，而不是一个空盒子 |
| `setVideoItem` 装载失败 | 传入数据不合法等；同时会触发 `onError`。下载 / 解析失败发生在 `Parser`，需自行用 `renderPoster` 兜底 |
| `stop()` 且 `fillMode: 'clear'` | 画布被清空，海报回填画面 |
| `clear()` 之后 | 动画数据已清空但实例还在，海报接替画面 |
| 未播放时 `setConfig({ defaultPoster })` | 换图后立刻重绘 |

`play()` 开始播放、`setVideoItem` 装载新动画时会自动隐藏海报。

### 典型场景

- **礼物 / 信息流动效**：卡片先渲染封面，解析完成后无缝换成动画，不跳布局、不白屏。
- **弱网兜底**：SVGA 文件从几百 KB 到几 MB，加载失败时至少有一张静态图，而不是空白方块。
- **暂停态展示**：`fillMode: 'clear'` 下用户停止播放，卡片回到封面图。
- **尺寸对齐**：海报按与动画相同的 `scaleMode` 规则缩放，占位和播放时的位置一致。

### 用法

```ts
const player = new Player(canvas, {
  loop: 0,
  fillMode: 'clear',
  defaultPoster: 'https://example.com/anim-cover.png',
})

// 可观测：source 会告诉你海报为什么出现
player.onPoster(({ state, source, url }) => {
  if (state === 'show') console.log('海报出现', source, url)
})

// 运行中换一张（未播放时会立刻重绘）
player.setConfig({ defaultPoster: 'https://example.com/cover-2.png' })
```

`onPoster` 回调载荷：

| 字段 | 取值 | 含义 |
|---|---|---|
| `state` | `'show'` / `'hide'` | 海报出现 / 被动画画面取代 |
| `source` | `'defaultPoster'` | 配置的默认海报被绘制（空闲 / 清屏 / 尺寸变化重绘） |
| | `'external'` | 调用了 `renderPoster()`，或加载失败时用海报兜底 |
| | `'play'` / `'setMovie'` | 隐藏事件：开始播放 / 装载了新动画 |
| `url` | `string?` | 海报地址，仅在 `show` 时携带 |

### `defaultPoster` 与 `renderPoster()` 的区别

| | `defaultPoster` | `player.renderPoster(url)` |
|---|---|---|
| 性质 | 配置项（被动兜底） | 方法（主动绘制一次） |
| 触发 | 未播放 / 失败 / 清屏时自动出现 | 只有你调用时才画 |
| 生命周期 | 常驻实例，`destroy()` 时释放 | 只画当前这一帧，下次绘制可能被覆盖 |

> 海报是外链图片，跨域时以 `crossorigin="anonymous"` 加载，因此图片服务器必须返回 CORS 头，否则加载失败、海报静默不显示。

## 循环播放：最后一帧一定会画出来

如果你的项目是从别的 SVGA 播放器迁移过来的，可能会注意到循环衔接处**最后一帧像是被吞掉了**：画面从倒数第二帧直接跳回首帧。慢速动效（8–12fps 的礼物动画）和短循环尤其明显。

本库的帧驱动顺序是「**先绘制，后推进**」：

1. 绘制 `currentFrame`；
2. 触发 `onProcess(currentFrame)`；
3. `currentFrame++`；
4. 只有越过 `endFrame` 时才进入循环收尾（`onLoopEnd` → `onEnd` → 停摆）。

所以 `currentFrame === endFrame` 的那一帧一定先被画出来，回绕发生在它之后。自定义区间（`startFrame` / `endFrame`）与 `direction: 'backward'` 反向播放同样成立——反向时最后看到的是 `startFrame`。

> 开启 `frameThrottling` 抽帧后，为了压低刷新率会**主动跳过部分绘制**，跳过的是「绘制」而不是「时间轴」：`onProcess` 与循环计数仍逐帧完整，循环边界按帧判定而非按绘制次数。

## 同构 Worker 说明

- 解析代码唯一一份（`svga.worker`），打包时由构建插件编译为 IIFE 字符串内联。
- `useWorker: true` 且浏览器支持 → `new Worker(new Blob([code]))` 真子线程解析。
- Worker 不可用 / 创建失败 → `new MockWorker(code)`：沙箱 `new Function('self', 'globalThis', 'postMessage', 'importScripts', code)` 主线程同构解析。
- 解析带 30s 超时与 `onerror` 自愈兜底，避免 Promise 悬挂。静态方法共用共享 Worker；`new Parser()` 每个实例持有独立 Worker，`useWorker` 模式切换会重建 Worker。
- ⚠️ MockWorker 依赖 `new Function`，严格 CSP（无 `unsafe-eval`）环境下无法降级；真实 Worker 需允许 `blob:`。

## 错误处理

所有解析 / 运行期失败统一抛 `SvgaError` —— 它是 `Error` 的子类，带一个稳定的 `code`，业务侧按码分支即可，不必匹配错误文案。

| 错误码 | 触发场景 | 建议处理 |
|---|---|---|
| `NETWORK` | `fetch` 失败，或 HTTP 响应非 2xx | 重试，或保持海报 |
| `DECOMPRESS` | zlib 数据损坏 | 视为素材损坏，上报 |
| `INVALID_PROTOCOL` | 解码结果缺少基础 `params` | 不是合法 SVGA 文件 |
| `DECODE` | protobuf 字段解码失败（varint 溢出、未知 wire type） | 同上 |
| `EMPTY_BUFFER` / `INVALID_BUFFER` | 缓冲为空，或短于魔数长度 | 调用方问题，检查入参 |
| `IMAGE_DECODE` | 图片字节无法解码为 `HTMLImageElement` | 素材或图片本身有问题 |
| `TIMEOUT` | 解析超过 30s | 重试一次，仍失败则放弃 |
| `WORKER_ERROR` | worker 崩溃或被环境阻断 | 重试（下次解析会按需重建 worker） |
| `WORKER_RELEASED` | 解析途中 worker 被主动释放 | 重试，或等下次解析复用 |
| `PARSE_FAILED` | worker 返回的未归类失败 | 通用降级 |
| `CANVAS_CONTEXT` | 取不到 2D 上下文 | 无法渲染，回落到静态图 |
| `LOAD_FAILED` | `setVideoItem` 装载失败（数据不合法等） | 检查素材后重新解析装载 |

```ts
import { isSvgaError } from 'custom-svga'

player.onError(err => {
  if (!isSvgaError(err)) return
  toast(err.tips) // 可直接展示的中文提示，如「动画资源下载失败，请检查网络后重试」
  if (err.code === 'NETWORK') return retryLater()
  if (err.code === 'DECOMPRESS' || err.code === 'INVALID_PROTOCOL') {
    return reportBrokenAsset(err.code, err.cause)
  }
})
```

- **`setVideoItem` 只走一条错误通道**：注册了 `onError` 就只回调事件、Promise 正常 resolve；没注册 `onError` 才 reject（避免失败被静默吞掉）。业务侧二选一即可，不会既回调又抛错。
- **错误码跨线程不丢**：worker 在回包里带上 `code`，主线程还原成 `SvgaError`，因此解析器内部抛出的错误与主线程抛出的错误带同样的码。
- **中文提示**：错误对象对外就是三件事 —— `code`（错误码）、`message`（排查细节，自动带 `[SVGA error] ` 前缀）、`tips`（中文提示语，说明 + 建议）。给用户看的提示直接用 `err.tips`；`err.cause` 是原始异常，排查时再看。
- `SvgaError` 仍然是 `Error`，既有的 `catch (e) { e.message }` 写法完全不受影响。
- 入口对外只提供 `SvgaError`（类）、`isSvgaError`（类型收窄）与 `ErrorCode`（`code` 的类型），其余工具函数留在内部，不进入公共 API。

## 动态替换示例

```ts
player.setText({ text: 'Hello', size: '18px', color: '#fff' }, 'avatar') // 替换图层 avatar 为文本
await player.setImage('https://example.com/face.png', 'avatar')          // 或替换为图片
player.clearDynamic('avatar')                                            // 清除单个
player.clearDynamic()                                                    // 清空全部
```

## 常见问题

- **停止后没回到首帧？**：`stop()` 按配置的 `fillMode` 决定末帧/首帧/清空；如需固定首帧请设 `fillMode:'backwards'`。
- **暂停与停止区别**：`pause()` 停在当前帧；`stop()` 结束并应用 `fillMode`。
- **循环时最后一帧像被跳过了？**：不会，见 [循环播放](#循环播放最后一帧一定会画出来)。绘制发生在推进之前，`endFrame` 一定会被画到。
- **`defaultPoster` 不显示？**：常见三种原因——图片跨域且服务端没给 CORS 头（加载用的是 `crossorigin="anonymous"`）、配置是在播放开始后才设置的（只在未播放时绘制）、URL 404；可结合 `onPoster` 与控制台告警排查。
- **`setText` / `setImage` 没反应？**：`key` 必须是素材中真实存在的 `imageKey`（`movie.sprites[i].imageKey`）。静默无效果通常是拼写错误，或设计侧已经把该图层删掉。
- **体积**：esm/cjs/umd 单文件，fflate 已内联进 worker 字符串，运行时不需额外依赖。

## 变更记录

见 [CHANGELOG.md](./CHANGELOG.md)。

## 相关链接

- npm：<https://www.npmjs.com/package/custom-svga>
- 在线演示：<https://1707979815.github.io/SVGA-Web/>
- 问题反馈与需求：<https://github.com/1707979815/SVGA-Web/issues>
- 源码：未公开，本项目以 npm 包与在线演示的形式发布

## License

MIT © [DreamLife(Zhou)](https://github.com/1707979815)

**如果觉得好用，欢迎 [Star](https://github.com/1707979815/SVGA-Web) ⭐，也欢迎提交 Issue / PR。**
