/**
 * Move — MoveHandle, locked items, constraints, snap grid.
 * Resize — all 8 directions, min-size clamp, auto-sized no-op.
 * Scale — anchor se vs center.
 * Rotate — offset.
 *
 * All stories use the default styled kit; handles fade in on hover/selection.
 * Items are clamped to the canvas bounds by default (no constraints prop
 * needed) — the Move story's "constrain" toggle shows a *tightened* region.
 */

import type { Meta, StoryObj } from '@storybook/react';
import { expect } from '@storybook/test';
import { boxStyle, dragTo, getHandle, useCanvasHandle } from './helpers';
import {
  MoveHandleStyled,
  ResizeHandleStyled,
  RotateHandleStyled,
  ScaleHandleStyled,
  StyledCanvas,
  StyledItem,
  styledFeatures,
} from './styled';

/* ------------------------------------------------------------------ */
/* Move                                                                */
/* ------------------------------------------------------------------ */

function MoveDemo(props: { snapToGrid?: number; constrain?: boolean; locked?: boolean }) {
  const ref = useCanvasHandle();
  return (
    <StyledCanvas
      ref={ref}
      width={560}
      height={380}
      snapToGrid={props.snapToGrid || undefined}
      constraints={props.constrain ? { minX: 20, minY: 20, maxX: 540, maxY: 360 } : undefined}
      aria-label="Move canvas"
    >
      <StyledItem id="movable" x={120} y={90} width={220} height={110} features={styledFeatures}>
        <div style={boxStyle}>
          <strong>Grab anywhere to move</strong>
        </div>
      </StyledItem>
      <StyledItem id="locked" x={340} y={230} width={160} height={80} locked features={<MoveHandleStyled />}>
        <div style={{ ...boxStyle, background: '#ece5f5' }}>
          <div>
            <strong>Locked</strong>
            <br />
            selectable, not movable
          </div>
        </div>
      </StyledItem>
    </StyledCanvas>
  );
}

const moveMeta = {
  title: 'Interactions',
  component: MoveDemo,
  args: { snapToGrid: 0, constrain: false, locked: false },
  argTypes: {
    snapToGrid: { control: { type: 'number' }, description: 'Snap grid (0 = off)' },
    constrain: {
      control: { type: 'boolean' },
      description: 'Tighten the bounds to a 20px inset (canvas edges are the default bounds)',
    },
    locked: { control: { type: 'boolean' }, description: 'Lock the movable item' },
  },
} satisfies Meta<typeof MoveDemo>;

export default moveMeta;
type MoveStory = StoryObj<typeof moveMeta>;

export const Move: MoveStory = {
  parameters: {
    docs: {
      description: {
        story:
          'MoveHandle\'s hit region covers the whole item body — grab anywhere to drag. Locked items stay selectable but never move. Items can never leave the canvas: the canvas edges are the default bounds, and the `constraints` prop tightens or extends individual edges.',
      },
    },
  },
  play: async () => {
    const handle = await getHandle();
    const before = handle.getItems().find((i) => i.id === 'movable')!;
    // Grab the item body (the MoveHandle hit region covers it) and drag +60/+40.
    dragTo({ x: 180, y: 130 }, { x: 240, y: 170 });
    const after = handle.getItems().find((i) => i.id === 'movable')!;
    expect(after.x).toBe(before.x + 60);
    expect(after.y).toBe(before.y + 40);
    // The locked item did not move.
    const locked = handle.getItems().find((i) => i.id === 'locked')!;
    expect(locked.x).toBe(340);
    expect(locked.y).toBe(230);
  },
};

/* ------------------------------------------------------------------ */
/* Resize                                                              */
/* ------------------------------------------------------------------ */

function ResizeDemo() {
  const ref = useCanvasHandle();
  const directions = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const;
  return (
    <StyledCanvas ref={ref} width={560} height={380} aria-label="Resize canvas">
      <StyledItem
        id="full"
        x={140}
        y={80}
        width={260}
        height={150}
        features={
          <>
            {directions.map((d) => (
              <ResizeHandleStyled key={d} direction={d} />
            ))}
          </>
        }
      >
        <div style={boxStyle}>
          <div>
            <strong>All 8 resize handles</strong>
            <br />
            min size 8 · n/w keep opposite edges fixed
          </div>
        </div>
      </StyledItem>
      <StyledItem id="auto" x={360} y={270} features={<ResizeHandleStyled direction="se" />}>
        <div style={{ ...boxStyle, width: 140, height: 50, background: '#f7e8e0' }}>
          auto-sized: resize is a no-op
        </div>
      </StyledItem>
    </StyledCanvas>
  );
}

