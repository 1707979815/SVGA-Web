<script setup lang="ts">
import { ref } from 'vue'
import SingleView from './SingleView.vue'
import MultiView from './MultiView.vue'

/**
 * demo 外壳：顶部 tab 切换「单实例回归」与「多实例播放」两个测试页。
 * 两页共用同一产物入口，便于对照验证。
 */

const active = ref<'single' | 'multi'>('single')
</script>

<template>
  <div class="shell">
    <nav class="tabs">
      <button :class="{ active: active === 'single' }" @click="active = 'single'">单实例回归</button>
      <button :class="{ active: active === 'multi' }" @click="active = 'multi'">多实例播放</button>
    </nav>
    <SingleView v-if="active === 'single'" />
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
  gap: 8px;
  padding: 14px 0 0;
  background: var(--bg);
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
</style>
