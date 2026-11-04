# Changelog

记录 custom-svga 的版本变更。格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [SemVer](https://semver.org/lang/zh-CN/)。
日期以 npm 实际发布时间为准。1.x 为旧架构（离屏渲染），已归档 `versions/`，不再逐版本展开。

## [2.4.0] - 2026-11-04

### Added

- `PlayConfig.maxDpr`：画布 DPR 上限，画布后备存储按 `min(devicePixelRatio, maxDpr)` 出图，`0` / 不传不限制。大画布、低端机可显著降低每帧光栅化像素与帧缓存内存。三处尺寸计算统一走 `Renderer.resolveScale()`，`setConfig` 修改后即时重算画布。
- 在线演示（GitHub Pages）：<https://1707979815.github.io/custom-svga/>，含展示页与单实例 / 多实例回归页。

### Changed

- README 双语化重写：补充与官方 `svgaplayerweb` / `svga.lite` 的对比表、迁移指南与体积说明。
- 补充 `LICENSE` 与 `CHANGELOG.md`，随 npm 包一并分发。
- `package.json` 收尾：`exports.default` 指向 ESM 产物（此前指向 UMD），精简 `keywords`，`homepage` 指向在线演示。

## [2.3.1] - 2026-09-11

### Added

- `PlayConfig.frameThrottling` 抽帧渲染：目标渲染帧率上限（fps），动画时间轴 / 时长 / 事件不受影响，仅降低画面刷新频率，可与 `cacheFrames` 叠加。

### Changed

- 移除共享 RAF 调度与 `useSharedRAF` 配置：`SharedTicker` 收敛为 `startRenderLoop(task)`，每实例独立 RAF，避免单实例拖垮整帧。
- 帧缓存策略重构：仅当循环区间帧数 ≤ `maxCacheFrames`（默认 100）时启用全区间缓存，装不下则整体禁用并提示一次；`setConfig` 改 `startFrame` / `endFrame` 只剔除区间外帧、保留重叠帧复用。
- 兼容性增强与构建产物更新。

## [2.3.0] - 2026-08-31

### Changed

- 文档（README / USE）与构建产物整理，无新增 API。

## [2.2.0] - 2026-08-19

### Added

- `onEnd` 事件：配置有限 `loop` 达到上限停摆时触发，顺序为 `onLoopEnd → onEnd → onStop`；`loop: 0` 无限循环与手动 `stop()` / `pause()` 不触发。

## [2.1.0] - 2026-08-14

### Changed

- 类型定义与文档调整；清理历史产物（`dist_v1/`）。

## [2.0.1] - 2026-08-12

### Changed

- 产物修正；demo 拆分为「单实例回归 + 多实例压力」两个页面。

## [2.0.0] - 2026-08-11

### Changed

- v2 lite 架构重构：移除离屏渲染；单入口导出 `Player` / `Parser` / `types`；同构内联 Worker 解析（真 Worker 优先、主线程 MockWorker 降级），零运行时依赖。

## 1.x（2026-07）

早期版本（1.0.0 ~ 1.2.3，2026-07-08 首次发布）：离屏渲染架构，worker 一站式请求/解析、拉伸模式等能力逐步加入。代码已归档 `versions/`，API 与 v2 不同，详见 git 历史。
