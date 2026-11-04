<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { Player, Parser, SCALE_MODE, demoInfo } from './svga'
import type { DynamicText, MovieData } from './svga'

/**
 * 展示页（面向首次访问者）：用同一份 svga 素材演示
 * 「基础播放 / 动态文本替换 / 播放控制 / 性能开关 / 多实例同时播放」。
 * 与回归页（SingleView / MultiView）共用同一产物入口与同源素材，
 * 区别只是不展开全量参数面板，首屏以产品化文案 + 动效本体为主。
 */

/** 展示素材：与回归页共用 public 下的同源文件 */
const ASSET = 'svga/newGuild/a-3-badge.svga'
/** 多实例网格数量 */
const GRID_SIZE = 12
/** 动态文本预设 */
const NICKNAME_PRESETS = ['DreamLife', '夜航星', '全场最佳']
/** 抽帧候选值，0 表示关闭 */
const THROTTLE_OPTIONS = [0, 15, 30]
/** 停止行为预设 */
const FILL_MODES: { value: 'forwards' | 'backwards' | 'clear'; label: string }[] = [
  { value: 'forwards', label: '停在末帧' },
  { value: 'backwards', label: '回到首帧' },
  { value: 'clear', label: '清空画面' },
]

const loading = ref(true)
const errorMsg = ref('')
/** 素材帧率与总帧数，来自解析结果 */
const movieFps = ref(20)
const totalFrames = ref(0)

const heroCanvas = ref<HTMLCanvasElement | null>(null)
const dynCanvas = ref<HTMLCanvasElement | null>(null)
const ctrlCanvas = ref<HTMLCanvasElement | null>(null)
const perfCanvas = ref<HTMLCanvasElement | null>(null)
/** 网格画布节点，按索引收集后逐个建实例 */
const gridCanvasEls = ref<(HTMLCanvasElement | null)[]>(new Array(GRID_SIZE).fill(null))

/** 素材中可作为动态替换目标的图层 key */
const dynKeys = ref<string[]>([])
const activeKey = ref('')
const nickname = ref(NICKNAME_PRESETS[0])

/** 播放控制区块状态 */
const ctrlFrame = ref(0)
const ctrlPlaying = ref(false)
const ctrlReverse = ref(false)
const ctrlFillMode = ref<'forwards' | 'backwards' | 'clear'>('forwards')

/** 性能区块状态：目标渲染帧率与帧缓存开关 */
const throttle = ref(0)
const useCache = ref(false)

/** 抽帧后实际每 N 个动画帧绘制一次（与 Renderer 内部取整规则一致） */
const throttleInterval = computed(() => {
  if (!throttle.value) return 1
  return Math.max(1, Math.ceil(movieFps.value / throttle.value))
})

/** 解析结果共享给全部实例（Parser 内置 LRU，多实例复用同一 MovieData） */
let movie: MovieData | null = null
/** Player 实例一律放在响应式之外，避免 Vue 深层解包带来的类型干扰与额外开销 */
let heroPlayer: Player | null = null
let dynPlayer: Player | null = null
let ctrlPlayer: Player | null = null
let perfPlayer: Player | null = null
const gridPlayers = new Map<number, Player>()

/**
 * 收集 v-for 渲染出的 canvas 节点。
 * @param index 网格下标
 * @param el 模板 ref 传入的节点
 */
function setGridCanvas(index: number, el: unknown) {
  gridCanvasEls.value[index] = (el as HTMLCanvasElement | null) ?? null
}

/**
 * 把昵称写入当前选中的图层。
 * key 取自素材真实图层，避免写死不存在的名字导致替换静默失效。
 * @param text 要展示的文案
 */
function applyNickname(text: string) {
  nickname.value = text
  if (!dynPlayer || !activeKey.value) return
  const dynamicText: DynamicText = { text, size: '22px', color: '#ffffff', family: 'sans-serif' }
  dynPlayer.setText(dynamicText, activeKey.value)
}

/**
 * 切换动态替换的目标图层。
 * @param key 素材图层 key
 */
function selectKey(key: string) {
  activeKey.value = key
  applyNickname(nickname.value)
}

/** 播放控制：按当前方向与停止行为播放 */
function playCtrl() {
  if (!ctrlPlayer) return
  ctrlPlayer.play({
    direction: ctrlReverse.value ? 'backward' : 'forward',
    fillMode: ctrlFillMode.value,
  })
  ctrlPlaying.value = true
}

/** 播放控制：暂停在当前帧 */
function pauseCtrl() {
  ctrlPlayer?.pause()
  ctrlPlaying.value = false
}

/** 播放控制：停止并按 fillMode 收尾 */
function stopCtrl() {
  ctrlPlayer?.stop()
  ctrlPlaying.value = false
}

