<script setup lang="ts">
import { ref } from 'vue'
import ShowcaseView from './ShowcaseView.vue'
import BenchView from './BenchView.vue'
import CompareView from './CompareView.vue'
import SingleView from './SingleView.vue'
import MultiView from './MultiView.vue'
import * as svgaBackend from './svga'

/**
 * demo 外壳：五个入口共用同一产物。
 * - 在线演示（Showcase）：面向首次访问者的产品化首屏，默认打开；
 * - 基准测试（Bench）：页面内跑量化指标，输出首帧/掉帧/长任务/堆增量；
 * - 官方对比（Compare）：与 svgaplayerweb 并排播放，验证循环末帧是否完整；
 * - 单实例回归 / 多实例播放：作者自用的全量参数面板。
 */

type TabKey = 'showcase' | 'bench' | 'compare' | 'single' | 'multi'

/** tab 定义（key 与组件一一对应） */
const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'showcase', label: '在线演示' },
  { key: 'bench', label: '基准测试' },
  { key: 'compare', label: '官方对比' },
  { key: 'single', label: '单实例回归' },
  { key: 'multi', label: '多实例播放' },
]

/**
 * 初始 tab：支持 `?tab=multi` 深链直达某一页（分享/排障用），非法或缺失时回落到在线演示。
 * @returns 生效的 tab key
 */
function initialTab(): TabKey {
  const raw = new URL(location.href).searchParams.get('tab')
  return TABS.some(tab => tab.key === raw) ? (raw as TabKey) : 'showcase'
}

const active = ref<TabKey>(initialTab())

/**
 * 切换 tab 并同步地址栏（replaceState 不刷新页面，也保留 ?build=）。
 * @param key 目标 tab
 */
function selectTab(key: TabKey) {
  active.value = key
  const url = new URL(location.href)
  url.searchParams.set('tab', key)
  history.replaceState(null, '', url)
}

/** 构建产物标识（主包 demo 的 src/svga.ts 提供，展示仓演示不提供） */
type BuildKind = 'rollup' | 'tsup'

/**
 * 当前构建产物：由 src/svga.ts 暴露。
 * 主包 demo 内置 rollup / tsup 两份 vendor 产物，故能切换；GitHub 展示仓直接依赖 npm 包，
 * 其 svga.ts 不导出该字段 —— 此时顶栏隐藏「产物」切换器，保持同一份 App.vue 两仓通用。
 */
const buildKind = (svgaBackend as { buildKind?: BuildKind }).buildKind

/** 可切换的构建产物（默认 rollup，与 src/svga.ts 的回落规则一致） */
const BUILDS: Array<{ key: BuildKind; label: string; title: string }> = [
  { key: 'rollup', label: 'rollup', title: '使用 rollup 构建的 dist/esm 产物（默认）' },
  { key: 'tsup', label: 'tsup', title: '使用 tsup 构建的 dist/esm 产物' },
]

/**
 * 切换构建产物：整页刷新，重新按新产物加载模块。
 * 不在 SPA 内热切——产物是两份独立的模块实例，混用会让 Player/Parser 的模块级缓存与 Worker 各持一份。
 * @param kind 目标构建器
 */
function switchBuild(kind: BuildKind) {
  if (kind === buildKind) return
  const url = new URL(location.href)
  url.searchParams.set('build', kind)
  location.href = url.toString()
}
</script>

<template>
  <div class="shell">
    <header class="topbar">
      <div class="brand">
        <svg class="mark" viewBox="0 0 24 24" aria-hidden="true">
          <rect x="2" y="2" width="20" height="20" rx="6" />
          <path d="M10 8.4v7.2l6-3.6z" />
        </svg>
        <span class="brand-text">
          <b>custom-svga</b>
          <small>SVGA 播放器 · 回归 demo</small>
        </span>
      </div>

      <nav class="tabs" role="tablist" aria-label="demo 页面">
        <button
          v-for="tab in TABS"
          :key="tab.key"
          type="button"
          role="tab"
          :aria-selected="active === tab.key"
          :class="{ active: active === tab.key }"
          @click="selectTab(tab.key)"
        >
          {{ tab.label }}
        </button>
      </nav>

      <div class="tools">
        <template v-if="buildKind">
          <div class="seg" role="group" aria-label="切换构建产物">
            <span class="seg-label">产物</span>
            <button
              v-for="item in BUILDS"
              :key="item.key"
              type="button"
              :class="{ active: buildKind === item.key }"
              :aria-pressed="buildKind === item.key"
              :title="item.title"
              @click="switchBuild(item.key)"
            >
              {{ item.label }}
            </button>
          </div>

          <span class="divider" aria-hidden="true"></span>
        </template>

        <a
          class="link"
          href="https://www.npmjs.com/package/custom-svga"
          target="_blank"
          rel="noreferrer"
          title="npm 包"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3.2" y="6.4" width="17.6" height="11.2" rx="2.4" fill="none" stroke="currentColor" stroke-width="1.6" />
            <text x="12" y="15" text-anchor="middle" font-size="7.2" font-weight="700" fill="currentColor" font-family="Arial, sans-serif">npm</text>
          </svg>
          <span class="link-text">npm</span>
        </a>

        <a
          class="link"
          href="https://github.com/1707979815/SVGA-Web"
          target="_blank"
          rel="noreferrer"
          title="GitHub 仓库"
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path
              fill="currentColor"
              d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"
            />
          </svg>
          <span class="link-text">GitHub</span>
        </a>
      </div>
    </header>

    <ShowcaseView v-if="active === 'showcase'" />
    <BenchView v-else-if="active === 'bench'" />
    <CompareView v-else-if="active === 'compare'" />
    <SingleView v-else-if="active === 'single'" />
    <MultiView v-else />
  </div>
