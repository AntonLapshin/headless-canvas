/**
 * Move — MoveHandle, locked items, constraints, snap grid.
 * Resize — all 8 directions, min-size clamp, auto-sized no-op, lockRatio.
 * Rotate — offset.
 * Measure — EdgeLines / RotateValue / ResizeValue readouts during drags.
 *
 * All stories use the default styled kit; handles fade in on hover/selection.
 * Items are clamped to the canvas bounds by default (no constraints prop
 * needed) — the Move story's "constrain" toggle shows a *tightened* region.
 */

import type { Meta, StoryObj } from '@storybook/react';
import { expect, fireEvent } from '@storybook/test';
import { useState } from 'react';
import { boxStyle, dragTo, flush, getHandle, useCanvasHandle } from './helpers';
import {
  MoveHandleStyled,
  ResizeHandleStyled,
  RotateHandleStyled,
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
          <strong>Grab the move handle (top-left)</strong>
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
          'MoveHandle’s hit region is a small square at the item’s top-left corner (where the styled kit draws the move glyph) — drag by the handle, never by the body, so content inside items stays interactive. Locked items stay selectable but never move. Items can never leave the canvas: the canvas edges are the default bounds, and the `constraints` prop tightens or extends individual edges.',
      },
    },
  },
  play: async () => {
    const handle = await getHandle();
    const before = handle.getItems().find((i) => i.id === 'movable')!;
    // Grab the move handle (top-left corner of the item at (120, 90)) and drag +60/+40.
    dragTo({ x: 120, y: 90 }, { x: 180, y: 130 });
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
/* Resize with lockRatio                                               */
/* ------------------------------------------------------------------ */

function ResizeLockedDemo() {
  const ref = useCanvasHandle();
  return (
    <StyledCanvas ref={ref} width={560} height={380} aria-label="Resize locked canvas">
      <StyledItem
        id="free"
        x={90}
        y={90}
        width={180}
        height={120}
        features={<ResizeHandleStyled direction="se" />}
      >
        <div style={boxStyle}>
          <div>
            <strong>lockRatio=false</strong>
            <br />
            free resize
          </div>
        </div>
      </StyledItem>
      <StyledItem
        id="locked"
        x={320}
        y={150}
        width={180}
        height={120}
        features={<ResizeHandleStyled direction="se" lockRatio />}
      >
        <div style={{ ...boxStyle, background: '#eef2ea' }}>
          <div>
            <strong>lockRatio=true</strong>
            <br />
            3:2 always
          </div>
        </div>
      </StyledItem>
    </StyledCanvas>
  );
}

export const ResizeLocked: StoryObj<typeof moveMeta> = {
  render: () => <ResizeLockedDemo />,
  parameters: {
    docs: {
      description: {
        story:
          'ResizeHandle accepts `lockRatio`: with it on, corner handles scale proportionally from the opposite corner (the old ScaleHandle behavior) and edge handles scale the perpendicular axis around the item center — so the aspect ratio never changes. With it off, resize is free. The locked handle shows a link glyph in the styled kit.',
      },
    },
  },
  play: async () => {
    const handle = await getHandle();
    const free = handle.getItems().find((i) => i.id === 'free')!;
    const locked = handle.getItems().find((i) => i.id === 'locked')!;
    const lockedRatio = locked.height! / locked.width!;

    // Free resize: se handle at (270, 210) — drag +60/+40.
    dragTo({ x: 270, y: 210 }, { x: 330, y: 250 });
    const freeAfter = handle.getItems().find((i) => i.id === 'free')!;
    expect(freeAfter.width).toBe(free.width! + 60);
    expect(freeAfter.height).toBe(free.height! + 40);

    // Locked resize: se handle at (500, 270) — drag +60.
    dragTo({ x: 500, y: 270 }, { x: 560, y: 270 });
    const lockedAfter = handle.getItems().find((i) => i.id === 'locked')!;
    expect(lockedAfter.width).toBe(locked.width! + 60);
    expect(lockedAfter.height).toBeCloseTo(lockedAfter.width! * lockedRatio, 5);
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
          'RotateHandle sits `offset` px above the item top-center (in the styled kit, on a stem). Dragging in a circle around the item center rotates it; rotation is normalized to [0, 360). RotateValue shows the live angle while dragging.',
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

/* ------------------------------------------------------------------ */
/* Measure (readouts)                                                  */
/* ------------------------------------------------------------------ */

function MeasureDemo() {
  const ref = useCanvasHandle();
  return (
    <StyledCanvas ref={ref} width={560} height={380} aria-label="Measure canvas">
      <StyledItem id="m" x={140} y={90} width={220} height={130} features={styledFeatures}>
        <div style={boxStyle}>
          <div>
            <strong>Drag me</strong>
            <br />
            edge lines while moving · size while resizing · angle while rotating
          </div>
        </div>
      </StyledItem>
      <StyledItem id="n" x={360} y={270} width={140} height={70} features={<MoveHandleStyled />}>
        <div style={{ ...boxStyle, background: '#eef2ea' }}>neighbor</div>
      </StyledItem>
    </StyledCanvas>
  );
}

export const Measure: StoryObj<typeof moveMeta> = {
  render: () => <MeasureDemo />,
  parameters: {
    docs: {
      description: {
        story:
          'The three readout features, all headless: EdgeLines draws a measurement line from each item edge straight to the corresponding canvas edge (lines never stop at other items) with the pixel distance in the middle while moving; ResizeValue shows live width × height while resizing; RotateValue shows the live angle while rotating. Appearance (line color/width, number pills) comes entirely from the styled kit CSS.',
      },
    },
  },
  play: async () => {
    const handle = await getHandle();
    const root = document.querySelector('[data-canvas]') as HTMLElement;
    const rect = root.getBoundingClientRect();
    const pt = (x: number, y: number) => ({ clientX: rect.left + x, clientY: rect.top + y });

    // Move: pointer down on the move handle (top-left corner at (140, 90)),
    // then move — the edge-lines readout must appear mid-drag with 4 measurements.
    fireEvent.pointerDown(root, { ...pt(140, 90), pointerId: 1, buttons: 1 });
    fireEvent.pointerMove(root, { ...pt(170, 120), pointerId: 1, buttons: 1 });
    await flush();
    const lines = document.querySelector('[data-feature="edge-lines"]');
    expect(lines).toBeTruthy();
    const values = [...document.querySelectorAll('[data-edge-value]')].map((el) => el.textContent);
    expect(values.length).toBe(4);
    fireEvent.pointerUp(root, { ...pt(230, 170), pointerId: 1, buttons: 1 });
    await flush();
    expect(document.querySelector('[data-feature="edge-lines"]')).toBeNull();

    // Resize: item is now at (170, 120) 220×130 → se handle at (390, 250).
    // Drag +40/+30 → 260×160; the resize-value readout shows it mid-drag.
    fireEvent.pointerDown(root, { ...pt(390, 250), pointerId: 1, buttons: 1 });
    fireEvent.pointerMove(root, { ...pt(430, 280), pointerId: 1, buttons: 1 });
    await flush();
    const size = document.querySelector('[data-feature="resize-value"]');
    expect(size).toBeTruthy();
    expect(size?.textContent).toBe('260 × 160');
    fireEvent.pointerUp(root, { ...pt(430, 280), pointerId: 1, buttons: 1 });
    await flush();
    expect(document.querySelector('[data-feature="resize-value"]')).toBeNull();

    // Rotate: item at (170, 120) 260×160 → center (300, 200), handle at (300, 90).
    // Start angle -90°; drag straight right of center → 0° → delta +90°.
    fireEvent.pointerDown(root, { ...pt(300, 90), pointerId: 1, buttons: 1 });
    fireEvent.pointerMove(root, { ...pt(350, 200), pointerId: 1, buttons: 1 });
    await flush();
    const rot = document.querySelector('[data-feature="rotate-value"]');
    expect(rot).toBeTruthy();
    expect(rot?.textContent).toBe('90°');
    fireEvent.pointerUp(root, { ...pt(350, 200), pointerId: 1, buttons: 1 });

    const items = handle.getItems();
    expect(items.find((i) => i.id === 'm')!.width).toBe(260);
    expect(items.find((i) => i.id === 'm')!.height).toBe(160);
    expect(items.find((i) => i.id === 'm')!.rotation).toBe(90);
  },
};

/* ------------------------------------------------------------------ */
/* Interactive content                                                 */
/* ------------------------------------------------------------------ */

function ContentDemo() {
  const ref = useCanvasHandle();
  const [clicks, setClicks] = useState(0);
  const [color, setColor] = useState('default');
  return (
    <StyledCanvas ref={ref} width={560} height={380} aria-label="Content canvas">
      <StyledItem id="content" x={90} y={70} width={320} height={200} features={styledFeatures}>
        <div style={{ ...boxStyle, flexDirection: 'column', alignItems: 'stretch', gap: 8, textAlign: 'left' }}>
          <strong style={{ textAlign: 'center' }}>The item never steals events from its content</strong>
          <p style={{ margin: 0, fontSize: 13 }}>
            This text is selectable. The button and the select below work like any other DOM —
            the canvas ignores body clicks entirely (selection happens via the handles).
          </p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button type="button" onClick={() => setClicks((c) => c + 1)} style={{ padding: '4px 10px' }}>
              Clicked {clicks}×
            </button>
            <select
              value={color}
              onChange={(e) => setColor(e.target.value)}
              style={{ padding: '3px 6px' }}
              aria-label="Pick a color"
            >
              <option value="default">Default</option>
              <option value="blue">Blue</option>
              <option value="green">Green</option>
            </select>
            <span style={{ fontSize: 12 }}>select works too</span>
          </div>
        </div>
      </StyledItem>
    </StyledCanvas>
  );
}

export const Content: StoryObj<typeof moveMeta> = {
  render: () => <ContentDemo />,
  parameters: {
    docs: {
      description: {
        story:
          'Item content is fully interactive: text is selectable, buttons and selects receive their clicks untouched. The canvas ignores body clicks entirely (items are selected via handles, keyboard or the `select` API), so nothing inside an item is ever swallowed — while the handles still win at their own hit regions.',
      },
    },
  },
  play: async () => {
    const handle = await getHandle();
    const root = document.querySelector('[data-canvas]') as HTMLElement;
    const item = document.querySelector('[data-item-id="content"]') as HTMLElement;

    // The button inside the item works — the canvas does not swallow the click.
    // (Scoped to the item: the Storybook chrome renders its own buttons.)
    const button = item.querySelector('button') as HTMLButtonElement;
    fireEvent.click(button);
    await flush();
    expect(button.textContent).toBe('Clicked 1×');
    expect(item.getAttribute('data-selected')).toBe('false');

    // A pointer press on the item body is a pass-through too (no selection).
    fireEvent.pointerDown(root, { clientX: 200, clientY: 120, pointerId: 1, buttons: 1 });
    fireEvent.pointerUp(root, { clientX: 200, clientY: 120, pointerId: 1, buttons: 1 });
    await flush();
    expect(item.getAttribute('data-selected')).toBe('false');

    // The select inside the item works (its value is consumer state).
    const select = item.querySelector('select') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'blue' } });
    await flush();
    expect(select.value).toBe('blue');

    // Handles still win at their own hit region: dragging by the move handle
    // (the item's top-left corner) moves the item.
    const before = handle.getItems().find((i) => i.id === 'content')!;
    dragTo({ x: 90, y: 70 }, { x: 130, y: 100 });
    const after = handle.getItems().find((i) => i.id === 'content')!;
    expect(after.x).toBe(before.x + 40);
    expect(after.y).toBe(before.y + 30);
  },
};

