<script setup lang="ts">
import { ref, computed, onBeforeUnmount } from 'vue'
import { Player, Parser, SCALE_MODE, demoInfo } from './svga'
import AssetPicker from './AssetPicker.vue'
import { DEFAULT_ASSET } from './assets'
import type { MovieData, DynamicText } from './svga'

const urlInput = ref(DEFAULT_ASSET)
const mainCanvas = ref<HTMLCanvasElement | null>(null)

// —— 资源（URL / 点选文件 / 拖拽文件，主资源、动态图片、海报共用）——
type SourceTarget = 'main' | 'image' | 'poster'
const mainFile = ref<File | null>(null)
const imageFile = ref<File | null>(null)
const posterFile = ref<File | null>(null)
const dragTarget = ref<SourceTarget | null>(null)
const fileInputMain = ref<HTMLInputElement | null>(null)
const fileInputImage = ref<HTMLInputElement | null>(null)
const fileInputPoster = ref<HTMLInputElement | null>(null)

const mainSourceLabel = computed(() => {
  if (mainFile.value) return `文件：${mainFile.value.name}`
  return urlInput.value.trim() ? `URL：${urlInput.value}` : '未选择资源'
})
const imageSourceLabel = computed(() => imageFile.value ? `文件：${imageFile.value.name}` : '未选择图片')
const posterSourceLabel = computed(() => posterFile.value ? `文件：${posterFile.value.name}` : '未选择海报')

// —— 播放配置 ——
const autoPlay = ref(true)
const loopEnabled = ref(true)
const playRange = ref<'all' | 'range'>('all')
const rangeStart = ref(0)
const rangeEnd = ref(0)
const playToFrameEnabled = ref(false)
const playToFrame = ref(0)
const endMode = ref<'forwards' | 'backwards' | 'clear' | 'frame'>('forwards')
const endFrameSelect = ref(0)
const direction = ref<'forward' | 'backward'>('forward')
const scaleMode = ref<SCALE_MODE>(SCALE_MODE.ASPECT_FIT)

const totalFrames = ref(0)
const frameOptions = computed(() => totalFrames.value > 0 ? Array.from({ length: totalFrames.value }, (_, i) => i) : [])
let framesInit = false

function playerConfig() {
  const cfg: { loop: number; fillMode: 'forwards' | 'backwards' | 'clear'; startFrame?: number; endFrame?: number; defaultPoster?: string; direction: 'forward' | 'backward'; scaleMode: SCALE_MODE; autoPlay: boolean } = {
    loop: loopEnabled.value ? 0 : 1,
    fillMode: 'forwards',
    direction: direction.value,
    scaleMode: scaleMode.value,
    autoPlay: autoPlay.value,
  }
  if (playRange.value === 'range') {
    cfg.startFrame = Math.max(0, rangeStart.value || 0)
    cfg.endFrame = Math.max(cfg.startFrame, rangeEnd.value || cfg.startFrame)
  }
  if (playToFrameEnabled.value) {
    cfg.endFrame = Math.max(0, playToFrame.value || 0)
  }
  if (endMode.value === 'backwards') cfg.fillMode = 'backwards'
  else if (endMode.value === 'clear') cfg.fillMode = 'clear'
  return cfg
}