export const Resize: StoryObj<typeof moveMeta> = {
  render: () => <ResizeDemo />,
  parameters: {
    docs: {
      description: {
        story:
          'ResizeHandle accepts direction n/s/e/w/ne/nw/se/sw. Handles on the north/west sides keep the opposite edge fixed. Auto-sized items (no explicit width/height) cannot be resized until given dimensions — documented no-op. Growth is clamped to the canvas edges.',
      },
    },
  },
  play: async () => {
    const handle = await getHandle();
    // Item at (140, 80) 260×150; the se handle hit square is around (400, 230).
    const before = handle.getItems().find((i) => i.id === 'full')!;
    dragTo({ x: 400, y: 230 }, { x: 440, y: 270 });
    const after = handle.getItems().find((i) => i.id === 'full')!;
    expect(after.width).toBe(before.width! + 40);
    expect(after.height).toBe(before.height! + 40);
    // Auto-sized item keeps its measured size (drag its corner).
    const autoBefore = handle.getItems().find((i) => i.id === 'auto')!;
    const autoEl = document.querySelector('[data-item-id="auto"]') as HTMLElement;
    const rect = autoEl.getBoundingClientRect();
    const root = document.querySelector('[data-canvas]') as HTMLElement;
    const rootRect = root.getBoundingClientRect();
    dragTo(
      { x: rect.left - rootRect.left + rect.width, y: rect.top - rootRect.top + rect.height },
      { x: rect.left - rootRect.left + rect.width + 40, y: rect.top - rootRect.top + rect.height + 40 },
    );
    const autoAfter = handle.getItems().find((i) => i.id === 'auto')!;
    expect(autoAfter.width).toBe(autoBefore.width);
    expect(autoAfter.height).toBe(autoBefore.height);
  },
};

/* ------------------------------------------------------------------ */
/* Scale                                                               */
/* ------------------------------------------------------------------ */

function ScaleDemo() {
  const ref = useCanvasHandle();
  return (
    <StyledCanvas ref={ref} width={560} height={380} aria-label="Scale canvas">
      <StyledItem id="se" x={90} y={90} width={180} height={120} features={<ScaleHandleStyled anchor="se" />}>
        <div style={boxStyle}>
          <div>
            <strong>anchor="se"</strong>
            <br />× ratio kept
          </div>
        </div>
      </StyledItem>
      <StyledItem
        id="center"
        x={330}
        y={150}
        width={160}
        height={110}
        features={<ScaleHandleStyled anchor="center" />}
      >
        <div style={{ ...boxStyle, background: '#eef2ea' }}>
          <div>
            <strong>anchor="center"</strong>
            <br />
            center stays fixed
          </div>
        </div>
      </StyledItem>
    </StyledCanvas>
  );
}

export const Scale: StoryObj<typeof moveMeta> = {
  render: () => <ScaleDemo />,
  parameters: {
    docs: {
      description: {
        story:
          'ScaleHandle scales proportionally (newH = newW × h/w). The default anchor is ne (top-right, the reserved scale position); anchor="se" keeps the top-left corner fixed, anchor="center" keeps the item center fixed. All corners (nw/ne/sw/se) are supported. Growth is clamped to the canvas edges.',
      },
    },
  },
  play: async () => {
    const handle = await getHandle();
    const se = handle.getItems().find((i) => i.id === 'se')!;
    const ratio = se.height! / se.width!;
    // se handle at (270, 210) — drag +60.
    dragTo({ x: 270, y: 210 }, { x: 330, y: 210 });
    const seAfter = handle.getItems().find((i) => i.id === 'se')!;
    expect(seAfter.width).toBe(240);
    expect(seAfter.height).toBeCloseTo(240 * ratio, 5);

    const center = handle.getItems().find((i) => i.id === 'center')!;
    const cx = center.x + center.width! / 2;
    const cy = center.y + center.height! / 2;
    // center handle at (410, 205) — drag +50.
    dragTo({ x: 410, y: 205 }, { x: 460, y: 205 });
    const centerAfter = handle.getItems().find((i) => i.id === 'center')!;
    expect(centerAfter.x + centerAfter.width! / 2).toBeCloseTo(cx, 5);
    expect(centerAfter.y + centerAfter.height! / 2).toBeCloseTo(cy, 5);
  },
};

/* ------------------------------------------------------------------ */
/* Rotate                                                              */
/* ------------------------------------------------------------------ */

function RotateDemo() {
  const ref = useCanvasHandle();
  return (
    <StyledCanvas ref={ref} width={560} height={380} aria-label="Rotate canvas">
      <StyledItem
        id="r24"
        x={140}
        y={110}
        width={220}
        height={120}
        features={<RotateHandleStyled offset={24} />}
      >
        <div style={boxStyle}>
          <div>
            <strong>RotateHandle</strong>
            <br />
            offset 24 · drag in a circle
          </div>
        </div>
      </StyledItem>
      <StyledItem
        id="r48"
        x={330}
        y={250}
        width={160}
        height={80}
        features={<RotateHandleStyled offset={48} />}
      >
        <div style={{ ...boxStyle, background: '#eef2ea' }}>offset 48</div>
      </StyledItem>
    </StyledCanvas>
  );
}

export const Rotate: StoryObj<typeof moveMeta> = {
  render: () => <RotateDemo />,
  parameters: {
    docs: {
      description: {
        story:
          'RotateHandle sits `offset` px above the item top-center (in the styled kit, on a stem). Dragging in a circle around the item center rotates it; rotation is normalized to [0, 360).',
      },
    },
  },
  play: async () => {
    const handle = await getHandle();
    // Item at (140, 110) 220×120 → center (250, 170), handle at (250, 86).
    // Start angle -90°; drag straight right of center → angle 0° → delta +90°.
    dragTo({ x: 250, y: 86 }, { x: 350, y: 170 });
    const after = handle.getItems().find((i) => i.id === 'r24')!;
    expect(after.rotation).toBe(90);
  },
};
