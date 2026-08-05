/**
 * The default styled kit — the "showcase" appearance every story uses.
 *
 * This is consumer code, exactly as the headless contract intends: the library
 * still ships zero visual styles; this file is the reference styled set that
 * stories demo (and consumers can copy). It demonstrates the three rules the
 * stories rely on:
 *
 * 1. Reserved corner positions — Move sits top-left, Resize bottom-right,
 *    Rotate above top-center. Positioning is pure CSS
 *    (`left/right/top/bottom` pins), so handles stay glued to the corners
 *    with zero JS and zero re-renders.
 * 2. Handles fade in when their item is hovered (or selected / focused).
 * 3. The visual is a SIBLING of the headless anchor, never a wrapper: the
 *    anchor is positioned in item-local coordinates, so wrapping it in a
 *    positioned div would shift it off its hit region. Siblings keep the
 *    geometric hit-testing and the pixels in the same place.
 *
 * Readouts (EdgeLines / RotateValue / ResizeValue) are styled purely through
 * the data-attribute contract — line color/width and the number pills below
 * are the "style version" of those headless features.
 *
 * Icons are heroicons (outline, MIT) inlined as SVG paths — zero dependencies.
 */

import { forwardRef } from 'react';
import { Canvas } from '../src/Canvas';
import { Item } from '../src/Item';
import {
  EdgeLines,
  MoveHandle,
  ResizeHandle,
  ResizeValue,
  RotateHandle,
  RotateValue,
} from '../src/features';
import type { CanvasHandle, CanvasProps, Direction, ItemProps } from '../src/types';

/* ------------------------------------------------------------------ */
/* Shared stylesheet (injected once per demo via <style>)              */
/* ------------------------------------------------------------------ */