// —— 场景预设（回归测试覆盖全部组合）——
interface Scenario { value: string; name: string; desc: string; set: () => void }
const scenarioSel = ref('default')
const scenarioDesc = ref('')
const scenarios: Scenario[] = [
  { value: 'default', name: '① 无限循环 · 全部播放 · 末帧', desc: 'loop=无限 · 范围=全部 · 结束后=显示最后一帧',
    set() { autoPlay.value = true; loopEnabled.value = true; playRange.value = 'all'; playToFrameEnabled.value = false; endMode.value = 'forwards' } },
  { value: 'once-last', name: '② 单次 · 全部 · 末帧', desc: 'loop=1 · 范围=全部 · 结束后=显示最后一帧',
    set() { autoPlay.value = true; loopEnabled.value = false; playRange.value = 'all'; playToFrameEnabled.value = false; endMode.value = 'forwards' } },
  { value: 'once-first', name: '③ 单次 · 全部 · 首帧', desc: 'loop=1 · 范围=全部 · 结束后=显示第一帧',
    set() { autoPlay.value = true; loopEnabled.value = false; playRange.value = 'all'; playToFrameEnabled.value = false; endMode.value = 'backwards' } },
  { value: 'once-clear', name: '④ 单次 · 全部 · 清空', desc: 'loop=1 · 范围=全部 · 结束后=清空画布',
    set() { autoPlay.value = true; loopEnabled.value = false; playRange.value = 'all'; playToFrameEnabled.value = false; endMode.value = 'clear' } },
  { value: 'once-frame', name: '⑤ 单次 · 全部 · 结束后指定帧', desc: 'loop=1 · 范围=全部 · 结束后=显示指定帧（下拉选择）',
    set() { autoPlay.value = true; loopEnabled.value = false; playRange.value = 'all'; playToFrameEnabled.value = false; endMode.value = 'frame' } },
  { value: 'range', name: '⑥ 单次 · 区间 20-60 · 末帧', desc: 'loop=1 · 范围=区间[20,60] · 结束后=末帧',
    set() { autoPlay.value = true; loopEnabled.value = false; playRange.value = 'range'; rangeStart.value = 20; rangeEnd.value = 60; playToFrameEnabled.value = false; endMode.value = 'forwards' } },
  { value: 'to-frame', name: '⑦ 单次 · 播放至帧 30', desc: 'loop=1 · 范围=全部 · 播放至指定帧=30',
    set() { autoPlay.value = true; loopEnabled.value = false; playRange.value = 'all'; playToFrameEnabled.value = true; playToFrame.value = 30; endMode.value = 'forwards' } },
  { value: 'range-to-frame', name: '⑧ 单次 · 区间 20-60 · 至帧 40', desc: 'loop=1 · 范围=区间[20,60] · 播放至指定帧=40',
    set() { autoPlay.value = true; loopEnabled.value = false; playRange.value = 'range'; rangeStart.value = 20; rangeEnd.value = 60; playToFrameEnabled.value = true; playToFrame.value = 40; endMode.value = 'forwards' } },
  { value: 'range-frame-end', name: '⑨ 单次 · 区间 20-60 · 结束后指定帧', desc: 'loop=1 · 范围=区间[20,60] · 结束后=指定帧',
    set() { autoPlay.value = true; loopEnabled.value = false; playRange.value = 'range'; rangeStart.value = 20; rangeEnd.value = 60; playToFrameEnabled.value = false; endMode.value = 'frame' } },
  { value: 'no-autoplay', name: '⑩ 全部 · 不自动播放', desc: 'loop=无限 · 范围=全部 · 不自动播放（手动点播放）',
    set() { autoPlay.value = false; loopEnabled.value = true; playRange.value = 'all'; playToFrameEnabled.value = false; endMode.value = 'forwards' } },
  { value: 'backward', name: '⑪ 单次 · 逆序播放', desc: 'loop=1 · 范围=全部 · 方向=逆向（backward）',
    set() { autoPlay.value = true; loopEnabled.value = false; playRange.value = 'all'; playToFrameEnabled.value = false; endMode.value = 'forwards'; direction.value = 'backward' } },
  { value: 'aspectfill', name: '⑫ 无限 · 缩放 AspectFill', desc: 'loop=无限 · 范围=全部 · 缩放=AspectFill(cover)',
    set() { autoPlay.value = true; loopEnabled.value = true; playRange.value = 'all'; playToFrameEnabled.value = false; endMode.value = 'forwards'; scaleMode.value = SCALE_MODE.ASPECT_FILL } },
]
function applyScenario() {
  const sc = scenarios.find(s => s.value === scenarioSel.value)
  if (sc) {
    direction.value = 'forward'
    scaleMode.value = SCALE_MODE.ASPECT_FIT
    sc.set()
    scenarioDesc.value = sc.desc
    log(`已应用场景：${sc.name}`, 'info')
  }
}

