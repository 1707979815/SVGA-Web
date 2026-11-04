// 每个 demo 唯一需要改动的文件：仅此文件的导入来源不同。
// rollup-esm 指向真实 Rollup ESM 产物（package exports "."）。
export { Player, Parser, SCALE_MODE } from 'custom-svga'
export type { MovieData, DynamicText, PosterEventInfo } from 'custom-svga'

export const demoInfo = {
  name: 'Rollup · ESM',
  entry: 'dist/esm/index.js',
}