/** 播放控制：切换正序 / 逆序 */
function toggleReverse() {
  ctrlReverse.value = !ctrlReverse.value
  if (ctrlPlaying.value) playCtrl()
}

/**
 * 播放控制：切换停止行为（只热更新配置，不触发播放）。
 * @param mode 停止行为
 */
function selectFillMode(mode: 'forwards' | 'backwards' | 'clear') {
  ctrlFillMode.value = mode
  ctrlPlayer?.setConfig({ fillMode: mode })
}

/**
 * 播放控制：进度条定位到指定帧。
 * @param event 原生 input 事件
 */
function seekCtrl(event: Event) {
  const frame = Number((event.target as HTMLInputElement).value)
  ctrlFrame.value = frame
  ctrlPlaying.value = false
  ctrlPlayer?.stepToFrame(frame)
}

/** 性能区块：把抽帧与帧缓存配置下发到实例（播放中即时生效） */
function applyPerf() {
  perfPlayer?.setConfig({ frameThrottling: throttle.value, cacheFrames: useCache.value })
}

/**
 * 性能区块：切换抽帧目标帧率。
 * @param fps 目标渲染帧率，0 表示关闭
 */
function selectThrottle(fps: number) {
  throttle.value = fps
  applyPerf()
}

/** 性能区块：切换帧缓存 */
function toggleCache() {
  useCache.value = !useCache.value
  applyPerf()
}

/** 加载素材并挂载全部实例 */
async function mount() {
  try {
    movie = await Parser.loadUrl(ASSET)
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : String(e)
    loading.value = false
    return
  }

  movieFps.value = movie.params.fps || 20
  totalFrames.value = movie.params.frames || 0
  dynKeys.value = [...new Set(movie.sprites.map(sprite => sprite.imageKey).filter(key => !!key))]
  activeKey.value = dynKeys.value[0] ?? ''
  loading.value = false
  await nextTick()

  if (heroCanvas.value) {
    heroPlayer = new Player(heroCanvas.value, { loop: 0, scaleMode: SCALE_MODE.ASPECT_FIT })
    heroPlayer.onReady(() => heroPlayer?.play())
    heroPlayer.setVideoItem(movie)
  }

  if (dynCanvas.value) {
    dynPlayer = new Player(dynCanvas.value, { loop: 0, scaleMode: SCALE_MODE.ASPECT_FIT })
    dynPlayer.onReady(() => {
      applyNickname(nickname.value)
      dynPlayer?.play()
    })
    dynPlayer.setVideoItem(movie)
  }

  if (ctrlCanvas.value) {
    ctrlPlayer = new Player(ctrlCanvas.value, { loop: 0, scaleMode: SCALE_MODE.ASPECT_FIT })
    ctrlPlayer.onProcess(frame => {
      ctrlFrame.value = frame
    })
    ctrlPlayer.onReady(() => playCtrl())
    ctrlPlayer.setVideoItem(movie)
  }

  if (perfCanvas.value) {
    perfPlayer = new Player(perfCanvas.value, { loop: 0, scaleMode: SCALE_MODE.ASPECT_FIT })
    perfPlayer.onReady(() => perfPlayer?.play())
    perfPlayer.setVideoItem(movie)
  }

  for (let index = 0; index < GRID_SIZE; index += 1) {
    const el = gridCanvasEls.value[index]
    if (!el) continue
    const player = new Player(el, { loop: 0, scaleMode: SCALE_MODE.ASPECT_FIT })
    player.setVideoItem(movie)
    player.play()
    gridPlayers.set(index, player)
  }
}

onMounted(mount)

onBeforeUnmount(() => {
  heroPlayer?.destroy()
  heroPlayer = null
  dynPlayer?.destroy()
  dynPlayer = null
  ctrlPlayer?.destroy()
  ctrlPlayer = null
  perfPlayer?.destroy()
  perfPlayer = null
  gridPlayers.forEach(player => player.destroy())
  gridPlayers.clear()
  movie = null
})
</script>

