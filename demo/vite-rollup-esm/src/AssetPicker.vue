<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ASSET_OPTIONS } from './assets'
import type { AssetOption } from './assets'

/**
 * 素材选择器：默认素材下拉 + 可自由输入的外部地址。
 * - 下拉命中预设时把 `url` 回填到输入框；输入任意地址则回落到「自定义地址」；
 * - `autoApply` 为 true 时，选中下拉项会直接抛 `apply`（宿主据此立刻重载）；
 * - 输入框回车始终抛 `apply`，给宿主一个「显式加载」的入口。
 */

const props = withDefaults(defineProps<{
  /** 当前素材地址（v-model） */
  modelValue: string;
  /** 下拉选项，默认取公共素材列表 */
  options?: AssetOption[];
  /** 字段名 */
  label?: string;
  /** 输入框占位文案 */
  placeholder?: string;
  /** 选中下拉项后是否立即抛 apply */
  autoApply?: boolean;
  /** 是否显示「加载」按钮 */
  showApply?: boolean;
  /** 「加载」按钮文案 */
  applyText?: string;
}>(), {
  options: () => ASSET_OPTIONS,
  label: '素材',
  placeholder: '也可直接输入任意 SVGA 外链',
  autoApply: false,
  showApply: false,
  applyText: '加载',
})

const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void;
  (event: 'apply', value: string): void;
}>()

/** 输入框文本：本地即时反馈，变更同步回宿主 */
const text = ref(props.modelValue)

watch(() => props.modelValue, (value) => {
  text.value = value
})

/** 下拉当前值：命中预设时回填其 url，否则为空（表示自定义地址） */
const selected = computed(() => {
  const matched = props.options.find(option => option.url === props.modelValue)
  return matched ? matched.url : ''
})

/** 当前素材的说明：命中预设取预设说明，否则提示这是外部地址 */
const note = computed(() => {
  const matched = props.options.find(option => option.url === props.modelValue)
  return matched ? matched.note : '外部地址：需可跨域访问（CORS），否则解析会被浏览器拦截'
})

/** 输入框变更：同步给宿主，但不触发重载 */
function onInput() {
  emit('update:modelValue', text.value)
}

/**
 * 下拉切换预设素材。
 * @param event 原生 change 事件
 */
function onSelect(event: Event) {
  const url = (event.target as HTMLSelectElement).value
  if (!url) return
  emit('update:modelValue', url)
  if (props.autoApply) emit('apply', url)
}

/** 提交输入框里的地址（回车或点「加载」） */
function submit() {
  const url = text.value.trim()
  emit('update:modelValue', url)
  emit('apply', url)
}
</script>

<template>
  <div class="asset-picker">
    <span class="label">{{ label }}</span>
    <div class="line">
      <select class="select" :value="selected" @change="onSelect">
        <option value="">自定义地址…</option>
        <option v-for="option in options" :key="option.url" :value="option.url">{{ option.label }}</option>
      </select>
      <input
        v-model="text"
        class="input"
        type="text"
        :placeholder="placeholder"
        @input="onInput"
        @keyup.enter="submit"
      />
      <button v-if="showApply" class="apply" @click="submit">{{ applyText }}</button>
    </div>
    <p class="note">{{ note }}</p>
  </div>
</template>

<style scoped lang="scss">
.asset-picker {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;

  .label {
    font-size: 12px;
    color: var(--muted);
  }

  .line {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .select,
  .input {
    background: var(--panel-2);
    border: 1px solid #242b3d;
    color: var(--text);
    border-radius: 8px;
    padding: 8px 10px;
    font-size: 13px;
    font-family: inherit;
  }

  .select {
    flex: 0 1 auto;
    max-width: 100%;
  }

  .input {
    flex: 1 1 220px;
    min-width: 0;

    &:focus {
      outline: none;
      border-color: var(--accent);
    }
  }

  .apply {
    flex: 0 0 auto;
    background: var(--accent);
    border: 1px solid var(--accent);
    color: #fff;
    border-radius: 8px;
    padding: 8px 14px;
    font-size: 13px;
    cursor: pointer;

    &:hover {
      filter: brightness(1.08);
    }
  }

  .note {
    margin: 0;
    font-size: 12px;
    color: var(--muted);
    line-height: 1.5;
  }
}
</style>