/* ------------------------------------------------------------------ */
/* Measure — rotated item                                              */
/* ------------------------------------------------------------------ */

function MeasureRotatedDemo() {
  const ref = useCanvasHandle();
  return (
    <StyledCanvas ref={ref} width={560} height={380} aria-label="Measure rotated canvas">
      <StyledItem id="m" x={180} y={100} width={220} height={130} rotation={30} features={styledFeatures}>
        <div style={boxStyle}>
          <div>
            <strong>Rotated 30°</strong>
            <br />
            drag by the move handle — the edge lines stay vertical/horizontal
          </div>
        </div>
      </StyledItem>
    </StyledCanvas>
  );
}

export const MeasureRotated: StoryObj<typeof moveMeta> = {
  render: () => <MeasureRotatedDemo />,
  parameters: {
    docs: {
      description: {
        story:
          'Rotated items measure like unrotated ones: `EdgeLines` renders counter-rotated about the item center, so the measurement lines stay vertical/horizontal in canvas space (and `RotateValue`/`ResizeValue` pills stay upright) — exactly as if the item were not rotated at all. Distances are still measured from the item’s unrotated box to the canvas edges.',
      },
    },
  },
  play: async () => {
    const handle = await getHandle();
    const root = document.querySelector('[data-canvas]') as HTMLElement;
    const rect = root.getBoundingClientRect();
    const pt = (x: number, y: number) => ({ clientX: rect.left + x, clientY: rect.top + y });

    // Item at (180, 100) 220×130, rotated 30° about the center (290, 165).
    // The move handle (local (0,0)) sits at canvas (227.2, 53.7). Drag +40/+40
    // → item moves to (220, 140).
    fireEvent.pointerDown(root, { ...pt(227.2, 53.7), pointerId: 1, buttons: 1 });
    fireEvent.pointerMove(root, { ...pt(267.2, 93.7), pointerId: 1, buttons: 1 });
    await flush();
    const lines = document.querySelector('[data-feature="edge-lines"]') as HTMLElement;
    expect(lines).toBeTruthy();
    // Counter-rotated about the item center (110, 65 in the readout's own
    // local space) → the lines stay axis-aligned in canvas space.
    expect(lines.style.transform).toBe('rotate(-30deg)');
    expect(lines.style.transformOrigin).toBe('110px 65px');
    // Distances from the UNROTATED box at (220, 140) on a 560×380 canvas:
    // top 140, bottom 110, left 220, right 120.
    const values = [...document.querySelectorAll('[data-edge-value]')].map((el) => el.textContent);
    expect(values).toEqual(['140', '110', '220', '120']);
    fireEvent.pointerUp(root, { ...pt(267.2, 93.7), pointerId: 1, buttons: 1 });
    const after = handle.getItems().find((i) => i.id === 'm')!;
    expect(after.x).toBe(220);
    expect(after.y).toBe(140);
  },
};