<template>
  <div class="showcase">
    <section class="hero">
      <div class="copy">
        <p class="eyebrow">SVGA ANIMATION PLAYER</p>
        <h1>13.3KB gzip 的<br />SVGA 播放器</h1>
        <p class="lead">
          同构内联 Worker 解析、动态精灵 / 文本替换、抽帧渲染与 DPR 上限，零运行时依赖。
        </p>
        <ul class="chips">
          <li>Vue 3</li>
          <li>TypeScript</li>
          <li>零依赖</li>
          <li>可摇树</li>
        </ul>
        <p class="build">当前产物：{{ demoInfo.name }} · {{ demoInfo.entry }}</p>
      </div>

      <div class="hero-stage">
        <div class="stage">
          <canvas ref="heroCanvas"></canvas>
          <p v-if="loading" class="hint">加载中…</p>
          <p v-else-if="errorMsg" class="hint err">{{ errorMsg }}</p>
        </div>
        <p class="caption">单实例循环播放 · AspectFit</p>
      </div>
    </section>

    <section class="block">
      <header>
        <h2>动态文本替换</h2>
        <p><code>setText(text, key)</code> 把素材里的图层换成任意文案，无需重新导出动效。</p>
      </header>
      <div class="dyn">
        <div class="dyn-stage">
          <canvas ref="dynCanvas"></canvas>
        </div>
        <div class="dyn-controls">
          <div class="field">
            <span class="label">替换图层</span>
            <button
              v-for="key in dynKeys"
              :key="key"
              :class="{ on: key === activeKey }"
              @click="selectKey(key)"
            >
              {{ key }}
            </button>
            <em v-if="!dynKeys.length">该素材不含可替换图层</em>
          </div>
          <div class="field">
            <span class="label">文案</span>
            <button
              v-for="item in NICKNAME_PRESETS"
              :key="item"
              :class="{ on: item === nickname }"
              @click="applyNickname(item)"
            >
              {{ item }}
            </button>
          </div>
        </div>
      </div>
    </section>

    <section class="block">
      <header>
        <h2>播放控制</h2>
        <p>正 / 逆序、暂停与停止、任意帧定位 —— 配置随 <code>play(config)</code> 持久生效。</p>
      </header>
      <div class="split">
        <div class="stage small">
          <canvas ref="ctrlCanvas"></canvas>
        </div>
        <div class="controls">
          <div class="row">
            <button class="primary" @click="playCtrl">播放</button>
            <button @click="pauseCtrl">暂停</button>
            <button @click="stopCtrl">停止</button>
            <button :class="{ on: ctrlReverse }" @click="toggleReverse">
              {{ ctrlReverse ? '逆序中' : '逆序播放' }}
            </button>
          </div>
          <div class="row">
            <span class="label">停止行为</span>
            <button
              v-for="mode in FILL_MODES"
              :key="mode.value"
              :class="{ on: ctrlFillMode === mode.value }"
              @click="selectFillMode(mode.value)"
            >
              {{ mode.label }}
            </button>
          </div>
          <div class="row">
            <span class="label">定位</span>
            <input
              class="range"
              type="range"
              min="0"
              :max="Math.max(totalFrames - 1, 0)"
              :value="ctrlFrame"
              @input="seekCtrl"
            />
            <span class="value">{{ ctrlFrame }} / {{ Math.max(totalFrames - 1, 0) }}</span>
          </div>
          <p class="tip">
            状态：{{ ctrlPlaying ? '播放中' : '已暂停 / 停止' }} · 素材 {{ movieFps }}fps ·
            共 {{ totalFrames }} 帧
          </p>
        </div>
      </div>
    </section>

    <section class="block">
      <header>
        <h2>性能开关</h2>
        <p>
          抽帧只降低画面刷新频率，动画时间轴、时长与事件一律不受影响；帧缓存适合短循环动效。
        </p>
      </header>
      <div class="split">
        <div class="stage small">
          <canvas ref="perfCanvas"></canvas>
        </div>
        <div class="controls">
          <div class="row">
            <span class="label">抽帧渲染</span>
            <button :class="{ on: throttle === 0 }" @click="selectThrottle(0)">关闭</button>
            <button
              v-for="fps in THROTTLE_OPTIONS.filter(item => item > 0)"
              :key="fps"
              :class="{ on: throttle === fps }"
              @click="selectThrottle(fps)"
            >
              {{ fps }}fps
            </button>
          </div>
          <div class="row">
            <span class="label">帧缓存</span>
            <button :class="{ on: !useCache }" @click="toggleCache">关闭</button>
            <button :class="{ on: useCache }" @click="toggleCache">开启</button>
          </div>
          <p class="tip">
            <template v-if="throttle === 0">未开启抽帧：每个动画帧都绘制。</template>
            <template v-else>
              目标 {{ throttle }}fps：每 {{ throttleInterval }} 个动画帧绘制 1 帧（约
              {{ Math.round(movieFps / throttleInterval) }}fps 画面刷新）。
            </template>
          </p>
          <p class="tip">
            帧缓存仅在循环区间不超过 <code>maxCacheFrames</code>（默认 100）时启用，本例
            {{ totalFrames }} 帧。
          </p>
        </div>
      </div>
    </section>

    <section class="block">
      <header>
        <h2>多实例同时播放</h2>
        <p>{{ GRID_SIZE }} 个 Player 各自独立 RAF，共享同一份解析结果。</p>
      </header>
      <div class="grid">
        <div v-for="index in GRID_SIZE" :key="index" class="cell">
          <canvas :ref="el => setGridCanvas(index - 1, el)"></canvas>
        </div>
      </div>
    </section>

    <section class="block">
      <header>
        <h2>三行接入</h2>
        <p>解析、创建、播放，没有额外的 worker 文件需要部署。</p>
      </header>
      <pre class="code"><code>import { Player, Parser } from 'custom-svga'