// —— 播放状态 ——
let player: Player | null = null
const busy = ref(false)
const isPlaying = ref(false)
const skipRenderOn = ref(false)
const frame = ref(0)
const loopCount = ref(0)
const fps = ref(0)

const status = ref('就绪：选场景 →「初始化」→「加载/解析」')
const statusLevel = ref<'info' | 'ok' | 'warn' | 'err'>('info')
const logs = ref<string[]>([])

const statusColor = computed(() => {
  const map = { ok: 'var(--ok)', warn: 'var(--warn)', err: 'var(--err)', info: 'var(--muted)' } as const
  return map[statusLevel.value]
})

function log(msg: string, level: 'info' | 'ok' | 'warn' | 'err' = 'info') {
  const t = new Date().toLocaleTimeString()
  logs.value.unshift(`[${t}] ${msg}`)
  if (logs.value.length > 200) logs.value.length = 200
  status.value = msg
  statusLevel.value = level
}

// —— 动态替换 / 海报配置 ——
const spriteKeys = ref<string[]>([])
const dynKey = ref('')
const textInput = ref('Hello CustomSvga')
const textSize = ref('18px')
const textColor = ref('#ffffff')
const textFamily = ref('sans-serif')
const imageUrl = ref('')
const posterUrl = ref('')
const posterAsDefault = ref(false)

function collectKeys(movieData?: MovieData): string[] {
  const keys: string[] = []
  for (const s of movieData?.sprites ?? []) {
    const k = (s as any)?.imageKey
    if (k && !keys.includes(k)) keys.push(k)
  }
  return keys
}

// —— 文件获取（点选 / 拖拽）——
/**
 * 切资源地址（下拉预设或手输）时清掉已选文件：文件优先级高于 URL，
 * 留着旧文件会让下拉选择看起来「没生效」。
 */
function onAssetChange() {
  mainFile.value = null
}

function applyFile(target: SourceTarget, file: File) {
  if (target === 'main') mainFile.value = file
  else if (target === 'image') imageFile.value = file
  else posterFile.value = file
  const label = target === 'main' ? '主资源' : target === 'image' ? '动态图片' : '海报'
  log(`已选择${label}：${file.name}`, 'ok')
}

function onFilePicked(target: SourceTarget, e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file) applyFile(target, file)
}

function onDrop(target: SourceTarget, e: DragEvent) {
  dragTarget.value = null
  const file = e.dataTransfer?.files?.[0]
  if (file) applyFile(target, file)
}

function fileToImageUrl(file: File): string {
  return URL.createObjectURL(file)
}

function fileToImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e) }
    img.src = url
  })
}

// —— 初始化 / 加载解析 ——
let lastFpsTick = performance.now()

