<script setup lang="ts">
import { ref, onBeforeUnmount, nextTick } from 'vue'
import { Player, Parser, SCALE_MODE } from './svga'
import AssetPicker from './AssetPicker.vue'
import { DEFAULT_ASSET, appendQuery } from './assets'
import { BenchRecorder, formatSample } from './bench'
import type { BenchSample } from './bench'
import type { MovieData } from './svga'

/**
 * 基准测试页：在真实浏览器里跑「解析 → 播放 → 采样 5 秒」的固定流程，
 * 输出首帧耗时、平均帧间隔、掉帧率、长任务与堆增量。
 * 指标口径与 `bench.ts` 注释一致，仅代表当前设备的相对表现，不是绝对性能承诺。
 */

/** 当前测试素材：可从预设列表切换，也可输入任意外链 */
const assetUrl = ref(DEFAULT_ASSET)
/** 单次采样窗口 */
const SAMPLE_MS = 5000
/** 可选实例数 */
const INSTANCE_OPTIONS = [1, 4, 12]
/** 可选抽帧档位，0 = 关闭 */
const THROTTLE_OPTIONS = [0, 15, 30]

const instances = ref(1)
const throttle = ref(0)
const useCache = ref(false)
const running = ref(false)
const phase = ref('')
const sample = ref<BenchSample | null>(null)
const history = ref<Array<{ label: string; sample: BenchSample }>>([])
const canvasEls = ref<(HTMLCanvasElement | null)[]>([])

/** Player 实例放在响应式之外 */
let players: Player[] = []
/** 采样结束定时器 */
let timer: number | undefined

/**
 * 收集网格画布节点。
 * @param index 画布下标
 * @param el 模板 ref 传入的节点
 */
function setCanvas(index: number, el: unknown) {
  canvasEls.value[index] = (el as HTMLCanvasElement | null) ?? null
}

/** 销毁全部实例并清理定时器 */
function reset() {
  players.forEach(player => player.destroy())
  players = []
  if (timer) {
    clearTimeout(timer)
    timer = undefined
  }
}

/** 当前配置的可读标签 */
function currentLabel(): string {
  return `${instances.value} 实例 · 抽帧${throttle.value ? `${throttle.value}fps` : '关闭'} · 帧缓存${useCache.value ? '开' : '关'}`
}

/**
 * 按当前配置创建实例并用同一份解析结果播放。
 * @param movie 已解析的动画数据
 * @param recorder 采集器，用于记录首帧
 */
function build(movie: MovieData, recorder: BenchRecorder) {
  for (let index = 0; index < instances.value; index += 1) {
    const el = canvasEls.value[index]
    if (!el) continue
    const player = new Player(el, {
      loop: 0,
      scaleMode: SCALE_MODE.ASPECT_FIT,
      frameThrottling: throttle.value,
      cacheFrames: useCache.value,
    })
    if (index === 0) {
      /** 首帧口径：从开始解析到第一个实例就绪 */
      player.onReady(() => recorder.markFirstFrame())
    }
    player.setVideoItem(movie)
    player.play()
    players.push(player)
  }
}

/** 跑一轮完整测量 */
async function run() {
  if (running.value) return
  running.value = true
  sample.value = null
  history.value = []
  reset()
  await nextTick()

  const recorder = new BenchRecorder()
  recorder.start()
  phase.value = '解析中…'

  try {
    /** 加随机 query 绕过解析缓存，保证每次都是冷解析 */
    const movie = await Parser.loadUrl(appendQuery(assetUrl.value.trim(), 'bench', String(Date.now())))
    phase.value = '播放采样中…'
    await nextTick()
    build(movie, recorder)

    timer = window.setTimeout(() => {
      const result = recorder.stop()
      sample.value = result
      history.value = [{ label: currentLabel(), sample: result }, ...history.value].slice(0, 8)
      reset()
      running.value = false
      phase.value = ''
    }, SAMPLE_MS)
  } catch (e) {
    recorder.stop()
    running.value = false
    phase.value = e instanceof Error ? e.message : String(e)
  }
}

onBeforeUnmount(reset)
</script>

