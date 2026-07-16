<div align="center">

# 🎬 Custom SVGA

**A lightweight, tree-shakable SVGA animation player for Vue 3 & modern web.**

支持按需懒加载 · OffscreenCanvas 离屏渲染 · 动态精灵/文本替换 · TypeScript 全量类型

[![npm version](https://img.shields.io/npm/v/custom-svga.svg)](https://www.npmjs.com/package/custom-svga)
[![npm downloads](https://img.shields.io/npm/dm/custom-svga.svg)](https://www.npmjs.com/package/custom-svga)
[![bundle size](https://img.shields.io/bundlephobia/minzip/custom-svga)](https://bundlephobia.com/package/custom-svga)
[![license](https://img.shields.io/npm/l/custom-svga.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![GitHub stars](https://img.shields.io/github/stars/DreamlifeZhou/custom-svga?style=social)](https://github.com/DreamlifeZhou/custom-svga)

<br>

# ⭐ 给个 Star 支持一下

**如果这个项目对你有帮助，请点击右上角的 ⭐ Star 按钮，你的支持是我持续维护的动力！**

[![Star this repo](https://img.shields.io/badge/%E2%AD%90%20Star%20-%20custom--svga%20on%20GitHub-blue?style=for-the-badge&logo=github)](https://github.com/DreamlifeZhou/custom-svga)

</div>

---

## ✨ Features

| 特性 | 说明 |
| --- | --- |
| 📦 **极致轻量** | gzip 后核心 ~30KB，无任何 UI 框架依赖 |
| 🌳 **Tree-shakable** | 完整 ESM 支持，按需引入方法，未使用代码自动剔除 |
| 🚀 **按需懒加载** | Parser / ShapeRenderer / Loader 全部支持动态 `import()`，首屏最小化 |
| ⚡ **OffscreenCanvas 渲染** | 主流渲染管线 0 主线程占用，60fps 不卡顿 |
| 👷 **共享 Web Worker** | 多 Player 实例复用同一 Worker，解析结果缓存共享 |
| 🧠 **LRU 智能缓存** | 自动管理解析后的 MovieData，避免重复解析 |
| 🎨 **动态形状渲染** | 内置 Path2D 矢量绘制，支持 rect / ellipse / SVG path |
| 🖼️ **运行时图片替换** | 不重编 SVGA 即可替换图层（URL / Base64 / ImageBitmap） |
| 📝 **动态文本注入** | 在动画播放中实时替换文本图层 |
| 🎯 **TypeScript 一等公民** | 完整 `.d.ts` 类型定义，IDE 智能提示开箱即用 |
| 🌐 **多产物输出** | ESM / CJS / IIFE 全场景覆盖（npm、script 标签、CDN） |

---

## 📥 Installation

```bash
# npm
npm install custom-svga

# yarn
yarn add custom-svga

# pnpm
pnpm add custom-svga
```

### 浏览器 CDN（无构建工具）

```html
<!-- unpkg -->
<script src="https://unpkg.com/custom-svga@latest/dist/index.global.js"></script>

<!-- jsDelivr -->
<script src="https://cdn.jsdelivr.net/npm/custom-svga@latest/dist/index.global.js"></script>

<script>
  const { Player, Parser } = CustomSvga;
</script>
```

---

## 🚀 Quick Start

### Vue 3 组件用法

```vue
<template>
  <div ref="container" class="svga-stage"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, shallowRef } from 'vue';
import { Player, Parser } from 'custom-svga';

const container = ref<HTMLDivElement>();
const player = shallowRef<Player>();

onMounted(async () => {
  player.value = new Player(container.value!, {
    useOffscreenCanvas: true,      // 开启离屏渲染
    useIntersectionObserver: true,  // 可见性优化
    loop: 0,                       // 无限循环
  });

  player.value.onStart(() => console.log('播放开始'));
  player.value.onProcess((frame) => console.log('当前帧:', frame));
  player.value.onLoopEnd(() => console.log('循环结束'));

  // 主线程模式：使用 loadUrl 加载
  // const videoItem = await Parser.loadUrl('https://example.com/anim.svga');
  
  // 离屏模式：使用 loadForWorker 加载（推荐）
  const metadata = await Parser.loadForWorker('https://example.com/anim.svga');
  await player.value.setVideoItem(metadata);
  player.value.play();
});

onBeforeUnmount(() => {
  player.value?.destroy();
});
</script>

<style scoped>
.svga-stage {
  width: 300px;
  height: 300px;
}
</style>
```

### 原生 JavaScript 用法

```javascript
import { Player, Parser } from 'custom-svga';

const player = new Player(document.getElementById('stage'));
const item = await Parser.loadUrl('/assets/anim.svga');
await player.setVideoItem(item);
player.play();
```

### 直接传入 ArrayBuffer

```javascript
import { Player, Parser } from 'custom-svga';

const buffer = await fetch('/anim.svga').then((r) => r.arrayBuffer());
const item = await Parser.parseBuffer(buffer);

const player = new Player(document.getElementById('stage'));
await player.setVideoItem(item);
player.play();
```

---

## 📚 API 文档

### `new Player(element, config?)`

创建播放器实例。根据 `config.useOffscreenCanvas` 自动选择主线程渲染器或 Worker 离屏渲染器。

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| element | `HTMLCanvasElement \| HTMLDivElement` | ✅ | 绘图容器节点，传入 div 时会自动创建 canvas |
| config | `PlayConfig` | ❌ | 初始化配置 |

#### PlayConfig 配置项

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `loop` | `number` | `0` | 循环次数（0 = 无限循环） |
| `fps` | `number` | - | 覆盖 SVGA 自身帧率 |
| `fillMode` | `'forwards' \| 'backwards' \| 'clear'` | `'forwards'` | 播放结束时的行为 |
| `startFrame` | `number` | - | 起始播放帧 |
| `endFrame` | `number` | - | 结束播放帧 |
| `direction` | `'forward' \| 'backward'` | `'forward'` | 播放方向 |
| `useOffscreenCanvas` | `boolean` | `false` | 启用 OffscreenCanvas 离屏渲染 |
| `useIntersectionObserver` | `boolean` | `true` | 启用 IntersectionObserver 可见性优化 |
| `invisibleBehavior` | `'pause' \| 'skip'` | `'pause'` | 不可见时的行为 |
| `useSharedRAF` | `boolean` | `true` | 多实例共享 requestAnimationFrame |
| `cacheFrames` | `boolean` | `false` | 缓存已绘制帧为位图 |
| `defaultPoster` | `string` | - | 默认外链静态海报图 |

#### Player 实例方法

| 方法 | 说明 |
| --- | --- |
| `setVideoItem(item)` | 设置动画数据，支持 MovieData / OffscreenMovieHandle / 缓存 URL 字符串 |
| `play(config?)` | 触发播放，可传入 `PlayConfig` 覆盖循环、方向等 |
| `playRange(start, end, config?)` | 播放指定帧范围 |
| `pause()` | 暂停 |
| `stop()` | 停止并回到第一帧 |
| `stepToFrame(frame, andPlay?)` | 跳转到指定帧（默认 `andPlay: false`） |
| `stepToPercentage(p, andPlay?)` | 跳转到指定进度 0~1（默认 `andPlay: false`） |
| `setImage(image, key)` | 动态替换图片图层，支持 `HTMLImageElement` / `ImageBitmap` / `HTMLCanvasElement` / 图片 URL 字符串 |
| `setText(text, key)` | 动态替换文本，支持纯字符串或 `DynamicText` 配置对象 |
| `clearDynamicObject(key)` | 清除单个动态对象 |
| `clearDynamicObjects()` | 清除所有动态对象 |
| `renderPoster(imageUrl)` | 将外链图片渲染为静态海报 |
| `getMemoryInfo()` | 获取内存占用信息 |
| `clear()` | 清空画布和内存引用 |
| `destroy()` | 彻底销毁播放器实例 |

#### Player 事件回调

| 事件 | 签名 | 触发时机 |
| --- | --- | --- |
| `onStart(cb)` | `() => void` | 播放开始 |
| `onPause(cb)` | `() => void` | 播放暂停 |
| `onStop(cb)` | `() => void` | 播放停止 |
| `onLoopEnd(cb)` | `() => void` | 单次循环结束 |
| `onProcess(cb)` | `(frame: number) => void` | 每渲染一帧触发 |

---

### `Parser` 静态方法

| 方法 | 说明 | 适用场景 |
| --- | --- | --- |
| `Parser.load(source, options?)` | **统一入口**，自动分流到 `loadUrl` / `loadFile` / `loadForWorker` | 推荐使用 |
| `Parser.loadUrl(url, options?)` | 从网络 URL 加载并解析，返回完整 `MovieData` | 传统主线程渲染 |
| `Parser.loadFile(file, options?)` | 从本地 File / Blob 加载，返回完整 `MovieData` | 用户上传文件 |
| `Parser.parseBuffer(buffer, options?)` | 直接解析 ArrayBuffer，返回完整 `MovieData` | 已下载好的二进制 |
| `Parser.loadForWorker(url, options?)` | 专为 OffscreenCanvas 设计，数据留在 Worker，返回轻量 `OffscreenMovieHandle` | 离屏渲染专用 |
| `Parser.parseBufferOffscreen(buffer, movieDataId, options?)` | 在 Worker 中解析 ArrayBuffer 并离屏缓存，返回 `OffscreenMovieHandle` | 离屏渲染 + 已下载数据 |
| `Parser.remove(url, options?)` | 释放**指定** URL 的主线程 / Worker 缓存 | 精准释放 |
| `Parser.destroy(options?)` | 清空**全部**主线程 / Worker 缓存 | 内存压力时 |

#### Parser 通用选项

```typescript
// ParserOptions
{
  useImageBitmap?: boolean; // 默认 false，true 时解码为 ImageBitmap（GPU 加速）
  cache?: boolean;          // 默认 true，是否启用 LRU 缓存
  useWorker?: boolean;      // 默认 true，是否使用 Web Worker 解析
}

// ParserLoadOptions（extends ParserOptions）
{
  useImageBitmap?: boolean;
  cache?: boolean;
  useWorker?: boolean;
  forWorker?: boolean;      // 默认 false，true 时返回 OffscreenMovieHandle
}

// ParserRemoveOptions
{
  mainThread?: boolean;     // 是否清除主线程缓存（默认 true）
  offscreen?: boolean;      // 是否清除 Worker 离屏缓存（默认 true）
  force?: boolean;          // 是否强制销毁（默认 true）
}

// ParserDestroyOptions
{
  mainThread?: boolean;     // 是否清空主线程全部缓存（默认 true）
  offscreen?: boolean;      // 是否清空 Worker 全部缓存（默认 true）
}
```

---

## 🎯 高级用法

### 1. 动态替换图片图层

```javascript
// 替换为在线图片
await player.setImage('https://example.com/new-avatar.png', 'avatar');

// 替换为 ImageBitmap（最佳性能）
const bitmap = await createImageBitmap(blob);
await player.setImage(bitmap, 'avatar');

// 替换为 Canvas 内容
await player.setImage(myOffscreenCanvas, 'avatar');
```

### 2. 动态注入文本

```javascript
// 简单字符串
player.setText('Hello, CustomSvga!', 'greeting');

// 完整样式配置
player.setText({
  text: 'VIP 用户',
  size: 28,
  color: '#FFD700',
  bold: true,
  family: 'Arial',
  offset: { x: 0, y: -10 },
}, 'username');
```

### 3. 帧范围播放与反向播放

```javascript
// 只播放第 10~50 帧
player.playRange(10, 50, { loop: 3 });

// 跳转到 50% 进度后自动播放
player.stepToPercentage(0.5, true);

// 反向播放
player.play({ direction: 'backward' });

// 开启帧缓存（适合复杂矢量动画）
player.play({ cacheFrames: true });
```

### 4. 可见性优化

```javascript
const player = new Player(container, {
  useIntersectionObserver: true,  // 默认开启
  invisibleBehavior: 'pause',     // 移出视口时暂停
  // invisibleBehavior: 'skip',   // 移出视口时跳过绘制但保持帧同步
});
```

### 5. 内存管理

```javascript
// 查看内存占用
const info = player.getMemoryInfo();
console.log(info);
// {
//   fileSize: 102400,
//   imageMemory: 5242880,
//   dictionaryMemory: 204800,
//   version: '2.0',
//   fps: 30,
//   frames: 60,
//   width: 750,
//   height: 1334,
//   dynamicKeys: ['avatar'],
//   desc: '源文件大小: 100.00 KB | 预估显存: 5.20 MB'
// }

// 释放指定 URL 的主线程 + Worker 缓存
Parser.remove('https://example.com/anim.svga');

// 仅释放 Worker 离屏缓存，保留主线程缓存
Parser.remove('https://example.com/anim.svga', { mainThread: false, offscreen: true });

// 清空所有缓存（主线程 + Worker）
Parser.destroy();
```

---

## 👷 Web Worker 使用场景与示例

### 场景一：离线离屏渲染（核心推荐）

将解析、解码、绘制全部移至 Worker 线程，主线程零压力。适用于对动画流畅度要求高的场景（如直播间礼物动画）。

```javascript
import { Player, Parser } from 'custom-svga';

const player = new Player(canvasElement, {
  useOffscreenCanvas: true, // 开启离屏渲染
});

// 离屏模式必须使用 loadForWorker 或 load(url, { forWorker: true })
// 数据仅在 Worker 内存中保留，主线程只拿到轻量句柄
const metadata = await Parser.loadForWorker('https://example.com/anim.svga');
// 或 const metadata = await Parser.load('https://example.com/anim.svga', { forWorker: true });
// 返回轻量元数据：{ movieDataId, isOffscreen: true, params: { viewBoxWidth, viewBoxHeight, fps, frames } }

// 仅传入 movieDataId，Worker 内部从缓存获取完整数据
await player.setVideoItem(metadata);
player.play();
```

**数据流示意：**
```
主线程                          Web Worker
─────────                      ──────────
Parser.loadForWorker(url) ──fetch──▶  解码 Protobuf
   │                                  解码 ImageBitmap
   │                                  存入 sharedMovieCache
   ◀──返回轻量 metadata ───────────
   │
Player.setVideoItem(meta) ──▶ 从 sharedMovieCache 读取
   │                         离屏 Canvas 渲染
   │                         requestAnimationFrame 循环
   ◀──事件通知 (onProcess等) ─
```

> **限制**：开启 `useOffscreenCanvas` 后，`setVideoItem` 只能传入 `Parser.loadForWorker()` 或 `Parser.load(url, { forWorker: true })` 返回的轻量元数据，或缓存 key 字符串，**禁止**传入 `Parser.loadUrl()` 返回的完整 MovieData。

### 场景二：多 Player 实例共享同一 Worker

多个播放器实例复用同一个共享 Web Worker，Worker 内部维护全局 LRU 缓存，相同 URL 的动画数据只解析一次。

```javascript
import { Player, Parser } from 'custom-svga';

// 三个播放器共享同一个 Worker 和缓存
const player1 = new Player(container1, { useOffscreenCanvas: true });
const player2 = new Player(container2, { useOffscreenCanvas: true });
const player3 = new Player(container3, { useOffscreenCanvas: true });

// 同一 URL 只会在 Worker 内解析一次
const meta1 = await Parser.loadForWorker('https://example.com/gift.svga');
const meta2 = await Parser.loadForWorker('https://example.com/gift.svga');
const meta3 = await Parser.loadForWorker('https://example.com/gift.svga');

await Promise.all([
  player1.setVideoItem(meta1),
  player2.setVideoItem(meta2),
  player3.setVideoItem(meta3),
]);

player1.play();
player2.play({ loop: 2 });
player3.play({ loop: 1 });
```

### 场景三：Worker 解析 + 主线程渲染

利用 Worker 进行高性能解析，解析完成后图片在主线程渲染。适用于需要精细控制 Canvas 绘制或需要兼容不支持 OffscreenCanvas 浏览器的场景。

```javascript
import { Player, Parser } from 'custom-svga';

// 不开启 useOffscreenCanvas，走主线程渲染
const player = new Player(document.getElementById('stage'), {
  useOffscreenCanvas: false, // 默认值
});

// 使用 useWorker: true（默认）在 Worker 中解析
const videoItem = await Parser.loadUrl('https://example.com/anim.svga', {
  useWorker: true,   // Worker 解析，主线程渲染
  useImageBitmap: false, // 主线程使用 HTMLImageElement
  cache: true,
});

await player.setVideoItem(videoItem);
player.play();
```

### 场景四：禁用 Worker 回退到主线程解析

在不支持 Worker 的环境（如部分小程序 WebView）或调试时，可以强制降级。

```javascript
import { Parser } from 'custom-svga';

// 全局关闭 Worker，所有解析在主线程进行
const videoItem = await Parser.loadUrl('https://example.com/anim.svga', {
  useWorker: false,
});
```

### 场景五：Worker 中的内存回收

Worker 内部维护 `sharedMovieCache` + 引用计数机制，当所有渲染器实例释放后自动回收。

```javascript
// 释放指定 URL 的主线程 + Worker 离屏缓存
Parser.remove('https://example.com/anim.svga');

// 仅清理 Worker 离屏缓存，保留主线程缓存
Parser.remove('https://example.com/anim.svga', {
  mainThread: false,
  offscreen: true,
});

// 强制释放（即使有其他实例引用也强制销毁）
Parser.remove('https://example.com/anim.svga', {
  force: true,
});

// 清空所有缓存（主线程 + Worker）
Parser.destroy();

// 仅清空 Worker 全部离屏缓存，保留主线程
Parser.destroy({ mainThread: false, offscreen: true });
```

### Worker 生命周期概览

```
┌─────────────────────────────────────────────────────────────┐
│                     主线程 (Main Thread)                     │
│                                                             │
│  Parser.loadUrl(url)        ───────┐                        │
│  Parser.loadForWorker(url)  ───────┤                        │
│                              │ postMessage                  │
│  Player.setVideoItem()  ────┼──▶  WORKER_ACTION.SET_MOVIE   │
│  Player.play()          ────┼──▶  WORKER_ACTION.PLAY        │
│  Player.pause()         ────┼──▶  WORKER_ACTION.PAUSE       │
│  Player.destroy()       ────┼──▶  WORKER_ACTION.DESTROY     │
│                              │                              │
│  ◀── WORKER_RESPONSE_TYPE    │ postMessage                  │
│       .SUCCESS (解析结果)    │                              │
│       .EVENT (播放事件)      │                              │
└──────────────────────────────┼──────────────────────────────┘
                               │
┌──────────────────────────────┼──────────────────────────────┐
│                   Web Worker (共享子线程)                    │
│                                                             │
│  sharedMovieCache (Map<movieDataId, MovieData + refCount>)  │
│                                                             │
│  ┌──────────────────┐   ┌──────────────────┐               │
│  │ WorkerParser     │   │ WorkerRenderer[]  │               │
│  │  .parse()        │   │  .setMovie()      │               │
│  │  .parseOffscreen │   │  .play()          │               │
│  └──────────────────┘   │  .drawFrame()     │               │
│                          │  (OffscreenCanvas)│               │
│                          └──────────────────┘               │
│                                                             │
│  tickerManager (共享 RAF 调度器)                             │
└─────────────────────────────────────────────────────────────┘
```

### Worker 模式自动降级机制

Custom SVGA 内置三层降级策略，无需开发者干预：

| 层级 | 条件 | 行为 |
| --- | --- | --- |
| 🥇 Blob Worker | 浏览器支持 `Worker` + `Blob` | 将 worker 代码通过 Blob URL 实例化，零网络请求 |
| 🥈 Module Worker | 开发环境 / Blob 失败 | 通过 `new URL('./svga.worker.ts', import.meta.url)` 加载 |
| 🥉 Mock Worker | Worker API 不可用 | 同构 setTimeout 宏任务模拟，功能完全等价 |

---

## 📊 性能对比

| 指标 | 官方 svga-web | Custom SVGA |
| --- | --- | --- |
| 核心包体积（gzip） | ~85KB | **~30KB** ⬇️ 65% |
| Tree-shaking 支持 | ❌ | ✅ |
| 按需懒加载 | ❌ | ✅ |
| OffscreenCanvas | 需手动配置 | **✅ 一键启用** |
| Worker 缓存共享 | ❌ | ✅ |
| 动态图片/文本替换 | 需重编 SVGA | ✅ 运行时热替换 |
| Vue 3 集成 | 需包装 | ✅ 原生支持 |
| TypeScript 类型 | 部分 | ✅ 100% 覆盖 |

---

## 🌐 浏览器兼容性

| 浏览器 | 最低版本 | OffscreenCanvas 支持 |
| --- | --- | --- |
| Chrome / Edge | 88+ | ✅ |
| Firefox | 105+ | ✅ |
| Safari | 16.4+ | ✅ |
| 移动端 Chrome (Android) | 88+ | ✅ |
| 移动端 Safari (iOS) | 16.4+ | ✅ |

> 在不支持 OffscreenCanvas 的浏览器中，播放器自动回退到主线程 Canvas 渲染，业务代码无需任何改动。

---

## 🔧 常见问题

<details>
<summary><b>Q: OffscreenCanvas 模式下报错"禁止传入主线程数据"？</b></summary>

开启 `useOffscreenCanvas: true` 时，`setVideoItem` 只能传 `Parser.loadForWorker()` 或 `Parser.load(url, { forWorker: true })` 返回的轻量元数据，不能传 `Parser.loadUrl()` 返回的完整 MovieData。

```javascript
// ✅ 正确 - 离屏模式
const meta = await Parser.loadForWorker(url);
await player.setVideoItem(meta);

// ✅ 正确 - 统一入口 + forWorker
const meta2 = await Parser.load(url, { forWorker: true });
await player.setVideoItem(meta2);

// ❌ 错误 - 传入主线程完整数据
const item = await Parser.loadUrl(url);
await player.setVideoItem(item); // 抛错！
```

</details>



<details>
<summary><b>Q: iOS Safari 上动画卡顿？</b></summary>

- 关闭 `useImageBitmap`（iOS 兼容性差）
- 检查是否启用了 `useOffscreenCanvas`（iOS 16.4+ 才支持）
- 减少同屏 SVGA 实例数量

</details>

<details>
<summary><b>Q: 如何预览某一帧（不播放）？</b></summary>

```javascript
await player.setVideoItem(item);
player.stepToFrame(0, false); // 跳到第 0 帧，不自动播放
```

</details>

## 🤝 贡献

欢迎 PR 和 Issue！请确保：
- 代码风格一致（TypeScript strict）
- 提交前 `npm run build:tsup` 能成功
- 重大变更请先开 Issue 讨论

## 📄 License

MIT © 2026 DreamLife(Zhou)

## 🙏 致谢

- [SVGA](https://github.com/svga/SVGA-Format) - 跨平台动画格式
- [fflate](https://github.com/101arrowz/fflate) - 高性能 zip 解压
- [protobufjs](https://github.com/protobufjs/protobuf.js) - protobuf 解码

---

<div align="center">

**⭐ 喜欢这个项目？在 [GitHub](https://github.com/DreamlifeZhou/custom-svga) 上给我们一个 Star 吧！你的支持就是最大的动力！**

[![GitHub stars](https://img.shields.io/github/stars/DreamlifeZhou/custom-svga?style=for-the-badge&logo=github&label=Stars&color=ffdd00)](https://github.com/DreamlifeZhou/custom-svga)

</div>
