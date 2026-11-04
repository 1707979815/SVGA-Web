<div align="center">

# custom-svga

面向 Vue 3 与现代浏览器的 SVGA 动画播放器 —— **gzip 13.3KB，零运行时依赖**。

[English](./README.md) | **简体中文**

[![npm version](https://img.shields.io/npm/v/custom-svga)](https://www.npmjs.com/package/custom-svga)
[![npm downloads](https://img.shields.io/npm/dm/custom-svga)](https://www.npmjs.com/package/custom-svga)
[![minzipped size](https://img.shields.io/bundlephobia/minzip/custom-svga)](https://bundlephobia.com/package/custom-svga)
[![license](https://img.shields.io/npm/l/custom-svga)](https://www.npmjs.com/package/custom-svga)
[![GitHub stars](https://img.shields.io/github/stars/1707979815/custom-svga?style=social&label=Star)](https://github.com/1707979815/custom-svga)

```
同构内联 Worker · 动态精灵/文本替换 · 抽帧渲染 · DPR 上限 · 可摇树
```

</div>

<!-- TODO: 录屏后替换为真实 GIF：![preview](./docs/preview.gif) -->
**[在线演示](https://1707979815.github.io/custom-svga/)** —— 展示页、单实例回归页与多实例压力页。

- **同构内联 Worker 解析**：真实 Web Worker 可用时自动在 Worker 内解析；不支持/受限时主线程 `MockWorker`（沙箱 `new Function`）复用同一份代码降级，零配置。
- **构建期内联**：解析代码在打包时编译为字符串内联进主包，单入口、无独立 worker 产物、无需额外部署 worker 文件。
- **动态精灵/文本替换**、海报、正/逆序、缩放适配、帧区间/播放至指定帧、循环与结束行为。
- **为移动端调优**：抽帧渲染、Path2D 预缓存、帧位图缓存、DPR 上限、视口外自动暂停。

## 为什么选 custom-svga

包体积（gzip，整包，无代码分割）：

| 包 | 版本 | gzip |
|---|---|---|
| **custom-svga** | 2.4.0 | **13.3 KB** |
| `svga.lite` | 1.6.x | ~27 KB（其 README 自述） |
| `svgaplayerweb` | 2.3.x | ~34 KB（Bundlephobia） |

除了基本播放，还额外提供：

- **无需部署 worker 文件** —— 解析器随主包一起走，省掉 `public/svga.worker.js` 的缓存与版本同步问题。
- **不会因 Worker 不可用而卡死** —— 任何环境都会降级到主线程跑同一份代码。
- **完整的 TypeScript 类型** —— `MovieData`、`PlayConfig`、`DynamicText` 等均带类型，无需 `any` 断言。
- **弱机可调的三档开关** —— `frameThrottling`（时间维度）、`maxDpr`（像素维度）、`cacheFrames`（重复计算维度）。
- **可预测的生命周期** —— `onReady` / `onLoopEnd` / `onEnd` / `onError`，停止行为由 `fillMode` 统一约束。

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
| `player.setVideoItem(item)` | 同名 | 也可直接传 `{ url, ...解析选项 }` |
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

切换前需要知道的两点差异：

- **解析是 Promise 而非回调**，缓存与并发去重已内置（`Parser.clear()` / `Parser.delete(key)`）。
- **Worker 随包内联**，不需要再往 `public/` 拷 `svga.worker.js`，也不存在解析器与播放器版本不一致的问题。

如果你在迁移中遇到映射不上的写法，欢迎带代码片段提 issue —— 迁移断层会当作 bug 处理。

## Player

### 构造函数

```ts
new Player(element, config?)
// element: HTMLCanvasElement | HTMLDivElement（div 容器模式会自动创建并管理画布）
```

### 方法

| 方法 | 说明 |
|---|---|
| `setVideoItem(MovieData \| VideoUrlSource)` | 装载动画数据（`Parser` 解析结果，或 `{ url, ...解析选项 }` 对象——内部自动 `Parser.loadUrl`，解析选项平铺：useWorker/cache/useImageBitmap） |
| `play(config?)` | 开始/恢复播放；传入的 `config` 会持久更新到实例配置 |
| `setConfig(config?)` | 仅更新实例播放配置（不触发播放），播放中同样即时生效 |
| `playRange(start, end, config?)` | 播放指定帧区间 |
| `pause()` | 暂停，保持当前帧 |
| `stop()` | 停止并应用配置的结束行为（fillMode：末帧/首帧/清空） |
| `skipRender(skip?)` | 切换/设置是否跳过渲染（帧时间轴仍推进）；不传参则切换 |
| `stepToFrame(frame, andPlay?)` | 跳转到指定帧 |
| `stepToPercentage(p, andPlay?)` | 跳转到进度（0~1） |
| `setImage(img \| url, key)` | 动态替换图层图片 |
| `setText(text \| DynamicText, key)` | 动态替换图层文本 |
| `clearDynamic(key?)` | 清除动态替换，不传 key 则清空全部 |
| `renderPoster(url)` | 外链图片作静态海报渲染到画布 |
| `resize()` | 按 DOM 容器与 DPR 校准画布尺寸 |
| `clear()` | 清空当前动画数据与画布（保留实例，可再 setVideoItem） |
| `destroy()` | 彻底销毁实例（画布/监听/内存），需重新 `new Player` |

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

**options / ParserConfig**：`useWorker`（默认 true，false 强制主线程 MockWorker 解析）、`useImageBitmap`（默认 false，解码为 ImageBitmap）、`cache`（默认 true，LRU 缓存 20 条）。缓冲解析（`loadFile`/`parseBuffer`）需显式传 `movieDataId` 才会写入缓存（匿名缓冲无稳定键，不缓存以免污染 LRU）；实例化时 `movieDataId` 也是实例级缓存键。实例额外支持 **`autoClose`**（默认 false）：为 true 时每次解析成功即自动释放当前 Worker（适合低频/一次性解析，用完即释放线程）。

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
| `defaultPoster` | - | 默认静态海报（未播放/出错/clear 时显示） |
| `autoPlay` | `false` | `setVideoItem` 装载完成后是否立即自动播放 |

## 同构 Worker 说明

- 解析代码唯一一份（`svga.worker`），打包时由构建插件编译为 IIFE 字符串内联。
- `useWorker: true` 且浏览器支持 → `new Worker(new Blob([code]))` 真子线程解析。
- Worker 不可用 / 创建失败 → `new MockWorker(code)`：沙箱 `new Function('self', 'globalThis', 'postMessage', 'importScripts', code)` 主线程同构解析。
- 解析带 30s 超时与 `onerror` 自愈兜底，避免 Promise 悬挂。静态方法共用共享 Worker；`new Parser()` 每个实例持有独立 Worker，`useWorker` 模式切换会重建 Worker。
- ⚠️ MockWorker 依赖 `new Function`，严格 CSP（无 `unsafe-eval`）环境下无法降级；真实 Worker 需允许 `blob:`。

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
- **体积**：esm/cjs/umd 单文件，fflate 已内联进 worker 字符串，运行时不需额外依赖。

## 变更记录

见 [CHANGELOG.md](./CHANGELOG.md)。

## 相关链接

- npm：<https://www.npmjs.com/package/custom-svga>
- 在线演示：<https://1707979815.github.io/custom-svga/>
- 问题反馈与需求：<https://github.com/1707979815/custom-svga/issues>
- 源码：未公开，本项目以 npm 包与在线演示的形式发布

## License

MIT © [DreamLife(Zhou)](https://github.com/1707979815)

**如果觉得好用，欢迎 [Star](https://github.com/1707979815/custom-svga) ⭐，也欢迎提交 Issue / PR。**
