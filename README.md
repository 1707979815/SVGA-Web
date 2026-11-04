<div align="center">

# custom-svga

An SVGA animation player for Vue 3 & modern web — **13.3KB gzip, zero runtime dependencies**.

**English** | [简体中文](./README.zh-CN.md)

[![npm version](https://img.shields.io/npm/v/custom-svga)](https://www.npmjs.com/package/custom-svga)
[![npm downloads](https://img.shields.io/npm/dm/custom-svga)](https://www.npmjs.com/package/custom-svga)
[![minzipped size](https://img.shields.io/bundlephobia/minzip/custom-svga)](https://bundlephobia.com/package/custom-svga)
[![license](https://img.shields.io/npm/l/custom-svga)](https://www.npmjs.com/package/custom-svga)
[![GitHub stars](https://img.shields.io/github/stars/1707979815/custom-svga?style=social&label=Star)](https://github.com/1707979815/custom-svga)

```
Isomorphic inline worker · Dynamic sprite/text replacement · Frame throttling · DPR cap · Tree-shakable
```

</div>

<!-- TODO: 录屏后替换为真实 GIF：![preview](./docs/preview.gif) -->
**[Live Demo](https://1707979815.github.io/custom-svga/)** — showcase, single-instance regression and multi-instance stress playground.

- **Isomorphic inline worker parsing**: parses in a real Web Worker when available; otherwise falls back to a main-thread `MockWorker` (sandboxed `new Function`) running the exact same code — zero configuration.
- **Build-time inlining**: the worker is compiled into a string at build time and inlined into the bundle. Single entry, no separate worker files, no runtime dependencies (`fflate` is inlined too).
- **Dynamic sprite/text replacement**, poster image, forward/backward playback, scale modes, frame range, seek-to-frame, loop & end behaviors.
- **Tuned for mobile**: frame throttling, Path2D pre-caching, frame bitmap cache, DPR cap, automatic pause when off-screen.

## Why custom-svga

**Smallest in its class, with more controls than the official players.** Roughly a half to a third of the gzipped size, plus a set of playback knobs designed for real product pages.

Size, gzipped (whole package, no code splitting):

| Package | Version | gzip | vs. custom-svga |
|---|---|---|---|
| **custom-svga** | 2.4.0 | **13.3 KB** | — |
| `svga.lite` | 1.6.x | ~27 KB (per its README) | ~2× larger |
| `svgaplayerweb` | 2.3.x | ~34 KB (Bundlephobia) | ~2.6× larger |

What you get beyond a plain player:

| Capability | What it does |
|---|---|
| **Inline worker** | The parser ships inside the main bundle — nothing to deploy to `public/`, nothing to cache-bust. |
| **Isomorphic fallback** | If a real Worker is unavailable (CSP, old webview), the exact same code runs on the main thread. No blank animation. |
| **`frameThrottling`** | Caps the paint rate (e.g. 15fps) on complex animations; timeline, duration and events are untouched. |
| **`maxDpr`** | Caps `devicePixelRatio` per canvas: fewer rasterized pixels, less memory, big win on low-end Android. |
| **`cacheFrames`** | Caches rendered frames as bitmaps when the loop range fits in `maxCacheFrames`; replays become pure `drawImage`. |
| **`defaultPoster`** | A static image shown before playback, on load failure, and after `fillMode: 'clear'` — no white flash. |
| **`onPoster` event** | Tells you *why* the poster appeared (`defaultPoster` / `external` / `clear`) so you can track failures. |
| **`invisibleBehavior`** | `pause` (stop the timeline) or `skip` (keep the timeline, skip painting) when scrolled out of view. |
| **`skipRender()`** | Keep the timeline running while painting is suspended — useful for tab switches and modals. |
| **Full TypeScript** | Every config field, event payload and data structure is typed; no `any` casts in your app. |

There is also one behavioral difference that people notice right after migrating: **the last frame of every loop is always drawn** — see [Loop playback](#loop-playback-the-last-frame-is-always-drawn).

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

## Migrating from `svgaplayerweb` / `svga.lite`

The API is intentionally close, so most apps only change the loader and the playback entry point:

| `svgaplayerweb` | `custom-svga` | Note |
|---|---|---|
| `new SVGA.Player(canvas)` | `new Player(canvas \| div, config?)` | pass a container `div` and the canvas is created for you |
| `new SVGA.Parser()` + `parser.load(url, cb)` | `await Parser.loadUrl(url)` | promise-based, shared worker, LRU cache built in |
| `player.setVideoItem(item)` | same | also accepts `{ url, ...parseOptions }` directly |
| `player.startAnimation()` | `player.play(config?)` | config is passed as an argument, not as properties |
| `player.pauseAnimation()` | `player.pause()` | |
| `player.stopAnimation()` | `player.stop()` | applies `fillMode` |
| `player.stepToFrame(n, play)` | `player.stepToFrame(n, andPlay?)` | |
| `player.stepToPercentage(p)` | same | |
| `player.setImage(url, key)` | same | |
| `player.setText(dynamicText, key)` | same | `{ text, size, color, family }` |
| `player.clearDynamicObjects()` | `player.clearDynamic(key?)` | clears all when `key` is omitted |
| `player.loops = n` | `play({ loop: n })` | `0` = infinite |
| `player.clearsAfterStop = true/false` | `fillMode: 'clear' \| 'forwards' \| 'backwards'` | |
| `player.onFrame(cb)` | `player.onProcess(cb)` | payload is the frame index |
| `player.onFinished(cb)` | `player.onEnd(cb)` / `player.onLoopEnd(cb)` | `onEnd` fires only for a finite `loop` |

Three differences worth knowing before you swap:

- **The parser is promise-based** instead of callback-based, with cache and in-flight de-duplication built in (`Parser.clear()` / `Parser.delete(key)`).
- **The worker ships inside the bundle**, so there is no `svga.worker.js` to copy into `public/`, and no parser/player version mismatch to keep in sync.
- **Loop boundaries are exact**: the last frame of every loop is painted before the wrap, so slow gift animations no longer look like they "skip the end". See [Loop playback](#loop-playback-the-last-frame-is-always-drawn).

If something in your app does not map cleanly, open an issue with the snippet — migration gaps are treated as bugs.

## Player

### Constructor

```ts
new Player(element, config?)
// element: HTMLCanvasElement | HTMLDivElement (div mode auto-creates and manages the canvas)
```

### Methods

| Method | Returns | Description |
|---|---|---|
| `setVideoItem(MovieData \| VideoUrlSource)` | `Promise<void>` | Load animation data. Pass a `MovieData` from `Parser`, or `{ url, ...parseOptions }` to load inside the player (`useWorker` / `cache` / `useImageBitmap` are flattened at the top level). Failures trigger `onError` and fall back to `defaultPoster`. |
| `play(config?)` | `void` | Start / resume playback. The config is **persisted** into the instance. If the previous run ended naturally, playback restarts from the range entry frame. |
| `setConfig(config?)` | `void` | Update config only, never starts playback. Takes effect immediately even while playing (except `frameThrottling`, which applies on the next frame). |
| `playRange(startFrame, endFrame, config?)` | `void` | Play a specific frame range — shorthand for `setConfig({ startFrame, endFrame })` + `play()`. |
| `pause()` | `void` | Pause at the current frame; the timeline stops and the last painted frame stays visible. |
| `stop()` | `void` | End playback and apply `fillMode` (`forwards` = last frame, `backwards` = first frame, `clear` = clear canvas + poster). |
| `skipRender(skip?)` | `boolean` | Suspend / resume painting while the timeline keeps advancing. Called with no argument it toggles; returns the new state. |
| `stepToFrame(frame, andPlay?)` | `void` | Seek to an absolute frame. Out-of-range values are ignored. `andPlay` defaults to `false` (pauses). |
| `stepToPercentage(p, andPlay?)` | `void` | Seek by progress, `p` clamped to `[0, 1]`. |
| `setImage(img \| url, key)` | `Promise<void>` | Replace a sprite's image. Accepts `HTMLImageElement` / `ImageBitmap` / `HTMLCanvasElement` / a URL string. `key` must be an `imageKey` present in the movie. |
| `setText(text \| DynamicText, key)` | `void` | Replace a sprite with text (see `DynamicText` below). |
| `clearDynamic(key?)` | `void` | Remove one dynamic replacement, or all of them when `key` is omitted. |
| `renderPoster(url)` | `Promise<void>` | Draw an external image onto the canvas right now (one-shot, unlike `defaultPoster`). |
| `resize()` | `void` | Re-measure the container and DPR, resize the backing store accordingly. Called automatically on container resize. |
| `clear()` | `void` | Drop the current movie and clear the canvas. The instance survives — call `setVideoItem` again to reuse it. |
| `destroy()` | `void` | Fully destroy the instance: canvas (if created internally), observers, RAF, cached bitmaps and poster. A new `Player` is required afterwards. |

### DynamicText

`setText` accepts a plain string or a config object:

| Field | Type | Default | Description |
|---|---|---|---|
| `text` | `string` | — | Text content (required) |
| `size` | `string \| number` | `'14px'` | Font size, e.g. `'18px'` or `18` |
| `family` | `string` | `'Arial'` | Font family |
| `color` | `string` | `'#000000'` | Fill color, any CSS color |
| `offset` | `{ x: number; y: number }` | `{ x: 0, y: 0 }` | Offset relative to the sprite's own center |

Text is centered on the replaced sprite's layout box; use `offset` for fine positioning (e.g. baseline alignment).

### SCALE_MODE

| Value | Enum | Behaviour |
|---|---|---|
| `Fill` | `SCALE_MODE.FILL` | Stretch to fill, aspect ratio ignored |
| `AspectFill` | `SCALE_MODE.ASPECT_FILL` | Cover: keep ratio, crop overflow |
| `AspectFit` | `SCALE_MODE.ASPECT_FIT` | Contain: keep ratio, letterbox (default) |

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

### ParserOptions

| Option | Default | Description |
|---|---|---|
| `useWorker` | `true` | `false` forces main-thread parsing through the isomorphic `MockWorker` (same code, no thread) |
| `cache` | `true` | Write results into the shared 20-entry LRU |
| `useImageBitmap` | `false` | Decode images into `ImageBitmap` instead of `HTMLImageElement` (faster draw, needs explicit `close()` on eviction) |
| `movieDataId` | - | Explicit cache key. Also enables caching for buffer-based parsing, which is otherwise anonymous and skipped |
| `autoClose` | `false` | Instance only: release the Worker after each successful parse — ideal for rare, one-shot parses |

Buffer-based parsing (`loadFile` / `parseBuffer`) only writes to the cache when an explicit `movieDataId` is provided: anonymous buffers have no stable key, so they are not cached (this keeps the LRU clean).

### queryMemoryInfo

```ts
const info = await queryMemoryInfo(url, true) // log = false silences console.table
// { fileSize, imageMemory, dictionaryMemory, version, fps, frames, width, height, desc }
```

`fileSize` is the raw SVGA size; `imageMemory` estimates decoded bitmap memory (`width × height × 4` per image); `dictionaryMemory` is the JSON size of params + sprites. Useful when triaging "the animation is heavy" reports.

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
| `defaultPoster` | - | Static cover image shown before playback, on load failure, and after `fillMode: 'clear'`. See [Default poster](#default-poster-static-cover) |
| `autoPlay` | `false` | Whether to play immediately after `setVideoItem` finishes loading |

## Default poster (static cover)

`defaultPoster` is a **remote image URL** used to cover the periods when there is no animation to draw. It is not a separate layer — it is painted onto the same canvas as a fallback frame.

### When it appears

| Moment | Why |
|---|---|
| Right after construction, before `setVideoItem` | Container shows the cover instead of an empty box while the file loads |
| `setVideoItem` fails to download / parse | Weak network, 404, CORS — `onError` fires at the same time |
| `stop()` with `fillMode: 'clear'` | Canvas is cleared, poster refills it |
| After `clear()` | Movie data is gone but the instance lives on, poster takes over |
| `setConfig({ defaultPoster })` while not playing | New image is drawn immediately |

The poster hides automatically on `play()` and on `setVideoItem` (a new movie takes over the canvas).

### Typical scenarios

- **Gift / feed animations**: cards render the cover first, then swap to the animation as soon as parsing finishes — no layout jump, no white flash.
- **Weak network fallback**: SVGA files range from hundreds of KB to several MB; a static cover is far better than a blank block.
- **Paused state**: with `fillMode: 'clear'`, stopping returns the card to its cover image.
- **Consistent scaling**: the poster is scaled with the same `scaleMode` rules as the animation, so it lines up pixel-for-pixel.

### Usage

```ts
const player = new Player(canvas, {
  loop: 0,
  fillMode: 'clear',
  defaultPoster: 'https://example.com/anim-cover.png',
})

// Observable: `source` tells you why the poster showed up
player.onPoster(({ state, source, url }) => {
  if (state === 'show') console.log('poster shown', source, url)
})

// Swap the image on the fly (redrawn immediately when not playing)
player.setConfig({ defaultPoster: 'https://example.com/cover-2.png' })
```

`onPoster` payload:

| Field | Values | Meaning |
|---|---|---|
| `state` | `'show'` / `'hide'` | Poster became visible / was replaced by animation |
| `source` | `'defaultPoster'` | The configured poster was drawn (idle / clear / resize) |
| | `'external'` | `renderPoster()` was used, or the poster was drawn as load-failure fallback |
| | `'play'` / `'setMovie'` | Hide events: playback started, or a new movie was loaded |
| `url` | `string?` | Poster URL, only present on `show` |

### `defaultPoster` vs. `renderPoster()`

| | `defaultPoster` | `player.renderPoster(url)` |
|---|---|---|
| Nature | Config (passive fallback) | Method (draws once, on demand) |
| Trigger | Automatic: idle / failure / cleared canvas | Only when you call it |
| Lifetime | Lives with the instance, released on `destroy()` | Paints the current frame only; the next draw may overwrite it |

> The poster is a remote image. Cross-origin images are loaded with `crossorigin="anonymous"`, so the host must send CORS headers — otherwise loading fails and the poster silently does not appear.

## Loop playback: the last frame is always drawn

If you migrate from another SVGA player you may have seen loops where the **last frame seems to be swallowed** — the picture jumps from the second-to-last frame straight back to the first. It is most obvious on slow animations (8–12fps gift effects) and on short loops.

This library drives frames in a **draw-then-advance** order:

1. Draw `currentFrame`;
2. Emit `onProcess(currentFrame)`;
3. `currentFrame++`;
4. Only if it crosses `endFrame` does the loop wrap (`onLoopEnd` → `onEnd` → stop).

So the frame where `currentFrame === endFrame` is always painted before the wrap happens. The same holds for a custom range (`startFrame` / `endFrame`) and for `direction: 'backward'`, where `startFrame` is the last frame you see.

> With `frameThrottling` enabled, some *paints* are intentionally skipped to cap the refresh rate — but the timeline is still complete: `onProcess` and loop counting advance every frame, and the loop boundary is measured on frames, not on paints.

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
- **The last frame of a loop looks skipped?** It is not — see [Loop playback](#loop-playback-the-last-frame-is-always-drawn). Frames are drawn before advancing, so `endFrame` is always painted.
- **`defaultPoster` does not appear?** Three usual causes: the image is cross-origin without CORS headers (it is loaded with `crossorigin="anonymous"`), the config is set after `play()` started (it only paints while not playing), or the URL 404s — check `onPoster` and the console warning.
- **`setText` / `setImage` has no effect?** The `key` must be an `imageKey` that actually exists in the movie (`movie.sprites[i].imageKey`). Silent no-ops usually mean a typo or a layer the designer removed.
- **Bundle size?** Single-file ESM/CJS/UMD builds; `fflate` is inlined into the worker string, so no extra runtime dependencies are needed.

## Changelog

See [CHANGELOG.md](./CHANGELOG.md).

## Links

- npm: <https://www.npmjs.com/package/custom-svga>
- Live demo: <https://1707979815.github.io/custom-svga/>
- Issues & feature requests: <https://github.com/1707979815/custom-svga/issues>
- Source: not published — the library ships as an npm package, with the live demo as the reference implementation

## License

MIT © [DreamLife(Zhou)](https://github.com/1707979815)

**If this project helps you, a [Star](https://github.com/1707979815/custom-svga) ⭐ is appreciated. Issues and PRs are welcome!**
