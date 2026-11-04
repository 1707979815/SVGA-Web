<script setup lang="ts">
import { ref, onBeforeUnmount, nextTick } from 'vue'
import { Player, Parser, SCALE_MODE } from './svga'
import type { MovieData } from './svga'

/**
 * 对比页：同一素材、同样尺寸，左右并排跑官方 `svgaplayerweb` 与本包。
 * 官方包按需从 CDN 动态加载（不进入本仓库构建产物），加载失败时整块降级提示。
 * 面板里最关键的一行是「历史最大帧号」：本包每轮都能到达 `总帧数 - 1`。
 */

/** 对比素材 */
const ASSET = 'svga/newGuild/a-3-badge.svga'
/** 官方包 CDN 地址 */
const OFFICIAL_CDN = 'https://cdn.jsdelivr.net/npm/svgaplayerweb@2.3.2/build/svga.min.js'

/** 官方包 Player 的最小可用接口（只声明用到的成员） */
interface OfficialPlayer {
  loops: number;
  clearsAfterStop: boolean;
  setContentMode(mode: string): void;
  setVideoItem(item: unknown): void;
  startAnimation(): void;
  pauseAnimation(): void;
  onFrame(callback: (frame: number) => void): void;
  clear(): void;
}

/** 官方包 Parser 的最小可用接口 */
interface OfficialParser {
  load(url: string, success: (item: unknown) => void, failure: (error: unknown) => void): void;
}

/** 官方包挂到 window 上的全局对象 */
interface SvgaGlobal {
  Player: new (target: HTMLElement | string) => OfficialPlayer;
  Parser: new (target?: HTMLElement | string) => OfficialParser;
}

const status = ref('待开始')
const officialState = ref('未加载')
const localState = ref('未加载')
const officialLoadMs = ref(-1)
const localLoadMs = ref(-1)
const officialMaxFrame = ref(-1)
const localMaxFrame = ref(-1)
const totalFrames = ref(0)
const loopCount = ref(0)
const officialRunning = ref(false)
const localRunning = ref(false)

const officialHost = ref<HTMLDivElement | null>(null)
const localCanvas = ref<HTMLCanvasElement | null>(null)

let officialPlayer: OfficialPlayer | null = null
let localPlayer: Player | null = null
let movie: MovieData | null = null

/**
 * 动态加载外部脚本（同一份只加载一次）。
 * @param src 脚本地址
 * @returns 加载完成的 Promise
 */
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existed = document.querySelector<HTMLScriptElement>('script[data-official-svga]')
    if (existed) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.dataset.officialSvga = '1'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('官方包 CDN 加载失败（可能被网络策略拦截）'))
    document.head.appendChild(script)
  })
}

/** 卸载两边实例（官方包没有 destroy，只能清空容器） */
function teardown() {
  localPlayer?.destroy()
  localPlayer = null
  try {
    officialPlayer?.clear()
  } catch {
    /** 官方包在未就绪时 clear 可能抛错，忽略 */
  }
  officialPlayer = null
  if (officialHost.value) officialHost.value.innerHTML = ''
  movie = null
}

/** 开始对比：并行加载两边，记录各自加载耗时 */
async function start() {
  status.value = '准备中…'
  teardown()
  officialMaxFrame.value = -1
  localMaxFrame.value = -1
  totalFrames.value = 0
  loopCount.value = 0
  officialLoadMs.value = -1
  localLoadMs.value = -1
  localState.value = '加载中'
  officialState.value = '加载中'
  await nextTick()

  const url = new URL(ASSET, location.href).href

  /** 本包：解析 + 实例化 */
  const localStart = performance.now()
  try {
    movie = await Parser.loadUrl(`${ASSET}?compare=${Date.now()}`)
    totalFrames.value = movie.params.frames || 0
    if (localCanvas.value) {
      localPlayer = new Player(localCanvas.value, { loop: 0, scaleMode: SCALE_MODE.ASPECT_FIT })
      localPlayer.onProcess(frame => {
        if (frame > localMaxFrame.value) localMaxFrame.value = frame
      })
      localPlayer.onLoopEnd(() => {
        loopCount.value += 1
      })
      localPlayer.setVideoItem(movie)
      localPlayer.play()
      localRunning.value = true
      localLoadMs.value = performance.now() - localStart
      localState.value = '播放中'
    }
  } catch (e) {
    localState.value = e instanceof Error ? e.message : '加载失败'
  }

  /** 官方包：CDN + 回调式 API */
  const officialStart = performance.now()
  try {
    await loadScript(OFFICIAL_CDN)
    const svga = (window as unknown as { SVGA?: SvgaGlobal }).SVGA
    if (!svga || !officialHost.value) throw new Error('官方包未挂载到 window.SVGA')

    officialPlayer = new svga.Player(officialHost.value)
    /** 公平对比：官方包默认 clearsAfterStop = true，循环结束会清屏，这里显式关掉 */
    officialPlayer.loops = 0
    officialPlayer.clearsAfterStop = false
    officialPlayer.setContentMode('AspectFit')
    officialPlayer.onFrame(frame => {
      if (frame > officialMaxFrame.value) officialMaxFrame.value = frame
    })

    const parser = new svga.Parser()
    parser.load(
      url,
      item => {
        officialPlayer?.setVideoItem(item)
        officialPlayer?.startAnimation()
        officialRunning.value = true
        officialLoadMs.value = performance.now() - officialStart
        officialState.value = '播放中'
      },
      () => {
        officialState.value = '解析失败'
      }
    )
  } catch (e) {
    officialState.value = e instanceof Error ? e.message : '加载失败'
  }

  status.value = '对比中'
}

