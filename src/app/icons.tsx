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

export function Headphones(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3" />
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
