/**
 * @file assets.ts
 * @description demo 共用的默认素材选项。前几项是随 demo 分发的本地素材（放在 `public/svga/` 下，dev 与静态部署同源），
 * 其余是 SVGAPlayer 官方仓库的示例素材（走 jsDelivr CDN，带 CORS，已实测可跨域拉取）。
 * 各 tab 的素材下拉都从这里取默认列表，同时允许用户直接输入任意外部 URL。
 */

/** 单个素材选项 */
export interface AssetOption {
  /** 下拉里显示的名字 */
  label: string;
  /** 可直接交给 Parser.loadUrl 的地址（相对地址以当前页面为基准） */
  url: string;
  /** 来源与体积说明，展示在提示行 */
  note: string;
}

/** 官方示例素材 CDN 前缀（SVGAPlayer-Web-Lite 的测试素材，jsDelivr 返回 `access-control-allow-origin: *`） */
const OFFICIAL_CDN = 'https://cdn.jsdelivr.net/gh/svga/SVGAPlayer-Web-Lite@master/__test__/svga';

/**
 * 默认素材列表：第一项即默认选中项。
 * 本地素材用于离线回归；其中两项是**矢量**素材（含 ShapeEntity），是仓库里唯一能覆盖
 * `ShapeEntity/ShapeStyle/lineCap` 解码与绘制路径的样本（位图素材一条 shape 都没有）。
 */
export const ASSET_OPTIONS: AssetOption[] = [
  {
    label: '徽章（本地素材）',
    url: 'svga/newGuild/a-3-badge.svga',
    note: '随 demo 分发：dev 与部署都读 public/svga 下的同源文件',
  },
  {
    label: '矢量 · HamburgerArrow（本地）',
    url: 'svga/official/HamburgerArrow.svga',
    note: '矢量回归素材：540 个 ShapeEntity（path + stroke），可覆盖矢量绘制路径 · 约 5KB · 来源 SVGAPlayer-Web 官方仓库（Apache-2.0）',
  },
  {
    label: '矢量 · TwitterHeart（本地）',
    url: 'svga/official/TwitterHeart.svga',
    note: '矢量回归素材：779 个 shape，其中 658 个带 lineCap 描边样式 · 约 11KB · 来源 SVGAPlayer-Web 官方仓库（Apache-2.0）',
  },
  {
    label: '头部 · gacha-1（本地）',
    url: 'svga/heads/gacha-1-head.svga',
    note: '位图动画 · 701 个 sprite · 约 544KB',
  },
  {
    label: '头部 · lv-1（本地）',
    url: 'svga/heads/lv-1-head.svga',
    note: '位图动画 · 160 个 sprite · 约 209KB',
  },
  {
    label: '头部 · shop-2（本地）',
    url: 'svga/heads/shop-2-head.svga',
    note: '位图动画 · 212 个 sprite · 约 578KB',
  },
  {
    label: '头部 · shop-4（本地）',
    url: 'svga/heads/shop-4-head.svga',
    note: '位图动画 · 95 个 sprite · 约 463KB',
  },
  {
    label: 'Loading（官方示例）',
    url: `${OFFICIAL_CDN}/loading.svga`,
    note: '官方示例素材 · 约 120KB · 来自 jsDelivr CDN',
  },
  {
    label: 'Angel（官方示例）',
    url: `${OFFICIAL_CDN}/angel.svga`,
    note: '官方示例素材 · 约 210KB · 来自 jsDelivr CDN',
  },
  {
    label: 'Kingset（官方示例）',
    url: `${OFFICIAL_CDN}/kingset.svga`,
    note: '官方示例素材 · 约 156KB · 来自 jsDelivr CDN',
  },
  {
    label: 'Logo（官方示例）',
    url: `${OFFICIAL_CDN}/logo.svga`,
    note: '官方示例素材 · 约 178KB · 来自 jsDelivr CDN',
  },
  {
    label: 'Story（官方示例 · 大文件）',
    url: `${OFFICIAL_CDN}/story.svga`,
    note: '官方示例素材 · 约 1.4MB · 适合观察解析与首帧耗时',
  },
];

/** 默认素材地址（列表首项） */
export const DEFAULT_ASSET = ASSET_OPTIONS[0].url;

/**
 * 给地址追加一个查询参数（用于绕过解析缓存）。
 * @param url 原始地址
 * @param key 参数名
 * @param value 参数值
 * @returns 拼接后的地址；原地址已带 query 时用 `&` 连接
 */
export function appendQuery(url: string, key: string, value: string): string {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
}