const player = new Player(canvas, { loop: 0 })
player.setVideoItem(await Parser.loadUrl('/anim.svga'))
player.play()</code></pre>
    </section>
  </div>
</template>

<style scoped lang="scss">
.showcase {
  display: flex;
  flex-direction: column;
  gap: 48px;
  padding: 32px 0 64px;
}

.hero {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 40px;

  .copy {
    flex: 1 1 320px;
    min-width: 0;
  }

  .eyebrow {
    margin: 0 0 8px;
    font-size: 12px;
    letter-spacing: 0.16em;
    color: var(--accent);
  }

  h1 {
    margin: 0 0 16px;
    font-size: 40px;
    line-height: 1.2;
    font-weight: 700;
  }

  .lead {
    margin: 0 0 20px;
    max-width: 42ch;
    color: var(--muted);
    line-height: 1.7;
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 0 0 16px;
    padding: 0;
    list-style: none;

    li {
      padding: 4px 10px;
      border: 1px solid #242b3d;
      border-radius: 999px;
      font-size: 12px;
      color: var(--muted);
    }
  }

  .build {
    margin: 0;
    font-size: 12px;
    color: #5b6478;
  }
}

.hero-stage {
  flex: 0 0 auto;
  width: 320px;
  max-width: 100%;

  .caption {
    margin: 8px 0 0;
    font-size: 12px;
    color: var(--muted);
    text-align: center;
  }
}

.stage,
.dyn-stage {
  position: relative;
  aspect-ratio: 1 / 1;
  border: 1px solid #242b3d;
  border-radius: 14px;
  background: radial-gradient(circle at 50% 35%, #1d2740, #10131a 70%);
  overflow: hidden;

  canvas {
    display: block;
    width: 100%;
    height: 100%;
  }

  .hint {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0;
    font-size: 13px;
    color: var(--muted);

    &.err {
      color: var(--err);
      padding: 0 16px;
      text-align: center;
    }
  }
}

.block {
  header {
    margin-bottom: 16px;

    h2 {
      margin: 0 0 6px;
      font-size: 20px;
    }

    p {
      margin: 0;
      font-size: 13px;
      color: var(--muted);
    }

    code {
      color: var(--accent);
    }
  }
}

.split {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  align-items: flex-start;

  .stage.small {
    flex: 0 0 240px;
    width: 240px;
  }

  .controls {
    flex: 1 1 280px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    min-width: 0;

    .row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }

    .label {
      font-size: 12px;
      color: var(--muted);
      min-width: 56px;
    }

    .value {
      font-size: 12px;
      color: var(--muted);
      font-variant-numeric: tabular-nums;
    }

    .tip {
      margin: 0;
      font-size: 12px;
      line-height: 1.7;
      color: var(--muted);

      code {
        color: var(--accent);
      }
    }
  }
}

button {
  padding: 6px 14px;
  border: 1px solid #242b3d;
  border-radius: 8px;
  background: var(--panel);
  color: var(--text);
  font-size: 13px;
  cursor: pointer;

  &.on {
    border-color: var(--accent);
    color: var(--accent);
  }

  &.primary {
    background: var(--accent);
    border-color: var(--accent);
    color: #fff;
  }
}

.range {
  flex: 1 1 160px;
  min-width: 120px;
  accent-color: var(--accent);
}

.dyn {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  align-items: flex-start;

  .dyn-stage {
    flex: 0 0 240px;
    width: 240px;
  }

  .dyn-controls {
    flex: 1 1 240px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-width: 0;
  }

  .field {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;

    .label {
      font-size: 12px;
      color: var(--muted);
      margin-right: 4px;
    }

    em {
      font-size: 12px;
      color: var(--muted);
    }
  }
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
  gap: 12px;

  .cell {
    aspect-ratio: 1 / 1;
    border: 1px solid #242b3d;
    border-radius: 10px;
    background: var(--panel);
    overflow: hidden;

    canvas {
      display: block;
      width: 100%;
      height: 100%;
    }
  }
}

.code {
  margin: 0;
  padding: 16px 18px;
  border: 1px solid #242b3d;
  border-radius: 10px;
  background: var(--panel);
  color: #c8d2e8;
  font-size: 13px;
  line-height: 1.7;
  overflow-x: auto;
}
</style>