export const hcStyles = `
.hc-demo {
  --hc-canvas-bg: #ffffff;
  --hc-border: #d4d4d8;
  --hc-text: #4a3f35;
  --hc-item-bg: #f3e9d8;
  --hc-item-bg-2: #e9dcc4;
  --hc-accent: #3b82f6;
  --hc-hover: #3b82f6;
  --hc-locked: #9a7bb8;
  --hc-handle-bg: #ffffff;
  --hc-handle-border: #3b82f6;
  --hc-handle-icon: #3b82f6;
  --hc-rotate-stem: #3b82f6;
}
.hc-demo[data-theme="dark"] {
  --hc-canvas-bg: #23272e;
  --hc-border: #3a4150;
  --hc-text: #e8e3d8;
  --hc-item-bg: #2b313b;
  --hc-item-bg-2: #343b47;
  --hc-accent: #60a5fa;
  --hc-hover: #60a5fa;
  --hc-locked: #c67b5c;
  --hc-handle-bg: #2f3540;
  --hc-handle-border: #60a5fa;
  --hc-handle-icon: #60a5fa;
  --hc-rotate-stem: #60a5fa;
}

/* ---- canvas chrome: flat white stage, gray frame, no rounding/shadow ---- */
.hc-demo [data-canvas] {
  border: 1px solid var(--hc-border);
  background: var(--hc-canvas-bg);
  transition: background 0.2s ease, border-color 0.2s ease;
}

/* ---- items: selection / hover / locked / disabled rings ---- */
.hc-demo .hc-item {
  transition: box-shadow 0.15s ease;
}
.hc-demo [data-item-id] { outline: none; }
.hc-demo [data-item-id]:focus-visible {
  outline: 2px solid var(--hc-accent);
  outline-offset: 2px;
}
.hc-demo [data-selected="true"] { box-shadow: 0 0 0 2px var(--hc-accent); }
.hc-demo [data-hovered="true"] { box-shadow: 0 0 0 2px var(--hc-hover); }
.hc-demo [data-selected="true"][data-hovered="true"] { box-shadow: 0 0 0 2px var(--hc-accent); }
.hc-demo [data-locked="true"] { opacity: 0.72; }
.hc-demo [data-locked="true"][data-selected="true"] { box-shadow: 0 0 0 2px var(--hc-locked); }
.hc-demo [data-disabled="true"] { opacity: 0.6; filter: saturate(0.55); }

/* ---- handles: hidden until hovered / selected / focused ---- */
.hc-demo .hc-handle {
  position: absolute;
  width: 18px;
  height: 18px;
  border-radius: 6px;
  background: var(--hc-handle-bg);
  border: 1.5px solid var(--hc-handle-border);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.18);
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--hc-handle-icon);
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.12s ease;
}
.hc-demo .hc-handle svg { width: 13px; height: 13px; }
.hc-demo [data-selected="true"] .hc-handle,
.hc-demo [data-hovered="true"] .hc-handle,
.hc-demo .hc-item:focus-within .hc-handle { opacity: 1; }
.hc-demo [data-locked="true"] .hc-handle { opacity: 0.35; }
.hc-demo [data-disabled="true"] .hc-handle { opacity: 0; }

/* ---- reserved corner positions ---- */
.hc-demo .hc-handle--move { left: -9px; top: -9px; } /* top-left */
.hc-demo .hc-handle--resize { right: -9px; bottom: -9px; } /* bottom-right */
.hc-demo .hc-handle--rotate {
  left: 50%;
  top: -30px;
  transform: translate(-50%, -50%);
  border-radius: 50%;
}
.hc-demo .hc-handle--rotate::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 100%;
  width: 1.5px;
  height: 21px;
  background: var(--hc-rotate-stem);
  transform: translateX(-50%);
  opacity: 0.6;
}

/* ---- resize direction variants (the all-8-directions story) ---- */
.hc-demo .hc-handle--d-n { left: 50%; top: -9px; transform: translateX(-50%); }
.hc-demo .hc-handle--d-s { left: 50%; bottom: -9px; transform: translateX(-50%); }
.hc-demo .hc-handle--d-e { right: -9px; top: 50%; transform: translateY(-50%); }
.hc-demo .hc-handle--d-w { left: -9px; top: 50%; transform: translateY(-50%); }
.hc-demo .hc-handle--d-ne { right: -9px; top: -9px; }
.hc-demo .hc-handle--d-nw { left: -9px; top: -9px; }
.hc-demo .hc-handle--d-se { right: -9px; bottom: -9px; }
.hc-demo .hc-handle--d-sw { left: -9px; bottom: -9px; }

/* ---- measurement readouts (Figma-style) ---- */
.hc-demo [data-feature="edge-lines"] {
  --hc-edge-thickness: 2px; /* the "width of the line" — style-owned */
  color: var(--hc-measure-line, #e5484d);
}
.hc-demo [data-edge-line] { background: currentColor; }
.hc-demo [data-edge-value] {
  background: var(--hc-measure-pill, #2b2735);
  color: #fff;
  font: 600 11px/1.2 system-ui, sans-serif;
  padding: 2px 6px;
  border-radius: 4px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
  letter-spacing: 0.2px;
}
/* Rotate/Resize values reuse the edge-value pill (their span carries
   data-edge-value); only the container's centering stays here. */
.hc-demo [data-feature="rotate-value"] { transform: translate(-50%, -50%); }
.hc-demo [data-feature="resize-value"] { transform: translate(-50%, -50%); }

/* ---- shared demo text ---- */
.hc-demo .hc-label {
  font-family: system-ui, sans-serif;
  font-size: 13px;
  color: var(--hc-text);
}
`;

/* ------------------------------------------------------------------ */
/* Icons (heroicons outline, inlined — MIT)                            */
/* ------------------------------------------------------------------ */

type IconProps = { size?: number };

function makeIcon(path: string) {
  return function Icon({ size = 13 }: IconProps) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        width={size}
        height={size}
        aria-hidden="true"
        focusable="false"
      >
        <path d={path} />
      </svg>
    );
  };
}

