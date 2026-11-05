# Changelog

记录 custom-svga 的版本变更。格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [SemVer](https://semver.org/lang/zh-CN/)。
日期以 npm 实际发布时间为准。1.x 为旧架构（离屏渲染），已归档 `versions/`，不再逐版本展开。

## [2.4.1] - 2026-11-05

### Fixed

- 仓库改名为 `SVGA-Web` 后同步元数据：`repository` / `homepage` / `bugs` 与 README 链接全部指向新仓库 <https://github.com/1707979815/SVGA-Web>，在线演示改为 <https://1707979815.github.io/SVGA-Web/>（GitHub Pages 域名不随仓库改名重定向，旧地址会直接 404）。仅元数据与文档变更，构建产物与运行时行为与 2.4.0 完全一致。

## [2.4.0] - 2026-11-05

### Added

- **结构化错误**：新增 `SvgaError`（`Error` 子类，带 `code` 字段）与 13 个错误码（`NETWORK` / `DECOMPRESS` / `INVALID_PROTOCOL` / `DECODE` / `EMPTY_BUFFER` / `INVALID_BUFFER` / `IMAGE_DECODE` / `TIMEOUT` / `PARSE_FAILED` / `WORKER_ERROR` / `WORKER_RELEASED` / `CANVAS_CONTEXT` / `LOAD_FAILED`），错误码在 worker 回包中透传、主线程还原，跨线程不丢；入口对外提供 `SvgaError`（类）、`isSvgaError`（类型收窄）与 `ErrorCode`（错误码类型），其余工具函数留在内部；错误对象对外只保留 `code` / `message` / `tips` 三个字段（`message` 自动带 `[SVGA error]` 前缀便于日志定位，`tips` 为稳定中文提示语，可直接展示），`cause` 作为原始异常供排查。`SvgaError` 仍是 `Error` 子类，既有写法不受影响。
- `PlayConfig.maxDpr`：画布 DPR 上限，画布后备存储按 `min(devicePixelRatio, maxDpr)` 出图，`0` / 不传不限制。大画布、低端机可显著降低每帧光栅化像素与帧缓存内存。三处尺寸计算统一走 `Renderer.resolveScale()`，`setConfig` 修改后即时重算画布。
- 在线演示（GitHub Pages）：<https://1707979815.github.io/SVGA-Web/>，含展示页与单实例 / 多实例回归页。
- 新增无状态渲染原语模块 `src/render/primitives.ts`：源尺寸到画布的缩放映射、形状 `Path2D` 与样式绘制、离屏画布与 2D 上下文获取、动态文本样式归一。仅 `src/render/` 内引用，**不进公共 API**。
- 冒烟回归从 10 项扩到 12 项：新增 `Parser` 实例语义（实例与静态共享全局缓存、`cache: false` 仍复用带 key 的在途任务、`destroy()` 立即驳回在途任务）与 `play(config)` 配置持久化 + 自然结束事件顺序（`onLoopEnd → onEnd → onStop`）断言。

### Changed

- **渲染层合并为单一 `Renderer`**：原 `Renderer.ts`（海报/尺寸/Observer/Ticker）与 `RendererCore.ts`（播放状态机/绘制）的父子继承拆分合入一个类，去掉 `super` 转发与 `setConfig` 虚分发（此前 `play(config)` 存在配置被重复应用的风险）；`onEnd` / `loopEnded` / 自然结束重播等语义保持不变。
- **缩放适配统一为 `computeFitTransform`**：海报绘制与 viewBox 精灵共用同一套 `Fill` / `AspectFit` / `AspectFill` 算法；`AspectFill` 由「裁源子矩形」改为「等比居中铺满 + 超出部分由画布裁剪」，两者源到目标的坐标映射等价，产物体积不变。
- **`Parser` 改为继承私有 `ParseSession` 基类**：静态方法与会话默认实例共用同一份缓存键推导、默认值解析（`cache !== false` / `useImageBitmap ?? false` / `useWorker ?? true`）与 `autoClose` 编排，实例不再维护一套镜像转发方法；实例解析配置仍在构造时一次性声明。
- **`MovieCache` 收敛导出面**：只对外提供 `loadWithCache` / `deleteCache` / `clearCache`，`setCache` / `touchCache` / 在途任务（`pendingLoads`）系列转为模块私有，避免外部误用缓存内部状态。
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
