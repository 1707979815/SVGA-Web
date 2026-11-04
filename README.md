<div align="center">

# custom-svga

A lightweight, tree-shakable SVGA animation player for Vue 3 & modern web.

**English** | [简体中文](./README.zh-CN.md)

[![npm version](https://img.shields.io/npm/v/custom-svga)](https://www.npmjs.com/package/custom-svga)
[![npm downloads](https://img.shields.io/npm/dm/custom-svga)](https://www.npmjs.com/package/custom-svga)
[![minzipped size](https://img.shields.io/bundlephobia/minzip/custom-svga)](https://bundlephobia.com/package/custom-svga)
[![license](https://img.shields.io/npm/l/custom-svga)](https://www.npmjs.com/package/custom-svga)
[![GitHub stars](https://img.shields.io/github/stars/1707979815/custom-svga?style=social&label=Star)](https://github.com/1707979815/custom-svga)

```
Ultra-light · Mobile-first · Isomorphic inline worker parsing · Dynamic sprite/text replacement · Zero runtime deps
```

</div>

<!-- TODO: add a GIF preview of the player here, e.g. ![preview](./docs/preview.gif) -->
**[Online Demo](https://1707979815.github.io/custom-svga/)** (single-instance regression & multi-instance stress playground)

- **Isomorphic inline worker parsing**: parses in a real Web Worker when available; otherwise falls back to a main-thread `MockWorker` (sandboxed `new Function`) running the exact same code — zero configuration.
- **Build-time inlining**: the worker is compiled into a string at build time and inlined into the bundle. Single entry, no separate worker files, no runtime dependencies (`fflate` is inlined too).
- **Dynamic sprite/text replacement**, poster image, forward/backward playback, scale modes, frame range, seek-to-frame, loop & end behaviors.
- **~40KB ESM / ~13KB gzip** — smaller than the official svga.lite, with zero UI framework dependencies.

## Ultra-light, built for mobile

- **Tiny bundle, fast cold start**: ~13KB gzip and zero runtime deps. No UI framework, no heavy runtime — first frame spins up fast, ideal for low-end devices and size-sensitive apps.
- **Lower battery & memory usage on mobile**:
  - **Frame throttling** (`frameThrottling`) for complex animations: the timeline keeps advancing and duration stays intact, only the paint rate is capped — significantly less main-thread blocking per frame;
  - **Path2D pre-caching / frame bitmap caching / dynamic text rasterization** minimize per-frame recomputation and repeated rasterization, cutting GPU/CPU load;
  - **DPR cap** (`maxDpr`, unlimited by default) for large canvases / low-end devices: reduces rasterized pixels per frame from 9× to 4×/2.25×, trading a little sharpness for obvious performance gains (`frameThrottling` works on the time dimension, `maxDpr` on the pixel dimension);
  - Automatically **pauses off-screen animations** (`useIntersectionObserver`) — zero cost for animations scrolled out of view.
- **Tree-shakable by design**: parser and renderer are functional and side-effect free (`sideEffects: false`), so bundlers drop unused code and shrink the final size even further.

## Install

```bash
npm i custom-svga
# or via CDN: <script src="https://unpkg.com/custom-svga"></script> → window.CustomSvga
```

## Quick Start (Vue 3)

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

## Player

### Constructor

```ts
new Player(element, config?)
// element: HTMLCanvasElement | HTMLDivElement (div mode auto-creates and manages the canvas)
```

### Methods

| Method | Description |
|---|---|
| `setVideoItem(MovieData \| VideoUrlSource)` | Load animation data (a `Parser` result, or `{ url, ...parseOptions }` — calls `Parser.loadUrl` internally; parse options `useWorker` / `cache` / `useImageBitmap` are flattened at the top level) |
| `play(config?)` | Start / resume playback; the passed config is persisted into the instance |
| `setConfig(config?)` | Update playback config only (does not start playback); takes effect immediately even while playing |
| `playRange(start, end, config?)` | Play a specific frame range |
| `pause()` | Pause, keeping the current frame |
| `stop()` | Stop and apply the configured end behavior (`fillMode`: last frame / first frame / clear) |
| `skipRender(skip?)` | Toggle / set render skipping (the timeline still advances); toggles when called without arguments |
| `stepToFrame(frame, andPlay?)` | Seek to a specific frame |
| `stepToPercentage(p, andPlay?)` | Seek to a progress position (0~1) |
| `setImage(img \| url, key)` | Dynamically replace a sprite image |
| `setText(text \| DynamicText, key)` | Dynamically replace a sprite with text |
| `clearDynamic(key?)` | Clear dynamic replacements; clears all when `key` is omitted |
| `renderPoster(url)` | Render an external image onto the canvas as a static poster |
| `resize()` | Recalibrate canvas size against the DOM container and DPR |
| `clear()` | Clear current movie data and canvas (instance survives; `setVideoItem` can be called again) |
| `destroy()` | Fully destroy the instance (canvas / listeners / memory); a new `Player` is required afterwards |

### Updating config at runtime

`setConfig` only updates config without starting playback — handy for adjusting an existing instance. `play(config)` is equivalent to `setConfig(config)` followed by playback, and the config is persisted.

```ts
import { SCALE_MODE } from 'custom-svga'

// Silent update (scale mode, frame cache, poster, etc. can change before playback)
player.setConfig({ scaleMode: SCALE_MODE.ASPECT_FILL, maxCacheFrames: 200 })

// fps / frame range / frame throttling also take effect immediately while playing
player.setConfig({ fps: 30, frameThrottling: 20 })

// Large canvases / low-end devices: cap DPR to reduce pixel count (0 = unlimited)
player.setConfig({ maxDpr: 2 })

// play(config) = setConfig(config) + play, and the config persists
player.play({ loop: 2 })
```

### Events

| Event | Callback payload | When it fires |
|---|---|---|
| `onReady` | `MovieData?` | Movie data is ready |
| `onError` | `Error` | Runtime / loading error |
| `onStart` / `onPause` / `onStop` | - | Corresponding lifecycle |
| `onLoopEnd` | - | Each loop iteration ends (including the last one) |
| `onEnd` | - | Playback fully ends (only when a finite `loop` count is reached; not fired for `loop: 0` infinite loops or manual `stop` / `pause`) |
| `onProcess` | `frame: number` | Every frame advance |
| `onPoster` | `PosterEventInfo` | Poster shown / hidden |

## Parser

Static methods (all calls **share one Worker thread**):

```ts
Parser.load(source, options?)          // source: url | File | Blob
Parser.loadUrl(url, options?)
Parser.loadFile(file, options?)
Parser.parseBuffer(buffer, options?)
Parser.delete(key)                     // remove a single cache entry
Parser.clear()                         // clear all caches (shared Worker is kept)
Parser.destroy()                       // clear all caches and release the shared Worker (recreated on demand)
```

Instance form (**each instance owns a dedicated Worker**; parse options are declared once at construction, not per call):

```ts
const parser = new Parser({ useWorker: true, cache: true, autoClose: false })
await parser.loadUrl(url)              // same signatures as statics, but on a dedicated Worker thread
await parser.load(file)                // loadUrl / loadFile / parseBuffer likewise
parser.delete(key) / parser.clear() / parser.destroy()
```

Memory / file info (standalone export, reuses the global cache internally):

```ts
import { queryMemoryInfo } from 'custom-svga'
await queryMemoryInfo(url, true)       // log=true prints a table
```

**options / ParserConfig**: `useWorker` (default `true`; `false` forces main-thread MockWorker parsing), `useImageBitmap` (default `false`; decode into `ImageBitmap`), `cache` (default `true`; 20-entry LRU). Buffer-based parsing (`loadFile` / `parseBuffer`) only writes to the cache when an explicit `movieDataId` is provided (anonymous buffers have no stable key, so they are not cached to avoid polluting the LRU); with the instance form, `movieDataId` also serves as the instance-level cache key. Instances additionally support **`autoClose`** (default `false`): when `true`, the Worker is released after each successful parse — ideal for low-frequency / one-shot parsing.

## PlayConfig

| Option | Default | Description |
|---|---|---|
| `loop` | `0` | Loop count, 0 = infinite |
| `fps` | Source file | Override frame rate |
| `fillMode` | `forwards` | End behavior: `forwards` (last frame) / `backwards` (first frame) / `clear` |
| `startFrame` / `endFrame` | - | Playback frame range |
| `direction` | `forward` | Playback direction: `forward` / `backward` (reverse) |
| `scaleMode` | `AspectFit` | `SCALE_MODE`: `AspectFit` / `AspectFill` / `Fill` |
| `maxDpr` | Unlimited | `devicePixelRatio` cap: the canvas renders at `min(devicePixelRatio, maxDpr)`. Reduces pixel count on large canvases / low-end devices at the cost of sharpness; unnecessary for small animations. `0` / unset = unlimited |
| `useIntersectionObserver` | `true` | Off-screen viewport optimization |
| `invisibleBehavior` | `pause` | When invisible: `pause` (timeline stops) or `skip` (skip painting only, timeline keeps advancing) |
| `frameThrottling` | `0` | Frame-throttled rendering (for complex animations): target paint-rate cap in fps; the timeline and duration are unaffected |
| `cacheFrames` / `maxCacheFrames` | `false` / `100` | Frame cache (bitmap). Enabled only when the loop range length ≤ `maxCacheFrames`; otherwise disabled entirely with a one-time hint. Prefer `frameThrottling` for large canvases |
| `defaultPoster` | - | Default static poster (shown when not playing / on error / after clear) |
| `autoPlay` | `false` | Whether to play immediately after `setVideoItem` finishes loading |

## Isomorphic Worker

- A single copy of the parsing code (`svga.worker`), compiled into an IIFE string by the build plugin and inlined.
- `useWorker: true` + browser support → real thread parsing via `new Worker(new Blob([code]))`.
- Worker unavailable / failed to construct → `new MockWorker(code)`: isomorphic main-thread parsing in a `new Function('self', 'globalThis', 'postMessage', 'importScripts', code)` sandbox.
- Parsing has a 30s timeout and self-healing `onerror` handling to avoid hanging promises. Static methods share one Worker; each `new Parser()` instance owns a dedicated Worker, and switching `useWorker` recreates it.
- ⚠️ MockWorker relies on `new Function`, so the fallback is unavailable under strict CSP (without `unsafe-eval`); real Workers require `blob:` to be allowed.

## Dynamic Replacement

```ts
player.setText({ text: 'Hello', size: '18px', color: '#fff' }, 'avatar') // replace sprite "avatar" with text
await player.setImage('https://example.com/face.png', 'avatar')          // ...or with an image
player.clearDynamic('avatar')                                            // clear one
player.clearDynamic()                                                    // clear all
```

## FAQ

- **Not returning to the first frame after stop?** `stop()` follows the configured `fillMode` (last frame / first frame / clear). Set `fillMode: 'backwards'` if you always want the first frame.
- **Pause vs. stop?** `pause()` freezes at the current frame; `stop()` ends playback and applies `fillMode`.
- **Bundle size?** Single-file ESM/CJS/UMD builds; `fflate` is inlined into the worker string, so no extra runtime dependencies are needed.

## Changelog

See [CHANGELOG.md](./CHANGELOG.md).

## License

MIT © [DreamLife(Zhou)](https://github.com/1707979815)

**If this project helps you, a [Star](https://github.com/1707979815/custom-svga) ⭐ is appreciated. Issues and PRs are welcome!**
