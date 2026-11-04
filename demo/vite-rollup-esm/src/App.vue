<script setup lang="ts">
import { ref } from 'vue'
import ShowcaseView from './ShowcaseView.vue'
import SingleView from './SingleView.vue'
import MultiView from './MultiView.vue'

/**
 * demo 外壳：三个入口共用同一产物。
 * - 在线演示（Showcase）：面向首次访问者的产品化首屏，默认打开；
 * - 单实例回归 / 多实例播放：作者自用的全量参数面板，保留用于回归验证。
 */

const active = ref<'showcase' | 'single' | 'multi'>('showcase')
</script>

<template>
  <div class="shell">
    <nav class="tabs">
      <div class="group">
        <button :class="{ active: active === 'showcase' }" @click="active = 'showcase'">在线演示</button>
        <button :class="{ active: active === 'single' }" @click="active = 'single'">单实例回归</button>
        <button :class="{ active: active === 'multi' }" @click="active = 'multi'">多实例播放</button>
      </div>
      <div class="links">
        <a href="https://www.npmjs.com/package/custom-svga" target="_blank" rel="noreferrer">npm</a>
        <a href="https://github.com/1707979815/custom-svga" target="_blank" rel="noreferrer">GitHub</a>
      </div>
    </nav>
    <ShowcaseView v-if="active === 'showcase'" />
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
    padding: 9px 22px;
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

@media (max-width: 640px) {
  .tabs {
    flex-wrap: wrap;

    .links {
      padding-bottom: 8px;
    }
  }
}
</style>