function createPlayer(canvas: HTMLCanvasElement, cfg: ReturnType<typeof playerConfig>): Player {
  const p = new Player(canvas, cfg)
  p.onReady((m?: MovieData) => {
    const w = m?.params?.viewBoxWidth ?? 0
    const h = m?.params?.viewBoxHeight ?? 0
    const frames = m?.params?.frames ?? 0
    const fpsVal = m?.params?.fps ?? 0
    totalFrames.value = frames
    log(`动画就绪：viewBox ${w}×${h} · ${frames} 帧 · ${fpsVal}fps`, 'ok')
    spriteKeys.value = collectKeys(m)
    if (spriteKeys.value.length && !spriteKeys.value.includes(dynKey.value)) dynKey.value = spriteKeys.value[0]
    if (!framesInit && frames > 0) {
      framesInit = true
      endFrameSelect.value = Math.floor(frames / 2)
      if (playRange.value === 'range' && rangeEnd.value === 0) rangeEnd.value = frames - 1
    }
  })
  p.onStart(() => { isPlaying.value = true })
  p.onPause(() => { isPlaying.value = false })
  p.onStop(() => {
    isPlaying.value = false
    if (endMode.value === 'frame') {
      const target = endFrameSelect.value
      // 延后到 finishLoop 末帧绘制之后，再定位到指定帧
      setTimeout(() => { p.stepToFrame(target) }, 0)
      log(`播放结束，显示指定帧 #${target}`, 'info')
    }
  })
  p.onLoopEnd(() => { loopCount.value++ })
  p.onProcess(() => {
    const now = performance.now()
    if (now - lastFpsTick > 500) {
      fps.value = Math.max(1, Math.round(1000 / (now - lastFpsTick)))
      lastFpsTick = now
    }
    frame.value++
  })
  p.onPoster((info) => log(`海报事件：${info.state === 'show' ? '展示' : '隐藏'} · 来源 ${info.source}${info.url ? ` · ${info.url}` : ''}`, 'info'))
  p.onError((e: any) => log(`渲染异常：${e?.message ?? e}`, 'err'))
  return p
}

