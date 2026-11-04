<script setup lang="ts">
import { ref, reactive, computed, nextTick, onBeforeUnmount } from 'vue'
import { Player, Parser, demoInfo } from './svga'
import type { MovieData, DynamicText } from './svga'

/**
 * 多实例同时播放测试页：同一页面创建 N 个 Player 实例同时播放，
 * 每个实例可独立选择动效源（URL/文件）、注入动态文本/图片/海报/兜底静态图，
 * 并单独执行播放/暂停/停止/销毁。
 * 用于验证多实例同时播放下各实例独立 RAF 的帧率/循环统计，
 * 以及各实例独立 Path2D 缓存（RendererCore 方案1）在多实例场景下的表现。
 */

/** 默认素材用相对路径：dev 下解析为 /svga/... 走 vite 代理，静态部署（GitHub Pages）下走 public 同源文件 */
const DEFAULT_URL = 'svga/newGuild/a-3-badge.svga'

/** 单实例运行时状态（player 不放响应式对象里，避免 Vue unwrap 类型干扰，单独用 Map 存储） */
interface Item {
  id: number
  url: string
  file: File | null
  canvas: HTMLCanvasElement | null
  status: string
  statusColor: string
  frame: number
  loop: number
  fps: number
  ready: boolean
  keys: string[]
  dynKey: string
  text: string
  textSize: string
  textColor: string
  textFamily: string
  imageFile: File | null
  imageUrl: string
  posterFile: File | null
  posterUrl: string
  defaultPosterUrl: string
  skipRenderOn: boolean
  folded: boolean
}

const urlMode = ref<'shared' | 'separate'>('shared')
const sharedUrl = ref(DEFAULT_URL)
const createCount = ref(4)
const items = ref<Item[]>([])
/** 非响应式 Player 实例表：key 为实例 id */
const players = new Map<number, Player>()
let nextId = 1
/** 全部操作面板是否折叠（折叠后仅保留画布与播放统计） */
const allFolded = ref(false)

const logs = ref<string[]>([])

function log(msg: string, level: 'info' | 'ok' | 'warn' | 'err' = 'info') {
  const t = new Date().toLocaleTimeString()
  logs.value.unshift(`[${t}] ${msg}`)
  if (logs.value.length > 200) logs.value.length = 200
}

const hasPlayers = computed(() => items.value.length > 0)
const hasLoaded = computed(() => items.value.some(i => i.ready))

/** 收集 v-for 渲染的 canvas 节点到对应实例 */
function setCanvas(item: Item, el: unknown) {
  item.canvas = el as HTMLCanvasElement | null
}