<template>
  <div class="bench">
    <section class="block">
      <header>
        <h2>基准测试</h2>
        <p>
          固定流程：冷解析 → 播放 5 秒 → 采样。指标只代表当前设备与浏览器的相对表现，不是绝对性能承诺。
        </p>
      </header>

      <div class="controls">
        <AssetPicker v-model="assetUrl" label="测试素材" />
        <div class="row">
          <span class="label">实例数</span>
          <button
            v-for="count in INSTANCE_OPTIONS"
            :key="count"
            :class="{ on: instances === count }"
            @click="instances = count"
          >
            {{ count }}
          </button>
        </div>
        <div class="row">
          <span class="label">抽帧</span>
          <button
            v-for="fps in THROTTLE_OPTIONS"
            :key="fps"
            :class="{ on: throttle === fps }"
            @click="throttle = fps"
          >
            {{ fps ? `${fps}fps` : '关闭' }}
          </button>
        </div>
        <div class="row">
          <span class="label">帧缓存</span>
          <button :class="{ on: !useCache }" @click="useCache = false">关闭</button>
          <button :class="{ on: useCache }" @click="useCache = true">开启</button>
        </div>
        <div class="row">
          <button class="primary" :disabled="running" @click="run">
            {{ running ? '测量中…' : '开始测量' }}
          </button>
          <span v-if="phase" class="phase">{{ phase }}</span>
        </div>
      </div>

      <div class="grid" :style="{ '--cols': instances > 1 ? 4 : 1 }">
        <div v-for="index in instances" :key="index" class="cell">
          <canvas :ref="el => setCanvas(index - 1, el)"></canvas>
        </div>
      </div>
    </section>

    <section v-if="sample" class="block">
      <header>
        <h2>本次结果</h2>
        <p>{{ history[0]?.label }}</p>
      </header>
      <table class="result">
        <thead>
          <tr>
            <th>首帧</th>
            <th>平均帧间隔</th>
            <th>掉帧率</th>
            <th>长任务</th>
            <th>堆增量</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{{ sample.firstFrameMs >= 0 ? `${sample.firstFrameMs.toFixed(1)}ms` : '-' }}</td>
            <td>{{ sample.avgIntervalMs.toFixed(1) }}ms</td>
            <td>{{ (sample.droppedRatio * 100).toFixed(1) }}%</td>
            <td>{{ sample.longTasks }} 次 / {{ sample.longTaskMs.toFixed(0) }}ms</td>
            <td>{{ sample.heapDeltaMB >= 0 ? `${sample.heapDeltaMB.toFixed(2)}MB` : '-' }}</td>
          </tr>
        </tbody>
      </table>
      <pre class="copy">{{ formatSample(sample) }}</pre>
    </section>

    <section v-if="history.length" class="block">
      <header>
        <h2>历史记录</h2>
        <p>同一会话内的多次测量，用于对比不同配置。</p>
      </header>
      <table class="result">
        <thead>
          <tr>
            <th>配置</th>
            <th>首帧</th>
            <th>平均帧间隔</th>
            <th>掉帧率</th>
            <th>长任务</th>
            <th>堆增量</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(item, index) in history" :key="index">
            <td class="mono">{{ item.label }}</td>
            <td>{{ item.sample.firstFrameMs >= 0 ? `${item.sample.firstFrameMs.toFixed(1)}ms` : '-' }}</td>
            <td>{{ item.sample.avgIntervalMs.toFixed(1) }}ms</td>
            <td>{{ (item.sample.droppedRatio * 100).toFixed(1) }}%</td>
            <td>{{ item.sample.longTasks }} / {{ item.sample.longTaskMs.toFixed(0) }}ms</td>
            <td>{{ item.sample.heapDeltaMB >= 0 ? `${item.sample.heapDeltaMB.toFixed(2)}MB` : '-' }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>

<style scoped lang="scss">
.bench {
  display: flex;
  flex-direction: column;
  gap: 40px;
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
      color: var(--muted);
      line-height: 1.7;
    }
  }
}

.controls {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;

  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }

  .label {
    min-width: 56px;
    font-size: 12px;
    color: var(--muted);
  }

  .phase {
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

  &.on {
    border-color: var(--accent);
    color: var(--accent);
  }

  &.primary {
    background: var(--accent);
    border-color: var(--accent);
    color: #fff;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.grid {
  display: grid;
  grid-template-columns: repeat(var(--cols, 1), minmax(0, 1fr));
  gap: 12px;
  max-width: 720px;

  .cell {
    aspect-ratio: 1 / 1;
    border: 1px solid #242b3d;
    border-radius: 12px;
    background: radial-gradient(circle at 50% 35%, #1d2740, #10131a 70%);
    overflow: hidden;

    canvas {
      display: block;
      width: 100%;
      height: 100%;
    }
  }
}

.result {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;

  th,
  td {
    padding: 8px 10px;
    border-bottom: 1px solid #242b3d;
    text-align: left;
    white-space: nowrap;
  }

  th {
    color: var(--muted);
    font-weight: 500;
    font-size: 12px;
  }

  td {
    font-variant-numeric: tabular-nums;
  }

  .mono {
    font-size: 12px;
    color: var(--muted);
  }
}

.copy {
  margin: 12px 0 0;
  padding: 10px 12px;
  border: 1px dashed #242b3d;
  border-radius: 8px;
  color: var(--muted);
  font-size: 12px;
  overflow-x: auto;
}
</style>