function init() {
  player?.destroy()
  player = null
  spriteKeys.value = []
  dynKey.value = ''
  frame.value = loopCount.value = fps.value = 0
  isPlaying.value = false

  if (!mainCanvas.value) { log('未找到画布节点', 'err'); return }

  const posterFileObj = posterFile.value
  const cfg = playerConfig()
  if (posterAsDefault.value) {
    const poster = posterFileObj ? fileToImageUrl(posterFileObj) : posterUrl.value.trim()
    if (poster) cfg.defaultPoster = poster
  }
  player = createPlayer(mainCanvas.value, cfg)
  log(`已初始化（loop=${cfg.loop === 0 ? '无限' : '1次'} · 范围=${playRange.value === 'range' ? `[${cfg.startFrame},${cfg.endFrame}]` : '全部'}${playToFrameEnabled.value ? ` · 至帧${cfg.endFrame}` : ''} · 结束后=${endMode.value === 'frame' ? `指定帧#${endFrameSelect.value}` : endMode.value} · 方向=${cfg.direction === 'backward' ? '逆向' : '正向'} · 缩放=${cfg.scaleMode}${posterAsDefault.value ? ' · 默认海报' : ''}），请点击「加载/解析」`, 'ok')
}

async function loadAndParse() {
  if (!player) { log('请先点击「初始化」', 'warn'); return }
  const raw = urlInput.value.trim()
  const file = mainFile.value
  if (!file && !raw) { log('请输入资源地址或选择/拖入文件', 'warn'); return }
  busy.value = true
  try {
    const movie = file ? await Parser.loadFile(file) : await Parser.loadUrl(raw)
    /** autoPlay 由 Player 配置驱动：setVideoItem 装载完成后内部自动播放 */
    await player.setVideoItem(movie)
    log(`已加载（${file ? '文件' : 'URL'}）${autoPlay.value ? '并自动播放' : '，未自动播放，请点击「播放」'}`, 'ok')
  } catch (e: any) {
    log(`加载失败：${e?.message ?? e}`, 'err')
  } finally {
    busy.value = false
  }
}

function togglePlay() {
  if (!player) { log('尚未加载动画', 'warn'); return }
  if (isPlaying.value) player.pause()
  else player.play(playerConfig())
}

function toggleSkipRender() {
  if (!player) { log('尚未加载动画', 'warn'); return }
  skipRenderOn.value = !!player.skipRender()
  log(skipRenderOn.value ? '已开启跳过渲染（帧时间轴仍推进）' : '已恢复渲染', skipRenderOn.value ? 'warn' : 'ok')
}

function stop() {
  if (!player) return
  player.stop()
  isPlaying.value = false
  const m = endMode.value === 'clear' ? '已清空画布'
    : endMode.value === 'backwards' ? '已停在首帧'
    : endMode.value === 'frame' ? `已定位到指定帧 #${endFrameSelect.value}` : '已停在末帧'
  log(`已停止（${m}）`)
}

function jump() {
  if (!player) return
  player.stepToPercentage(0.5, true)
  log('已跳转到 50% 进度并继续播放')
}

function destroy() {
  player?.destroy()
  player = null
  isPlaying.value = false
  frame.value = loopCount.value = fps.value = 0
  spriteKeys.value = []
  dynKey.value = ''
  log('已销毁播放器，可再次「初始化」', 'warn')
}

// —— 动态替换 / 海报 ——
async function applyToPlayer(fn: (p: Player) => void | Promise<void>, msg: string) {
  if (!player) { log('尚未加载动画', 'warn'); return }
  await fn(player)
  log(msg, 'ok')
}

function applyText() {
  if (!dynKey.value) { log('请先加载动画并选择图层 key', 'warn'); return }
  const cfg: DynamicText = {
    text: textInput.value,
    size: textSize.value || '18px',
    color: textColor.value || '#ffffff',
    family: textFamily.value,
  }
  applyToPlayer(p => p.setText(cfg, dynKey.value), `注入文本 → ${dynKey.value}：「${textInput.value}」`)
}

async function applyImage() {
  if (!dynKey.value) { log('请先加载动画并选择图层 key', 'warn'); return }
  const file = imageFile.value
  try {
    if (file) {
      const img = await fileToImage(file)
      await applyToPlayer(p => p.setImage(img, dynKey.value), `替换图片 → ${dynKey.value}（文件 ${file.name}）`)
    } else {
      const url = imageUrl.value.trim()
      if (!url) { log('请填写图片地址或选择/拖入图片文件', 'warn'); return }
      await applyToPlayer(p => p.setImage(url, dynKey.value), `替换图片 → ${dynKey.value}`)
    }
  } catch (e: any) {
    log(`图片加载失败：${e?.message ?? e}`, 'err')
  }
}

async function renderPoster() {
  const file = posterFile.value
  try {
    if (file) {
      await applyToPlayer(p => p.renderPoster(fileToImageUrl(file)), `渲染外部海报（文件 ${file.name}）`)
    } else {
      const url = posterUrl.value.trim()
      if (!url) { log('请填写海报地址或选择/拖入海报文件', 'warn'); return }
      await applyToPlayer(p => p.renderPoster(url), '渲染外部海报')
    }
  } catch (e: any) {
    log(`海报渲染失败：${e?.message ?? e}`, 'err')
  }
}

function clearDynamic() {
  applyToPlayer(p => p.clearDynamic(), '已清空全部动态替换')
}

onBeforeUnmount(() => {
  player?.destroy()
})
</script>

<template>
  <main class="layout">
    <header class="toolbar">
      <h1>custom-svga · {{ demoInfo.name }} 产物回归测试</h1>
      <p class="sub">入口：<code>dist/{{ demoInfo.entry }}</code> · 同构内联 Worker 解析（真实 Worker / 主线程 MockWorker 自动降级）</p>
    </header>

    <!-- 播放区域：可拖拽主资源 -->
    <section class="stage-pane"
      :class="{ dragging: dragTarget === 'main' }"
      @dragover.prevent="dragTarget = 'main'"
      @dragleave.prevent="dragTarget = null"
      @drop.prevent="onDrop('main', $event)"
    >
      <div class="pane-head">
        <span class="dot" />
        <b>主线程 Canvas 渲染</b>
        <span class="src-label">{{ mainSourceLabel }}</span>
      </div>
      <div class="stage-host"><canvas ref="mainCanvas" class="stage" /></div>
      <div v-if="dragTarget === 'main'" class="drop-hint">松开以加载 SVGA 文件</div>
    </section>

    <!-- 资源 -->
    <section class="panel">
      <div class="form-grid">
        <div class="field asset-field">
          <AssetPicker
            v-model="urlInput"
            label="资源地址"
            placeholder="SVGA 资源 URL，可直接输入外链"
            @update:model-value="onAssetChange"
          />
        </div>
      </div>
      <div class="panel-actions">
        <button class="btn" :disabled="busy" @click="fileInputMain?.click()">选择文件</button>
        <input ref="fileInputMain" type="file" hidden accept=".svga" @change="onFilePicked('main', $event)" />
        <span class="hint">或将 .svga 文件拖入上方播放区域</span>
      </div>
    </section>

    <!-- 场景预设 -->
    <section class="panel">
      <div class="form-grid">
        <label class="field">
          <span>场景预设（回归覆盖）</span>
          <select v-model="scenarioSel" @change="applyScenario">
            <option v-for="s in scenarios" :key="s.value" :value="s.value">{{ s.name }}</option>
          </select>
        </label>
      </div>
      <div class="panel-actions">
        <button class="btn" @click="applyScenario">应用场景</button>
        <span v-if="scenarioDesc" class="hint">{{ scenarioDesc }}</span>
      </div>
    </section>

    <!-- 播放配置 -->
    <section class="panel">
      <div class="form-grid">
        <label class="check"><input v-model="autoPlay" type="checkbox" /><span>自动播放</span></label>
        <label class="check"><input v-model="loopEnabled" type="checkbox" /><span>循环播放</span></label>
        <label class="field">
          <span>播放范围</span>
          <select v-model="playRange">
            <option value="all">全部播放</option>
            <option value="range">指定区间</option>
          </select>
        </label>
        <template v-if="playRange === 'range'">
          <label class="field"><span>起始帧</span><input v-model.number="rangeStart" type="number" min="0" /></label>
          <label class="field"><span>结束帧</span><input v-model.number="rangeEnd" type="number" min="0" /></label>
        </template>
        <label class="check"><input v-model="playToFrameEnabled" type="checkbox" /><span>播放至指定帧</span></label>
        <label v-if="playToFrameEnabled" class="field"><span>目标帧</span><input v-model.number="playToFrame" type="number" min="0" /></label>
        <label class="field">
          <span>结束后</span>
          <select v-model="endMode">
            <option value="forwards">显示最后一帧</option>
            <option value="backwards">显示第一帧</option>
            <option value="clear">清空</option>
            <option value="frame">显示指定帧</option>
          </select>
        </label>
        <label v-if="endMode === 'frame'" class="field">
          <span>指定帧（共 {{ totalFrames || '?' }} 帧）</span>
          <select v-model.number="endFrameSelect">
            <option v-for="f in frameOptions" :key="f" :value="f">#{{ f }}</option>
          </select>
        </label>
        <label class="field">
          <span>播放方向</span>
          <select v-model="direction">
            <option value="forward">正向</option>
            <option value="backward">逆向</option>
          </select>
        </label>
        <label class="field">
          <span>缩放适配</span>
          <select v-model="scaleMode">
            <option :value="SCALE_MODE.ASPECT_FIT">AspectFit（contain）</option>
            <option :value="SCALE_MODE.ASPECT_FILL">AspectFill（cover）</option>
            <option :value="SCALE_MODE.FILL">Fill（拉伸）</option>
          </select>
        </label>
      </div>
    </section>

    <!-- 操作 -->
    <section class="panel">
      <div class="panel-actions">
        <button class="btn primary" :disabled="busy" @click="init">初始化</button>
        <button class="btn" :disabled="busy || !player" @click="loadAndParse">加载/解析</button>
        <button class="btn" @click="togglePlay">播放 / 暂停</button>
        <button class="btn" :class="{ active: skipRenderOn }" @click="toggleSkipRender">跳过渲染</button>
        <button class="btn" @click="stop">停止</button>
        <button class="btn" @click="jump">跳 50%</button>
        <button class="btn danger" :disabled="busy" @click="destroy">销毁</button>
      </div>
      <div class="monitor">
        <span>状态：<b :style="{ color: statusColor }">{{ status }}</b></span>
        <span>帧：<b>{{ frame }}</b> · 循环：<b>{{ loopCount }}</b> · FPS：<b>{{ fps }}</b></span>
      </div>
    </section>

    <!-- 动态替换 / 海报 -->
    <section class="panel dyn">
      <div class="dyn-row">
        <label class="field key-field">
          <span>图层 Key</span>
          <select v-model="dynKey">
            <option value="" disabled>加载后自动枚举图层 Key</option>
            <option v-for="k in spriteKeys" :key="k" :value="k">{{ k }}</option>
          </select>
        </label>
        <label class="field text-field"><span>动态文本</span><input v-model="textInput" type="text" placeholder="注入文本内容" /></label>
        <label class="field"><span>字号</span><input v-model="textSize" type="text" placeholder="18px" /></label>
        <label class="field"><span>颜色</span><input v-model="textColor" type="text" placeholder="#ffffff" /></label>
        <button class="btn" @click="applyText">注入文本</button>
      </div>

      <div class="dyn-row source-row"
        :class="{ dragging: dragTarget === 'image' }"
        @dragover.prevent="dragTarget = 'image'"
        @dragleave.prevent="dragTarget = null"
        @drop.prevent="onDrop('image', $event)"
      >
        <span class="row-title">动态图片</span>
        <label class="field grow"><span>图片地址</span><input v-model="imageUrl" type="text" placeholder="https://example.com/face.png" /></label>
        <span class="file-box">
          <span class="src-label">{{ imageSourceLabel }}</span>
          <button class="btn" @click="fileInputImage?.click()">选择文件</button>
        </span>
        <input ref="fileInputImage" type="file" hidden accept="image/*" @change="onFilePicked('image', $event)" />
        <button class="btn" @click="applyImage">替换图片</button>
        <button class="btn" @click="clearDynamic">清空动态</button>
      </div>

      <div class="dyn-row source-row"
        :class="{ dragging: dragTarget === 'poster' }"
        @dragover.prevent="dragTarget = 'poster'"
        @dragleave.prevent="dragTarget = null"
        @drop.prevent="onDrop('poster', $event)"
      >
        <span class="row-title">海报</span>
        <label class="field grow"><span>海报地址</span><input v-model="posterUrl" type="text" placeholder="https://example.com/poster.png" /></label>
        <span class="file-box">
          <span class="src-label">{{ posterSourceLabel }}</span>
          <button class="btn" @click="fileInputPoster?.click()">选择文件</button>
        </span>
        <input ref="fileInputPoster" type="file" hidden accept="image/*" @change="onFilePicked('poster', $event)" />
        <button class="btn" @click="renderPoster">渲染海报</button>
        <label class="check"><input v-model="posterAsDefault" type="checkbox" /><span>作为 defaultPoster</span></label>
      </div>
    </section>

    <section class="console">
      <template v-for="(l, i) in logs" :key="i"><div class="line">{{ l }}</div></template>
      <div v-if="!logs.length" class="line muted">暂无日志…</div>
    </section>
  </main>
</template>

<style scoped lang="scss">
.layout {
  max-width: 1020px;
  margin: 0 auto;
  padding: 24px 20px 48px;
}

.toolbar {
  h1 { font-size: 22px; margin: 0 0 6px; }
  .sub { margin: 0; color: var(--muted); font-size: 13px; }
  code { background: var(--panel-2); padding: 1px 6px; border-radius: 4px; font-size: 12px; color: var(--accent); }
}

/* ---------- 播放区域 ---------- */
.stage-pane {
  margin-top: 18px;
  background: var(--panel);
  border: 1px dashed #343b4d;
  border-radius: 10px;
  padding: 10px;
  height: 340px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition: border-color 0.2s, background 0.2s;
  &.dragging { border-color: var(--accent); background: rgba(59, 108, 240, 0.08); }
  .pane-head { display: flex; align-items: center; gap: 8px; font-size: 13px; }
  .dot { width: 10px; height: 10px; border-radius: 50%; background: var(--accent); }
  .src-label { color: var(--muted); font-size: 12px; margin-left: auto; max-width: 60%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .stage-host { position: relative; flex: 1; min-height: 0; width: 100%; background: #000; border-radius: 6px; overflow: hidden; }
  .stage { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
  .drop-hint {
    position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
    font-size: 14px; color: #fff; background: rgba(59, 108, 240, 0.25); border-radius: 10px;
    pointer-events: none; z-index: 2;
  }
}

/* ---------- 统一面板（表单栅格在上，操作区在下） ---------- */
.panel {
  margin-top: 12px;
  background: var(--panel);
  border: 1px solid #242b3d;
  border-radius: 10px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px 14px;
  align-items: end;
  width: 100%;
}

/* 素材选择器自带下拉 + 输入框 + 说明，独占一整行 */
.asset-field {
  grid-column: 1 / -1;
}

.panel-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  width: 100%;
}

/* ---------- 表单控件 ---------- */
.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: var(--muted);
  flex: 1 1 180px;
  min-width: 120px;
  &.grow { flex: 2 1 360px; }
  input, select {
    background: var(--panel-2);
    border: 1px solid #2c3345;
    border-radius: 6px;
    color: var(--text);
    padding: 8px 10px;
    font-size: 13px;
    width: 100%;
    &:focus { outline: none; border-color: var(--accent); }
  }
}

.check {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  cursor: pointer;
  padding: 9px 0;
  input { width: auto; }
}

/* ---------- 按钮 ---------- */
.btn {
  background: var(--panel-2);
  border: 1px solid #2c3345;
  color: var(--text);
  border-radius: 6px;
  padding: 8px 14px;
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
  &:hover { border-color: var(--accent); }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
  &.primary { background: var(--accent); border-color: var(--accent); color: #fff; font-weight: 600; }
  &.danger { color: #ffb4b4; border-color: #6b2b2b; &:hover { border-color: #ff8a8a; } }
  &.active { border-color: var(--accent); color: var(--accent); font-weight: 600; }
}

/* ---------- 辅助信息 ---------- */
.hint { font-size: 12px; color: var(--muted); line-height: 1.5; }
.src-label { font-size: 12px; color: var(--accent); max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.monitor {
  width: 100%;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
  color: var(--muted);
  flex-wrap: wrap;
  border-top: 1px solid #242b3d;
  padding-top: 10px;
}

/* ---------- 动态替换 ---------- */
.dyn .dyn-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: flex-end;
  .key-field { flex: 0 1 220px; }
  .text-field { flex: 2 1 260px; }
  .row-title { font-size: 13px; font-weight: 600; }
}
.dyn .source-row {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr) auto auto auto;
  gap: 10px;
  align-items: end;
  border: 1px dashed transparent;
  border-radius: 8px;
  padding: 10px;
  margin: -10px -8px;
  transition: border-color 0.2s, background 0.2s;
  &.dragging { border-color: var(--accent); background: rgba(59, 108, 240, 0.08); }
  .row-title { align-self: end; }
  .file-box {
    display: flex;
    flex-direction: column;
    gap: 4px;
    .src-label {
      font-size: 12px;
      color: var(--accent);
      max-width: 200px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
}

/* ---------- 控制台 ---------- */
.console {
  margin-top: 16px;
  background: #0b0e14;
  border: 1px solid #1e2432;
  border-radius: 10px;
  padding: 10px 12px;
  max-height: 220px;
  overflow: auto;
  font-size: 12px;
  line-height: 1.7;
  font-family: Consolas, Menlo, monospace;
  .line { color: var(--text); }
  .muted { color: var(--muted); }
}
</style>