</template>

<style scoped lang="scss">
.shell {
  max-width: 1120px;
  margin: 0 auto;
  padding: 0 20px;
}

.topbar {
  position: sticky;
  top: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 16px 0;
  background: rgba(16, 19, 26, 0.88);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--line);
}

/* ---------- 品牌 ---------- */
.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 0 0 auto;

  .mark {
    width: 32px;
    height: 32px;
    flex: 0 0 auto;

    rect {
      fill: var(--accent);
    }

    path {
      fill: #fff;
    }
  }

  .brand-text {
    display: flex;
    flex-direction: column;
    line-height: 1.25;

    b {
      font-size: 15px;
      letter-spacing: 0.01em;
    }

    small {
      font-size: 12px;
      color: var(--muted);
    }
  }
}

/* ---------- 页面切换（分段控件） ---------- */
.tabs {
  display: flex;
  gap: 2px;
  margin-right: auto;
  padding: 4px;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 12px;
  overflow-x: auto;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }

  button {
    flex: 0 0 auto;
    padding: 8px 15px;
    border: 1px solid transparent;
    border-radius: 9px;
    background: transparent;
    color: var(--muted);
    font-size: 13.5px;
    white-space: nowrap;
    cursor: pointer;
    transition: color 0.15s, background 0.15s, border-color 0.15s;

    &:hover {
      color: var(--text);
      background: var(--panel-2);
    }

    &.active {
      color: var(--text);
      font-weight: 600;
      background: var(--panel-2);
      border-color: var(--line-strong);
    }
  }
}

/* ---------- 右侧工具：产物开关 + 外链图标 ---------- */
.tools {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 0 0 auto;
}

.seg {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 11px;

  .seg-label {
    padding: 0 8px 0 6px;
    font-size: 12px;
    color: #6b7488;
    letter-spacing: 0.04em;
  }

  button {
    padding: 6px 11px;
    border: 1px solid transparent;
    border-radius: 8px;
    background: transparent;
    color: var(--muted);
    font-size: 12.5px;
    cursor: pointer;
    transition: color 0.15s, background 0.15s;

    &:hover {
      color: var(--text);
      background: var(--panel-2);
    }

    &.active {
      color: var(--text);
      font-weight: 600;
      background: var(--panel-2);
      border-color: var(--line-strong);
    }
  }
}

.divider {
  width: 1px;
  height: 24px;
  background: var(--line);
}

.link {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 38px;
  padding: 0 12px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--panel);
  color: var(--muted);
  font-size: 12.5px;
  text-decoration: none;
  transition: color 0.15s, border-color 0.15s, background 0.15s;

  svg {
    width: 17px;
    height: 17px;
    flex: 0 0 auto;
  }

  &:hover {
    color: var(--text);
    background: var(--panel-2);
    border-color: var(--line-strong);
  }
}

/* 窄屏：导航换行到第二行，工具区留在首行右侧 */
@media (max-width: 880px) {
  .topbar {
    flex-wrap: wrap;
    row-gap: 10px;
    padding: 12px 0;
  }

  .tabs {
    order: 3;
    width: 100%;
    margin-right: 0;
  }

  .tools {
    margin-left: auto;
  }
}

@media (max-width: 560px) {
  .brand .brand-text small,
  .seg .seg-label,
  .link-text {
    display: none;
  }

  .link {
    width: 38px;
    padding: 0;
    justify-content: center;
  }

  .tabs button {
    padding: 8px 12px;
    font-size: 12.5px;
  }
}
</style>