/** heroicons arrows-pointing-out — the classic 4-way move glyph. */
const MoveIcon = makeIcon(
  'M3.75 3.75V8.25M3.75 3.75H8.25M3.75 3.75L9 9M3.75 20.25V15.75M3.75 20.25H8.25M3.75 20.25L9 15M20.25 3.75L15.75 3.75M20.25 3.75V8.25M20.25 3.75L15 9M20.25 20.25H15.75M20.25 20.25V15.75M20.25 20.25L15 15',
);
/** heroicons arrows-pointing-in — arrows into the corners = resize. */
const ResizeIcon = makeIcon(
  'M9 9L9 4.5M9 9L4.5 9M9 9L3.75 3.75M9 15L9 19.5M9 15L4.5 15M9 15L3.75 20.25M15 9H19.5M15 9V4.5M15 9L20.25 3.75M15 15H19.5M15 15L15 19.5M15 15L20.25 20.25',
);
/** heroicons link — shown when a resize handle has lockRatio. */
const LockIcon = makeIcon(
  'M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244',
);
/** heroicons arrow-path — circular arrows = rotate. */
const RotateIcon = makeIcon(
  'M16.0228 9.34841H21.0154V9.34663M2.98413 19.6444V14.6517M2.98413 14.6517L7.97677 14.6517M2.98413 14.6517L6.16502 17.8347C7.15555 18.8271 8.41261 19.58 9.86436 19.969C14.2654 21.1483 18.7892 18.5364 19.9685 14.1353M4.03073 9.86484C5.21 5.46374 9.73377 2.85194 14.1349 4.03121C15.5866 4.4202 16.8437 5.17312 17.8342 6.1655L21.0154 9.34663M21.0154 4.3558V9.34663',
);

/* ------------------------------------------------------------------ */
/* Styled components                                                   */
/* ------------------------------------------------------------------ */

export interface StyledCanvasProps extends Omit<CanvasProps, 'ref'> {
  /** Consumer theme — plain CSS variables, no library involvement. */
  theme?: 'light' | 'dark';
}

/**
 * `<Canvas>` wrapped in the demo chrome (canvas frame + theme variables +
 * the kit stylesheet). Everything else is still the headless `<Canvas>`.
 */
export const StyledCanvas = forwardRef<CanvasHandle, StyledCanvasProps>(function StyledCanvas(
  { theme = 'light', className, children, ...rest },
  ref,
) {
  return (
    <div className="hc-demo" data-theme={theme}>
      <style>{hcStyles}</style>
      <Canvas ref={ref} className={className} {...rest}>
        {children}
      </Canvas>
    </div>
  );
});

/** `<Item>` with the kit's item class (selection/hover rings). */
export function StyledItem(props: ItemProps) {
  const { className, ...rest } = props;
  return <Item className={`hc-item${className ? ` ${className}` : ''}`} {...rest} />;
}

/**
 * Styled handles: the icon is a SIBLING of the headless anchor, positioned by
 * CSS at the reserved corner. Never wrap the anchor in a positioned div — the
 * anchor is placed in item-local coordinates, so a wrapper would shift it off
 * its hit region (the two would diverge and the handle would feel dead).
 */
export const MoveHandleStyled = () => (
  <>
    <div className="hc-handle hc-handle--move" aria-hidden="true">
      <MoveIcon />
    </div>
    <MoveHandle />
  </>
);

export const ResizeHandleStyled = ({
  direction = 'se',
  lockRatio = false,
}: {
  direction?: Direction;
  lockRatio?: boolean;
}) => (
  <>
    <div
      className={`hc-handle hc-handle--resize hc-handle--d-${direction}${lockRatio ? ' hc-handle--locked' : ''}`}
      aria-hidden="true"
    >
      {lockRatio ? <LockIcon /> : <ResizeIcon />}
    </div>
    <ResizeHandle direction={direction} lockRatio={lockRatio} />
  </>
);

export const RotateHandleStyled = ({ offset = 30 }: { offset?: number }) => (
  <>
    <div className="hc-handle hc-handle--rotate" style={{ top: -offset }} aria-hidden="true">
      <RotateIcon />
    </div>
    <RotateHandle offset={offset} />
  </>
);

/* ---- styled readouts (headless features + the kit's measurement CSS) ---- */

/** Edge measurement lines while moving (Figma-style red lines + dark pills). */
export const EdgeLinesStyled = () => <EdgeLines />;

/** Live rotation angle while rotating. */
export const RotateValueStyled = () => <RotateValue />;

/** Live width × height while resizing. */
export const ResizeValueStyled = () => <ResizeValue />;

/** The full affordance set: move (TL) + resize (BR) + rotate + readouts. */
export const styledFeatures = (
  <>
    <MoveHandleStyled />
    <ResizeHandleStyled />
    <RotateHandleStyled />
    <EdgeLinesStyled />
    <RotateValueStyled />
    <ResizeValueStyled />
  </>
);