/** 同步播放两边 */
function playBoth() {
  localPlayer?.play()
  localRunning.value = !!localPlayer
  if (officialPlayer) {
    officialPlayer.startAnimation()
    officialRunning.value = true
  }
}

/** 同步暂停两边 */
function pauseBoth() {
  localPlayer?.pause()
  localRunning.value = false
  if (officialPlayer) {
    officialPlayer.pauseAnimation()
    officialRunning.value = false
  }
}

onBeforeUnmount(teardown)
</script>

<template>
  <div class="compare">
    <section class="block">
      <header>
        <h2>与官方包并排对比</h2>
        <p>
          同一素材、同样尺寸、同样无限循环。官方包通过 CDN 动态加载（不进入本仓库产物），
          并把 <code>clearsAfterStop</code> 显式设为 <code>false</code>，避免它默认的清屏行为影响对比公平性。
        </p>
      </header>

      <div class="actions">
        <button class="primary" @click="start">开始 / 重载对比</button>
        <button @click="playBoth">同步播放</button>
        <button @click="pauseBoth">同步暂停</button>
        <span class="status">{{ status }}</span>
      </div>

      <div class="pairs">
        <div class="pane">
          <h3>svgaplayerweb <span>2.3.2</span></h3>
          <div class="stage">
            <div ref="officialHost" class="surface"></div>
          </div>
          <dl>
            <div><dt>状态</dt><dd>{{ officialState }}</dd></div>
            <div><dt>加载耗时</dt><dd>{{ officialLoadMs >= 0 ? `${officialLoadMs.toFixed(0)}ms` : '-' }}</dd></div>
            <div><dt>历史最大帧号</dt><dd class="key">{{ officialMaxFrame >= 0 ? officialMaxFrame : '-' }}</dd></div>
          </dl>
        </div>

        <div class="pane">
          <h3>custom-svga <span>本包</span></h3>
          <div class="stage">
            <canvas ref="localCanvas"></canvas>
          </div>
          <dl>
            <div><dt>状态</dt><dd>{{ localState }}</dd></div>
            <div><dt>加载耗时</dt><dd>{{ localLoadMs >= 0 ? `${localLoadMs.toFixed(0)}ms` : '-' }}</dd></div>
            <div><dt>历史最大帧号</dt><dd class="key">{{ localMaxFrame >= 0 ? localMaxFrame : '-' }}</dd></div>
            <div><dt>已完成循环</dt><dd>{{ loopCount }} 轮</dd></div>
          </dl>
        </div>
      </div>

      <p class="note">
        总帧数 {{ totalFrames || '-' }}（以本包解析结果为准，两边素材相同）。「历史最大帧号」达到
        {{ totalFrames > 0 ? totalFrames - 1 : '总帧数-1' }} 即说明该实现把最后一帧完整画出来了。
      </p>
    </section>
  </div>
</template>

<style scoped lang="scss">
.compare {
  padding: 28px 0 64px;
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
      line-height: 1.7;
      color: var(--muted);
    }

    code {
      color: var(--accent);
    }
  }
}

.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 20px;

  .status {
    font-size: 12px;
    color: var(--warn);
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

  &.primary {
    background: var(--accent);
    border-color: var(--accent);
    color: #fff;
  }
}

.pairs {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
}

.pane {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;

  h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;

    span {
      font-weight: 400;
      font-size: 12px;
      color: var(--muted);
    }
  }
}

.stage {
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

  .surface {
    width: 100%;
    height: 100%;
  }

  /** 官方包会在容器内自建 canvas，这里强制铺满 */
  :deep(canvas) {
    display: block;
    width: 100% !important;
    height: 100% !important;
  }
}

dl {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;

  div {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    font-size: 12px;
  }

  dt {
    color: var(--muted);
  }

  dd {
    margin: 0;
    font-variant-numeric: tabular-nums;

    &.key {
      color: var(--accent);
      font-weight: 600;
    }
  }
}

.note {
  margin: 18px 0 0;
  font-size: 12px;
  line-height: 1.7;
  color: var(--muted);
}
</style>
