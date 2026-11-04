/**
 * @file demo 内部性能采集器：只用浏览器原生能力（rAF / PerformanceObserver / performance.memory），
 * 不依赖 CDP，因此「页面内手动测量」与「脚本自动化测量」可以共用同一套指标定义。
 */

/** 单次测量结果 */
export interface BenchSample {
  /** 首帧耗时（ms）：从 start() 到 markFirstFrame()；未标记时为 -1 */
  firstFrameMs: number;
  /** 采样窗口时长（ms） */
  durationMs: number;
  /** 平均 rAF 间隔（ms），近似页面刷新节奏 */
  avgIntervalMs: number;
  /** 掉帧率：间隔超过中位数 1.5 倍的帧占比（0~1） */
  droppedRatio: number;
  /** 长任务数量（单次 > 50ms） */
  longTasks: number;
  /** 长任务累计耗时（ms） */
  longTaskMs: number;
  /** 采样期间 JS 堆增量（MB）；非 Chromium 或未开启精确内存时为 -1 */
  heapDeltaMB: number;
}

/** Chromium 专有的 performance.memory 形状 */
interface PerformanceMemory {
  usedJSHeapSize: number;
}

/**
 * 读取当前 JS 堆占用（字节）。
 * @returns 字节数；浏览器不支持时返回 -1
 */
function readHeapSize(): number {
  const memory = (performance as Performance & { memory?: PerformanceMemory }).memory;
  return memory ? memory.usedJSHeapSize : -1;
}

/**
 * 帧率与主线程占用采集器。
 * 典型用法：`start()` → 装载并播放 → 首次绘制回调里 `markFirstFrame()` → 播放若干秒后 `stop()`。
 */
export class BenchRecorder {
  /** 采样起点时间戳 */
  private startAt = 0;
  /** 首帧时间戳（0 表示尚未标记） */
  private firstFrameAt = 0;
  /** rAF 句柄 */
  private rafId = 0;
  /** 上一帧时间戳 */
  private lastRafAt = 0;
  /** 相邻两帧间隔序列 */
  private intervals: number[] = [];
  /** 长任务计数 */
  private longTasks = 0;
  /** 长任务累计耗时 */
  private longTaskMs = 0;
  /** 长任务观察器 */
  private observer: PerformanceObserver | null = null;
  /** 采样起点的堆占用 */
  private heapStart = -1;
  /** 是否正在采样 */
  private running = false;

  /** 开始采样：重置状态、记录堆基线并启动 rAF 与长任务观察 */
  start(): void {
    this.stop();
    this.startAt = performance.now();
    this.firstFrameAt = 0;
    this.lastRafAt = 0;
    this.intervals = [];
    this.longTasks = 0;
    this.longTaskMs = 0;
    this.heapStart = readHeapSize();
    this.running = true;
    this.rafId = requestAnimationFrame(this.tick);

    try {
      this.observer = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          this.longTasks += 1;
          this.longTaskMs += entry.duration;
        }
      });
      this.observer.observe({ entryTypes: ['longtask'] });
    } catch {
      /** 不支持 longtask（如 Safari）时静默降级，指标保持 0 */
      this.observer = null;
    }
  }

  /** 标记首帧到达；重复调用只记录第一次 */
  markFirstFrame(): void {
    if (!this.firstFrameAt) this.firstFrameAt = performance.now();
  }

  /**
   * 结束采样并汇总结果。
   * @returns 本次采样结果；未 start 时各字段为 0 / -1
   */
  stop(): BenchSample {
    const endAt = performance.now();
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
    this.running = false;

    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    const durationMs = this.startAt ? endAt - this.startAt : 0;
    const sorted = [...this.intervals].sort((a, b) => a - b);
    const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
    const threshold = median * 1.5;
    const dropped = threshold ? this.intervals.filter(item => item > threshold).length : 0;
    const heapEnd = readHeapSize();
    const heapDeltaMB =
      this.heapStart >= 0 && heapEnd >= 0 ? (heapEnd - this.heapStart) / (1024 * 1024) : -1;

    const result: BenchSample = {
      firstFrameMs: this.firstFrameAt ? this.firstFrameAt - this.startAt : -1,
      durationMs,
      avgIntervalMs: this.intervals.length
        ? this.intervals.reduce((sum, item) => sum + item, 0) / this.intervals.length
        : 0,
      droppedRatio: this.intervals.length ? dropped / this.intervals.length : 0,
      longTasks: this.longTasks,
      longTaskMs: this.longTaskMs,
      heapDeltaMB,
    };

    this.startAt = 0;
    return result;
  }

  /** rAF 采样循环 */
  private tick = (now: number): void => {
    if (!this.running) return;
    if (this.lastRafAt) this.intervals.push(now - this.lastRafAt);
    this.lastRafAt = now;
    this.rafId = requestAnimationFrame(this.tick);
  };
}

/**
 * 把单次采样结果格式化为表格行文本。
 * @param sample 采样结果
 * @returns 便于复制到 Markdown 的一行文本
 */
export function formatSample(sample: BenchSample): string {
  const pct = (value: number) => `${(value * 100).toFixed(1)}%`;
  const ms = (value: number) => `${value.toFixed(1)}ms`;
  return [
    sample.firstFrameMs >= 0 ? ms(sample.firstFrameMs) : '-',
    ms(sample.avgIntervalMs),
    pct(sample.droppedRatio),
    `${sample.longTasks} 次 / ${sample.longTaskMs.toFixed(0)}ms`,
    sample.heapDeltaMB >= 0 ? `${sample.heapDeltaMB.toFixed(2)}MB` : '-',
  ].join(' | ');
}
