// 每个 demo 唯一需要改动的文件：仅此文件的导入来源不同。
// 本仓库直接消费 npm 上已发布的 custom-svga（package exports "." 的 ESM 入口），
// 不做 rollup / tsup 双产物切换——那是主包 demo 的能力（需要 vendor 两份本地产物）。
export { Player, Parser, SCALE_MODE } from 'custom-svga'
export type { MovieData, DynamicText, PosterEventInfo } from 'custom-svga'

export const demoInfo = {
  name: 'npm 包 · ESM',
  entry: 'dist/esm/index.js',
}