function makeItem(url: string): Item {
  const raw: Item = {
    id: nextId++,
    url,
    file: null,
    canvas: null,
    status: '待创建',
    statusColor: 'var(--muted)',
    frame: 0,
    loop: 0,
    fps: 0,
    ready: false,
    keys: [],
    dynKey: '',
    text: '动态文本',
    textSize: '18px',
    textColor: '#ffffff',
    textFamily: 'sans-serif',
    imageFile: null,
    imageUrl: '',
    posterFile: null,
    posterUrl: '',
    defaultPosterUrl: '',
    skipRenderOn: false,
    folded: false,
  }
  return reactive(raw) as Item
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

/** 处理每实例的文件选择：动效文件 / 图片 / 海报 */
function onFilePicked(item: Item, kind: 'svga' | 'image' | 'poster', e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (kind === 'svga') {
    item.file = file
    log(`实例 #${item.id} 已选择动效文件：${file.name}`, 'ok')
  } else if (kind === 'image') {
    item.imageFile = file
    item.imageUrl = fileToImageUrl(file)
    log(`实例 #${item.id} 已选择图片：${file.name}`, 'ok')
  } else {
    item.posterFile = file
    item.posterUrl = fileToImageUrl(file)
    log(`实例 #${item.id} 已选择海报：${file.name}`, 'ok')
  }
}

/** 绑定单实例事件：帧/循环计数、FPS 统计、状态流转、图层 Key 枚举 */
function bindEvents(item: Item, p: Player) {
  let lastTick = performance.now()
  p.onReady((m?: MovieData) => {
    const keys: string[] = []
    for (const s of m?.sprites ?? []) {
      const k = (s as any)?.imageKey
      if (k && !keys.includes(k)) keys.push(k)
    }
    item.keys = keys
    if (keys.length && !item.dynKey) item.dynKey = keys[0]
    item.ready = true
    item.status = '就绪'
    item.statusColor = 'var(--ok)'
  })
  p.onStart(() => { item.status = '播放中'; item.statusColor = 'var(--ok)' })
  p.onPause(() => { item.status = '已暂停'; item.statusColor = 'var(--warn)' })
  p.onStop(() => { item.status = '已停止'; item.statusColor = 'var(--warn)' })
  p.onLoopEnd(() => { item.loop++ })
  p.onProcess(() => {
    item.frame++
    const now = performance.now()
    if (now - lastTick > 500) {
      item.fps = Math.max(1, Math.round(1000 / (now - lastTick)))
      lastTick = now
    }
  })
  p.onError((e: any) => {
    item.status = `异常：${e?.message ?? e}`
    item.statusColor = 'var(--err)'
  })
}

/** 为单个实例创建 Player 并绑定事件 */
function bindPlayer(item: Item) {
  if (!item.canvas) { item.status = '画布未就绪'; item.statusColor = 'var(--err)'; return }
  const p = new Player(item.canvas, { loop: 0, fillMode: 'forwards' })
  players.set(item.id, p)
  bindEvents(item, p)
  item.status = '待加载'
}

/** 创建 N 个实例（先渲染 canvas，再统一绑定 Player） */
async function createBatch() {
  destroyAll()
  const n = createCount.value
  for (let i = 0; i < n; i++) {
    items.value.push(makeItem(urlMode.value === 'shared' ? '' : DEFAULT_URL))
  }
  await nextTick()
  items.value.forEach(bindPlayer)
  log(`已创建 ${n} 个实例，可逐实例加载动效（URL/选择文件）`, 'ok')
}

/** 追加单个实例 */
function addOne() {
  const item = makeItem(urlMode.value === 'shared' ? '' : DEFAULT_URL)
  items.value.push(item)
  nextTick(() => bindPlayer(item))
  log(`已追加实例 #${item.id}，请在卡片内加载动效`)
}

/** 解析单实例动效源：优先本地文件，其次统一 URL 或实例自己的 URL */
async function loadOne(item: Item) {
  const p = players.get(item.id)
  if (!p) { log('实例 #' + item.id + ' 尚未创建', 'warn'); return }
  item.status = '加载中…'
  item.statusColor = 'var(--warn)'
  try {
    const movie = item.file
      ? await Parser.loadFile(item.file)
      : await Parser.loadUrl(urlMode.value === 'shared' ? sharedUrl.value.trim() : item.url.trim())
    await p.setVideoItem(movie)
    item.status = '已加载'
    item.statusColor = 'var(--ok)'
    log(`实例 #${item.id} 加载完成：${item.file ? item.file.name : urlMode.value === 'shared' ? sharedUrl.value : item.url}`, 'ok')
  } catch (e: any) {
    item.status = `加载失败：${e?.message ?? e}`
    item.statusColor = 'var(--err)'
    log(`实例 #${item.id} 加载失败：${e?.message ?? e}`, 'err')
  }
}

/** 加载全部：统一 URL 模式只解析一次、共享 MovieData；有文件的实例优先用本地文件 */
async function loadAll() {
  const targets = items.value.filter(i => players.has(i.id))
  if (!targets.length) { log('请先创建实例', 'warn'); return }

  let sharedMovie: MovieData | null = null
  const shared = urlMode.value === 'shared'
  if (shared) {
    const url = sharedUrl.value.trim()
    if (!url) { log('请填写统一资源地址', 'warn'); return }
    sharedMovie = await Parser.loadUrl(url)
  }

  let ok = 0
  for (const it of targets) {
    it.status = '加载中…'
    it.statusColor = 'var(--warn)'
    try {
      const movie = it.file
        ? await Parser.loadFile(it.file)
        : shared && sharedMovie
          ? sharedMovie
          : await Parser.loadUrl(it.url.trim())
      await players.get(it.id)!.setVideoItem(movie)
      it.status = '已加载'
      it.statusColor = 'var(--ok)'
      ok++
    } catch (e: any) {
      it.status = `加载失败：${e?.message ?? e}`
      it.statusColor = 'var(--err)'
    }
  }
  log(`加载完成 ${ok}/${targets.length}`, ok === targets.length ? 'ok' : 'warn')
}

/** 单独控制：播放 / 暂停 / 停止 / 销毁 */
function playOne(item: Item) {
  const p = players.get(item.id)
  if (!p) { log(`实例 #${item.id} 尚未创建`, 'warn'); return }
  if (!item.ready) { log(`实例 #${item.id} 尚未加载动效`, 'warn'); return }
  p.play({ loop: 0, fillMode: 'forwards' })
}

function pauseOne(item: Item) {
  players.get(item.id)?.pause()
}

function stopOne(item: Item) {
  players.get(item.id)?.stop()
}

function destroyOne(item: Item) {
  const p = players.get(item.id)
  p?.destroy()
  players.delete(item.id)
  const idx = items.value.indexOf(item)
  if (idx >= 0) items.value.splice(idx, 1)
  log(`已销毁实例 #${item.id}`, 'warn')
}

function playAll() {
  const n = players.size
  players.forEach(p => p.play({ loop: 0, fillMode: 'forwards' }))
  log(`已全部播放（${n} 个实例，各实例独立 RAF 循环）`, 'ok')
}

function pauseAll() {
  players.forEach(p => p.pause())
  log('已全部暂停')
}

function stopAll() {
  players.forEach(p => p.stop())
  log('已全部停止')
}

function destroyAll() {
  players.forEach(p => p.destroy())
  players.clear()
  items.value = []
  nextId = 1
  log('已销毁全部实例，可重新创建')
}

/** 单实例跳过渲染切换（帧时间轴仍推进，仅跳过绘制） */
function toggleSkipRenderOne(item: Item) {
  const p = players.get(item.id)
  if (!p) return
  item.skipRenderOn = !!p.skipRender()
  log(`实例 #${item.id} ${item.skipRenderOn ? '已开启跳过渲染' : '已恢复渲染'}`, item.skipRenderOn ? 'warn' : 'ok')
}

/** 全部跳过渲染切换 */
function toggleSkipRenderAll() {
  players.forEach(p => p.skipRender())
  items.value.forEach(i => { i.skipRenderOn = !!players.get(i.id)?.skipRender() })
  const on = items.value.every(i => i.skipRenderOn)
  log(on ? '已全部开启跳过渲染（帧时间轴仍推进）' : '已全部恢复渲染', on ? 'warn' : 'ok')
}

/** 单实例操作面板折叠/展开切换 */
function toggleFoldOne(item: Item) {
  item.folded = !item.folded
}

/** 全部操作面板折叠/展开切换 */
function toggleFoldAll() {
  allFolded.value = !allFolded.value
  items.value.forEach(i => { i.folded = allFolded.value })
  log(allFolded.value ? '已折叠全部操作面板' : '已展开全部操作面板')
}

/** 动态替换：注入文本 / 替换图片 / 渲染海报 / 设置兜底静态图 / 清空动态 */
function applyText(item: Item) {
  const p = players.get(item.id)
  if (!p) return
  if (!item.dynKey) { log(`实例 #${item.id} 请先加载动效并选择图层 Key`, 'warn'); return }
  const cfg: DynamicText = {
    text: item.text,
    size: item.textSize || '18px',
    color: item.textColor || '#ffffff',
    family: item.textFamily,
  }
  p.setText(cfg, item.dynKey)
  log(`实例 #${item.id} 注入文本 → ${item.dynKey}：「${item.text}」`, 'ok')
}

async function applyImage(item: Item) {
  const p = players.get(item.id)
  if (!p) return
  if (!item.dynKey) { log(`实例 #${item.id} 请先加载动效并选择图层 Key`, 'warn'); return }
  try {
    if (item.imageFile) {
      const img = await fileToImage(item.imageFile)
      await p.setImage(img, item.dynKey)
      log(`实例 #${item.id} 替换图片 → ${item.dynKey}（文件 ${item.imageFile.name}）`, 'ok')
    } else {
      const url = item.imageUrl.trim()
      if (!url) { log(`实例 #${item.id} 请选择图片文件或填写图片地址`, 'warn'); return }
      await p.setImage(url, item.dynKey)
      log(`实例 #${item.id} 替换图片 → ${item.dynKey}`, 'ok')
    }
  } catch (e: any) {
    log(`实例 #${item.id} 图片替换失败:${e?.message ?? e}`, 'err')
  }
}

async function applyPoster(item: Item) {
  const p = players.get(item.id)
  if (!p) return
  if (item.posterFile) {
    await p.renderPoster(fileToImageUrl(item.posterFile))
    log(`实例 #${item.id} 已渲染海报（文件 ${item.posterFile.name}）`, 'ok')
  } else {
    const url = item.posterUrl.trim()
    if (!url) { log(`实例 #${item.id} 请选择海报文件或填写海报地址`, 'warn'); return }
    await p.renderPoster(url)
    log(`实例 #${item.id} 已渲染海报`, 'ok')
  }
}

function applyDefaultPoster(item: Item) {
  const p = players.get(item.id)
  if (!p) return
  if (!item.defaultPosterUrl.trim()) { log(`实例 #${item.id} 请填写兜底静态图地址`, 'warn'); return }
  p.play({ defaultPoster: item.defaultPosterUrl.trim() })
  log(`实例 #${item.id} 已设置兜底静态图（加载失败/清空时显示）`, 'ok')
}

function clearDyn(item: Item) {
  const p = players.get(item.id)
  if (!p) return
  p.clearDynamic()
  log(`实例 #${item.id} 已清空全部动态替换`, 'warn')
}

onBeforeUnmount(() => {
  players.forEach(p => p.destroy())
  players.clear()
})
</script>

<template>
  <main class="layout">
    <header class="toolbar">
      <h1>多实例同时播放 · {{ demoInfo.name }}</h1>
      <p class="sub">每个实例可独立选择动效（URL/文件）、注入动态文本/图片/海报/兜底静态图，并单独播放/暂停/停止/销毁</p>
    </header>

    <!-- 批量配置 -->
    <section class="panel">
      <div class="form-grid">
        <label class="field">
          <span>批量 URL 模式</span>
          <select v-model="urlMode">
            <option value="shared">统一 URL（共享一次解析）</option>
            <option value="separate">独立 URL（每实例各自解析）</option>
          </select>
        </label>
        <label v-if="urlMode === 'shared'" class="field grow">
          <span>统一资源地址</span>
          <input v-model="sharedUrl" type="text" placeholder="SVGA URL" />
        </label>
        <label class="field">
          <span>初始实例数</span>
          <select v-model.number="createCount">
            <option v-for="n in [1, 2, 4, 8, 12, 16, 24, 32]" :key="n" :value="n">{{ n }}</option>
          </select>
        </label>
      </div>
      <div class="panel-actions">
        <button class="btn primary" @click="createBatch">创建 {{ createCount }} 个实例</button>
        <button class="btn" @click="addOne">添加一个实例</button>
        <button class="btn" :disabled="!hasPlayers" @click="loadAll">批量加载</button>
        <button class="btn" :disabled="!hasLoaded" @click="playAll">全部播放</button>
        <button class="btn" :disabled="!hasPlayers" @click="pauseAll">全部暂停</button>
        <button class="btn" :disabled="!hasPlayers" @click="stopAll">全部停止</button>
        <button class="btn" :disabled="!hasPlayers" @click="toggleSkipRenderAll">全部跳过渲染</button>
        <button class="btn" :disabled="!hasPlayers" @click="toggleFoldAll">{{ allFolded ? '全部展开面板' : '全部折叠面板' }}</button>
        <button class="btn danger" @click="destroyAll">销毁全部</button>
      </div>
    </section>

    <!-- 实例卡片 -->
    <section v-if="items.length" class="grid">
      <div v-for="item in items" :key="item.id" class="cell">
        <div class="cell-head">
          <b>#{{ item.id }}</b>
          <span class="status" :style="{ color: item.statusColor }">{{ item.status }}</span>
          <button class="btn mini fold-btn" @click="toggleFoldOne(item)">{{ item.folded ? '展开' : '折叠' }}</button>
        </div>
        <div class="stage-host">
          <canvas :ref="(el) => setCanvas(item, el)" class="stage" />
        </div>

        <div v-show="!item.folded" class="ops">
          <!-- 动效源 -->
          <div class="row">
            <input v-model="item.url" :disabled="urlMode === 'shared'" type="text" class="input" placeholder="SVGA URL（统一模式自动取批量地址）" />
            <label class="btn mini">选文件<input type="file" hidden accept=".svga" @change="onFilePicked(item, 'svga', $event)" /></label>
          </div>

          <!-- 独立控制 -->
          <div class="row">
            <button class="btn primary mini" @click="loadOne(item)">加载</button>
            <button class="btn mini" @click="playOne(item)">播放</button>
            <button class="btn mini" @click="pauseOne(item)">暂停</button>
            <button class="btn mini" @click="stopOne(item)">停止</button>
            <button class="btn mini" :class="{ active: item.skipRenderOn }" @click="toggleSkipRenderOne(item)">跳过渲染</button>
            <button class="btn mini danger" @click="destroyOne(item)">销毁</button>
          </div>

          <!-- 动态文本 -->
          <div class="row">
            <select v-model="item.dynKey" class="input key-sel">
              <option value="" disabled>图层 Key（加载后自动枚举）</option>
              <option v-for="k in item.keys" :key="k" :value="k">{{ k }}</option>
            </select>
            <input v-model="item.text" type="text" class="input" placeholder="动态文本" />
          </div>
          <div class="row">
            <input v-model="item.textSize" type="text" class="input mini-input" placeholder="字号 18px" />
            <input v-model="item.textColor" type="text" class="input mini-input" placeholder="#ffffff" />
            <input v-model="item.textFamily" type="text" class="input mini-input" placeholder="sans-serif" />
            <button class="btn mini" @click="applyText(item)">注入</button>
          </div>

          <!-- 动态图片 -->
          <div class="row">
            <input v-model="item.imageUrl" type="text" class="input" placeholder="动态图片地址/已选文件" />
            <label class="btn mini">图片<input type="file" hidden accept="image/*" @change="onFilePicked(item, 'image', $event)" /></label>
            <button class="btn mini" @click="applyImage(item)">替换</button>
          </div>

          <!-- 海报 -->
          <div class="row">
            <input v-model="item.posterUrl" type="text" class="input" placeholder="海报地址/已选文件" />
            <label class="btn mini">海报<input type="file" hidden accept="image/*" @change="onFilePicked(item, 'poster', $event)" /></label>
            <button class="btn mini" @click="applyPoster(item)">渲染</button>
          </div>

          <!-- 兜底静态图 -->
          <div class="row">
            <input v-model="item.defaultPosterUrl" type="text" class="input" placeholder="兜底静态图 URL（播放失败/清空显示）" />
            <button class="btn mini" @click="applyDefaultPoster(item)">设兜底</button>
            <button class="btn mini" @click="clearDyn(item)">清动态</button>
          </div>
        </div>

        <div class="meta">帧 {{ item.frame }} · 循环 {{ item.loop }} · {{ item.fps }}fps<span v-if="item.skipRenderOn" class="skip-flag">· 跳过渲染中</span></div>
      </div>
    </section>
    <section v-else class="empty">
      <p>尚未创建实例。可在顶部批量创建，之后每个实例卡片内独立选择动效文件/URL 并单独控制播放。</p>
    </section>

    <section class="console">
      <template v-for="(l, i) in logs" :key="i"><div class="line">{{ l }}</div></template>
      <div v-if="!logs.length" class="line muted">暂无日志…</div>
    </section>
  </main>
</template>

<style scoped lang="scss">
.layout {
  max-width: 1120px;
  margin: 0 auto;
  padding: 24px 20px 48px;
}

.toolbar {
  h1 { font-size: 22px; margin: 0 0 6px; }
  .sub { margin: 0; color: var(--muted); font-size: 13px; }
}

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

.panel-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  width: 100%;
}

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
  &.mini { padding: 5px 10px; font-size: 12px; }
}

