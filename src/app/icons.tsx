import type { ComponentChildren, JSX } from "preact";

/*
 * Icon geometry adapted from Lucide 1.27.0.
 * Full Lucide ISC and Feather MIT notices are embedded in the userscript.
 */

export type IconProps = JSX.SVGAttributes<SVGSVGElement> & {
  size?: number | string;
};

interface SvgIconProps extends IconProps {
  children: ComponentChildren;
}

function SvgIcon({
  size = 24,
  strokeWidth = 2,
  children,
  ...props
}: SvgIconProps) {
  const svgAttributes: JSX.SVGAttributes<SVGSVGElement> = {
    xmlns: "http://www.w3.org/2000/svg",
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": strokeWidth,
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    focusable: "false",
    ...props,
  };

  return <svg {...svgAttributes}>{children}</svg>;
}

/**
 * 播放器标题栏的品牌图标（`images/bilibili-music-player-logo-v2.svg`）。
 *
 * 自带粉红渐变圆角底 + 白色电视/播放/均衡器图形，所以既不复用 `SvgIcon` 的
 * 24 视口与描边默认值，也不需要额外的 CSS 背景。渐变 id 加了前缀，
 * 避免同一文档里出现同名 id（宿主页面或第二个内联 SVG）。
 */
export function BrandLogo({ size = 24, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 1024 1024"
      focusable="false"
      {...props}
    >
      <defs>
        <linearGradient id="bmp-brand-logo-tile" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#ff82a6" />
          <stop offset="1" stop-color="#f05284" />
        </linearGradient>
      </defs>
      <rect
        width="1024"
        height="1024"
        rx="224"
        fill="url(#bmp-brand-logo-tile)"
      />
      <g
        fill="none"
        stroke="#fff"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M405 279 331 205M619 279l74-74" stroke-width="32" />
        <rect
          x="214"
          y="285"
          width="596"
          height="470"
          rx="96"
          stroke-width="42"
        />
      </g>
      <path
        d="M380 412c0-18 20-29 36-20l177 103c16 9 16 32 0 41L416 639c-16 9-36-2-36-20V412Z"
        transform="translate(-34 0)"
        fill="#fff"
      />
      <g fill="#fff">
        <rect x="612" y="474" width="30" height="112" rx="15" />
        <rect x="661" y="438" width="30" height="184" rx="15" />
        <rect x="710" y="492" width="30" height="76" rx="15" />
      </g>
    </svg>
  );
}

/**
 * 窗口图标（设置里「窗口与外观」分区）。
 *
 * 几何取自 Lucide `app-window`：外框 20×16、圆角 2，标题栏横线在 y=8，
 * 两个 4px 高的竖线端点模拟标题栏按钮，与概念图里「窗口 + 顶栏」一致。
 */
export function AppWindow(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M10 4v4" />
      <path d="M2 8h20" />
      <path d="M6 4v4" />
    </SvgIcon>
  );
}

/**
 * 左箭头（设置视图的「返回播放器」）。
 *
 * 几何取自 Lucide `arrow-left`：横线 y=12、长 14，箭头张口 7。
 */
export function ArrowLeft(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </SvgIcon>
  );
}

/**
 * 勾选标记（歌曲多选复选框的选中态）。
 *
 * 几何取自 Lucide `check`：起笔 (20,6) 折到 (9,17)，再收到 (4,12)。
 */
export function Check(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M20 6 9 17l-5-5" />
    </SvgIcon>
  );
}

export function ChevronDown(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="m6 9 6 6 6-6" />
    </SvgIcon>
  );
}

export function Clock3(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6h4" />
    </SvgIcon>
  );
}

/** 数据库/归档图标（数据管理分区）。 */
export function Database(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5v14a9 3 0 0 0 18 0V5" />
      <path d="M3 12a9 3 0 0 0 18 0" />
    </SvgIcon>
  );
}

/**
 * 下载图标（设置里「导出备份」）。
 *
 * 几何取自 Lucide `download`：托盘 18×6 开口向上、圆角 2，箭头竖线 x=12 从 y=3 到 y=15。
 */
export function Download(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    </SvgIcon>
  );
}

export function Headphones(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3" />
    </SvgIcon>
  );
}

/**
 * 信息图标（设置里「关于」分区）。
 *
 * 几何取自 Lucide `info`：圆 r=10，竖线从 y=11 到 y=16，圆点在 (12, 8)。
 */
export function Info(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </SvgIcon>
  );
}

export function ListMusic(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M16 5H3" />
      <path d="M11 12H3" />
      <path d="M11 19H3" />
      <path d="M21 16V5" />
      <circle cx="18" cy="16" r="3" />
    </SvgIcon>
  );
}

export function Music2(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <circle cx="8" cy="18" r="4" />
      <path d="M12 18V2l7 4" />
    </SvgIcon>
  );
}

export function Minimize2(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="m14 10 7-7" />
      <path d="M20 10h-6V4" />
      <path d="m3 21 7-7" />
      <path d="M4 14h6v6" />
    </SvgIcon>
  );
}

export function Maximize2(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M15 3h6v6" />
      <path d="m21 3-7 7" />
      <path d="m3 21 7-7" />
      <path d="M9 21H3v-6" />
    </SvgIcon>
  );
}

