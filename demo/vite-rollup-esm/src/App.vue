<script setup lang="ts">
import { ref } from 'vue'
import ShowcaseView from './ShowcaseView.vue'
import BenchView from './BenchView.vue'
import CompareView from './CompareView.vue'
import SingleView from './SingleView.vue'
import MultiView from './MultiView.vue'

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

const active = ref<TabKey>('showcase')
</script>

<template>
  <div class="shell">
    <nav class="tabs">
      <div class="group">
        <button
          v-for="tab in TABS"
          :key="tab.key"
          :class="{ active: active === tab.key }"
          @click="active = tab.key"
        >
          {{ tab.label }}
        </button>
      </div>
      <div class="links">
        <a href="https://www.npmjs.com/package/custom-svga" target="_blank" rel="noreferrer">npm</a>
        <a href="https://github.com/1707979815/custom-svga" target="_blank" rel="noreferrer">GitHub</a>
      </div>
    </nav>
    <ShowcaseView v-if="active === 'showcase'" />
    <BenchView v-else-if="active === 'bench'" />
    <CompareView v-else-if="active === 'compare'" />
    <SingleView v-else-if="active === 'single'" />
    <MultiView v-else />
  </div>
</template>

<style scoped lang="scss">
.shell {
  max-width: 1100px;
  margin: 0 auto;
  padding: 0 20px;
}

.tabs {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 0 0;
  background: var(--bg);

  .group {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .links {
    display: flex;
    gap: 14px;
    padding-bottom: 10px;
    font-size: 12px;

    a {
      color: var(--muted);
      text-decoration: none;

      &:hover {
        color: var(--accent);
      }
    }
  }

  button {
    background: var(--panel);
    border: 1px solid #242b3d;
    color: var(--muted);
    border-radius: 8px 8px 0 0;
    padding: 9px 18px;
    font-size: 14px;
    cursor: pointer;
    border-bottom: none;
    &.active {
      color: var(--accent);
      border-color: var(--accent);
      font-weight: 600;
    }
  }
}

@media (max-width: 720px) {
  .tabs {
    flex-wrap: wrap;

    .group {
      gap: 6px;
    }

    button {
      padding: 7px 12px;
      font-size: 13px;
    }

    .links {
      padding-bottom: 8px;
    }
  }
}
</style>