/* ---------- 实例卡片 ---------- */
.grid {
  margin-top: 14px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}

.cell {
  background: var(--panel);
  border: 1px solid #242b3d;
  border-radius: 10px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cell-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  .status {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 60%;
  }
  .fold-btn { flex: 0 0 auto; }
}

.stage-host {
  position: relative;
  width: 100%;
  height: 150px;
  background: #000;
  border-radius: 6px;
  overflow: hidden;
  .stage { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
}

.ops {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  .input {
    background: var(--panel-2);
    border: 1px solid #2c3345;
    border-radius: 6px;
    color: var(--text);
    padding: 6px 8px;
    font-size: 12px;
    flex: 1 1 120px;
    min-width: 80px;
    &:focus { outline: none; border-color: var(--accent); }
    &:disabled { opacity: 0.55; }
  }
  .key-sel { flex: 0 1 auto; max-width: 46%; }
  .mini-input { flex: 0 1 74px; }
}

.meta {
  font-size: 12px;
  color: var(--muted);
  border-top: 1px solid #242b3d;
  padding-top: 6px;
  .skip-flag { color: var(--warn); }
}

.empty {
  margin-top: 14px;
  background: var(--panel);
  border: 1px dashed #343b4d;
  border-radius: 10px;
  padding: 20px;
  text-align: center;
  color: var(--muted);
  font-size: 13px;
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