export function Pause(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <rect x="14" y="3" width="5" height="18" rx="1" />
      <rect x="5" y="3" width="5" height="18" rx="1" />
    </SvgIcon>
  );
}

export function Pencil(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
      <path d="m15 5 4 4" />
    </SvgIcon>
  );
}

export function Play(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z" />
    </SvgIcon>
  );
}

export function Plus(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </SvgIcon>
  );
}

export function Repeat(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="m17 2 4 4-4 4" />
      <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
      <path d="m7 22-4-4 4-4" />
      <path d="M21 13v1a4 4 0 0 1-4 4H3" />
    </SvgIcon>
  );
}

export function Repeat1(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="m17 2 4 4-4 4" />
      <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
      <path d="m7 22-4-4 4-4" />
      <path d="M21 13v1a4 4 0 0 1-4 4H3" />
      <path d="M11 10h1v4" />
    </SvgIcon>
  );
}

export function RotateCcw(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
    </SvgIcon>
  );
}

export function Save(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
      <path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7" />
      <path d="M7 3v4a1 1 0 0 0 1 1h7" />
    </SvgIcon>
  );
}

/**
 * 齿轮图标（标题栏「设置」入口）。
 *
 * 几何来自用户提供的 B 站风格图标（1024 视口、填充式），因此不走 `SvgIcon` 的
 * 24 视口 + 描边默认值：外框是圆角六边形，内部两圈同心圆由相反的绕向挖空。
 * 原图写死 `fill="#222429"`，这里改成 `currentColor`，让按钮的悬停/激活色生效。
 * 四个子路径必须留在同一个 `<path>` 里——拆开会让内侧轮廓从「洞」变成实心块。
 */
export function Settings({ size = 24, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 1024 1024"
      fill="currentColor"
      focusable="false"
      {...props}
    >
      <path d="M469.333333 60.693333a85.333333 85.333333 0 0 1 85.333334 0l326.826666 188.714667a85.333333 85.333333 0 0 1 42.666667 73.898667v377.386666a85.333333 85.333333 0 0 1-42.666667 73.898667L554.666667 963.306667a85.333333 85.333333 0 0 1-85.333334 0L142.506667 774.592a85.333333 85.333333 0 0 1-42.666667-73.898667v-377.386666a85.333333 85.333333 0 0 1 42.666667-73.898667z m42.666667 73.898667L185.173333 323.306667v377.386666L512 889.408l326.826667-188.714667v-377.386666L512 134.592zM512 341.333333a170.666667 170.666667 0 1 1 0 341.333334 170.666667 170.666667 0 0 1 0-341.333334z m0 85.333334a85.333333 85.333333 0 1 0 0 170.666666 85.333333 85.333333 0 0 0 0-170.666666z" />
    </svg>
  );
}

export function Shuffle(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="m18 14 4 4-4 4" />
      <path d="m18 2 4 4-4 4" />
      <path d="M2 18h1.973a4 4 0 0 0 3.3-1.7l5.454-8.6a4 4 0 0 1 3.3-1.7H22" />
      <path d="M2 6h1.972a4 4 0 0 1 3.6 2.2" />
      <path d="M22 18h-6.041a4 4 0 0 1-3.3-1.8l-.359-.45" />
    </SvgIcon>
  );
}

export function SkipBack(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M17.971 4.285A2 2 0 0 1 21 6v12a2 2 0 0 1-3.029 1.715l-9.997-5.998a2 2 0 0 1-.003-3.432z" />
      <path d="M3 20V4" />
    </SvgIcon>
  );
}

export function SkipForward(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M21 4v16" />
      <path d="M6.029 4.285A2 2 0 0 0 3 6v12a2 2 0 0 0 3.029 1.715l9.997-5.998a2 2 0 0 0 .003-3.432z" />
    </SvgIcon>
  );
}

/**
 * 五角星 + 内部垂直居中的加号（「批量导入」入口）。
 *
 * 几何：星心在 (12, 12)，内五边形上顶点 y≈8.69、下边 y≈15.84、左右内缘在 y=12.2 处约 x=8.48/15.52。
 * 加号中心 (12, 12.2)、半长 2.3，四端各留 ≥0.5 余量。
 * 笔画刻意比星形细（1.4）——18px 下加号只有约 3.5px，粗笔画会糊成一团，细笔画才能看出「十」字。
 */
export function StarPlus(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" />
      <path d="M12 9.9v4.6" stroke-width={1.4} />
      <path d="M9.7 12.2h4.6" stroke-width={1.4} />
    </SvgIcon>
  );
}

export function Trash2(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </SvgIcon>
  );
}

/**
 * 上传图标（设置里「导入备份」）。
 *
 * 几何取自 Lucide `upload`：与 `Download` 镜像，箭头向上、竖线 x=12 从 y=15 到 y=3。
 */
export function Upload(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M12 15V3" />
      <path d="m7 8 5-5 5 5" />
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    </SvgIcon>
  );
}

export function Volume2(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z" />
      <path d="M16 9a5 5 0 0 1 0 6" />
      <path d="M19.364 18.364a9 9 0 0 0 0-12.728" />
    </SvgIcon>
  );
}

export function VolumeX(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z" />
      <line x1="22" x2="16" y1="9" y2="15" />
      <line x1="16" x2="22" y1="9" y2="15" />
    </SvgIcon>
  );
}

export function X(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </SvgIcon>
  );
}
