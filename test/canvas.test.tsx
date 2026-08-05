/**
 * Component + interaction tests: pointer drags, selection, keyboard, a11y,
 * controlled/uncontrolled modes, disabled/locked behavior, ref handle.
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Canvas } from '../src/Canvas';
import { Item } from '../src/Item';
import { EdgeLines, MoveHandle, ResizeHandle, RotateHandle, RotateValue, ResizeValue } from '../src/features';
import styles from '../src/canvas.module.scss';
import type { CanvasHandle, ItemGeometry } from '../src/types';
import { emitResize } from './setup';
import { drag, renderCanvas } from './helpers';

/** Small fixture: two items with move + resize handles. */
function Fixture(props: {
  onSelect?: (id: string | null) => void;
  canvasRef?: React.Ref<CanvasHandle>;
  onItemsChange?: (items: ItemGeometry[]) => void;
  disabled?: boolean;
  snapToGrid?: number;
  constraints?: { maxX: number; maxY: number };
  onDragStart?: (id: string, kind: string) => void;
  onDragEnd?: (id: string, kind: string) => void;
  onItemDoubleClick?: (id: string) => void;
}) {
  return (
    <Canvas
      width={400}
      height={300}
      ref={props.canvasRef}
      onSelect={props.onSelect}
      onItemsChange={props.onItemsChange}
      disabled={props.disabled}
      snapToGrid={props.snapToGrid}
      constraints={props.constraints}
      onDragStart={props.onDragStart as never}
      onDragEnd={props.onDragEnd as never}
      onItemDoubleClick={props.onItemDoubleClick}
      aria-label="Test canvas"
    >
      <Item
        id="a"
        x={100}
        y={50}
        width={200}
        height={100}
        features={
          <>
            <MoveHandle />
            <ResizeHandle direction="se" />
          </>
        }
      >
        <span>A</span>
      </Item>
      <Item id="b" x={20} y={20} width={60} height={40}>
        <span>B</span>
      </Item>
    </Canvas>
  );
}

/** Capture a canvas handle via callback ref. */
function makeRef() {
  const holder: { current: CanvasHandle | null } = { current: null };
  return {
    holder,
    ref: (h: CanvasHandle | null) => {
      holder.current = h;
    },
  };
}

/** Wait for any throttled (rAF/setTimeout) callbacks to flush. */
async function flushAsync() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 25));
  });
}

describe('rendering & data attributes', () => {
  it('renders the canvas root with role=group and aria-label', () => {
    const { root } = renderCanvas(<Fixture />);
    expect(root).toHaveAttribute('data-canvas');
    expect(root).toHaveAttribute('role', 'group');
    expect(root).toHaveAttribute('aria-label', 'Test canvas');
  });

  it('renders item wrappers with the data-attribute contract', () => {
    render(<Fixture />);
    const itemA = screen.getByText('A').closest('[data-item-id="a"]') as HTMLElement;
    expect(itemA).toHaveAttribute('data-item-id', 'a');
    expect(itemA).toHaveAttribute('data-selected', 'false');
    expect(itemA).toHaveAttribute('data-hovered', 'false');
    expect(itemA).toHaveAttribute('data-locked', 'false');
    expect(itemA).toHaveAttribute('data-disabled', 'false');
    expect(itemA).toHaveAttribute('tabindex', '0');
    expect(itemA).toHaveAttribute('aria-selected', 'false');
    expect(itemA.style.left).toBe('100px');
    expect(itemA.style.top).toBe('50px');
    expect(itemA.style.width).toBe('200px');
    expect(itemA.style.height).toBe('100px');
  });

  it('renders feature anchors with data-feature + data-direction, no visuals', () => {
    render(<Fixture />);
    const move = document.querySelector('[data-feature="move"]') as HTMLElement;
    const resize = document.querySelector('[data-feature="resize"]') as HTMLElement;
    expect(move).toBeTruthy();
    expect(resize).toHaveAttribute('data-direction', 'se');
    // Anchors carry no consumer-visible classes of their own — only the
    // library's structural `.feature` module class.
    expect(resize).toHaveClass(styles.feature);
    expect(move).toHaveClass(styles.feature);
    expect(resize.className).toBe(styles.feature);
  });
});

describe('selection', () => {
  it('ignores body clicks (the content owns them) and deselects on empty click', () => {
    const onSelect = vi.fn();
    const { root } = renderCanvas(<Fixture onSelect={onSelect} />);
    // A click on the item body is deliberately ignored: no selection, no drag.
    fireEvent.pointerDown(root, { clientX: 150, clientY: 75, pointerId: 1, buttons: 1 });
    expect(onSelect).not.toHaveBeenCalled();
    const itemA = screen.getByText('A').closest('[data-item-id="a"]') as HTMLElement;
    expect(itemA).toHaveAttribute('data-selected', 'false');
    // Empty space still deselects.
    fireEvent.pointerDown(root, { clientX: 5, clientY: 5, pointerId: 1, buttons: 1 });
    expect(onSelect).toHaveBeenLastCalledWith(null);
  });

  it('selects via the move handle', () => {
    const onSelect = vi.fn();
    const { root } = renderCanvas(<Fixture onSelect={onSelect} />);
    // MoveHandle hit region is a 20×20 square around local (0,0) → canvas (90..110, 40..60).
    fireEvent.pointerDown(root, { clientX: 100, clientY: 50, pointerId: 1, buttons: 1 });
    expect(onSelect).toHaveBeenLastCalledWith('a');
    const itemA = screen.getByText('A').closest('[data-item-id="a"]') as HTMLElement;
    expect(itemA).toHaveAttribute('data-selected', 'true');
  });

  it('fires onItemDoubleClick with the hit item id', () => {
    const onItemDoubleClick = vi.fn();
    const { root } = renderCanvas(<Fixture onItemDoubleClick={onItemDoubleClick} />);
    fireEvent.doubleClick(root, { clientX: 150, clientY: 75 });
    expect(onItemDoubleClick).toHaveBeenCalledWith('a');
  });
});

describe('z-order (selected item on top)', () => {
  it('gives the selected item the highest z-index, transiently (store untouched)', () => {
    const { holder, ref } = makeRef();
    renderCanvas(<Fixture canvasRef={ref} />);
    const itemA = screen.getByText('A').closest('[data-item-id="a"]') as HTMLElement;
    const itemB = screen.getByText('B').closest('[data-item-id="b"]') as HTMLElement;
    // Unselected: no inline z-index (mount order rules).
    expect(itemA.style.zIndex).toBe('');
    expect(itemB.style.zIndex).toBe('');
    // Select a (mount order 0) while b is later (mount order 1) → a jumps above.
    act(() => holder.current!.select('a'));
    expect(itemA.style.zIndex).toBe('2'); // max(0, 1) + 1
    expect(itemB.style.zIndex).toBe('');
    // Deselect → the transient bump disappears and the store never changed.
    act(() => holder.current!.select(null));
    expect(itemA.style.zIndex).toBe('');
    expect(holder.current!.getItems().find((i) => i.id === 'a')!.zIndex).toBeUndefined();
  });

  it('the selected item wins hit-testing even when another item covers it', () => {
    const { holder, ref } = makeRef();
    renderCanvas(
      <Canvas width={400} height={300} ref={ref} aria-label="z hit canvas">
        <Item id="bottom" x={100} y={50} width={200} height={100} features={<MoveHandle />}>
          <span>BOTTOM</span>
        </Item>
        <Item id="top" x={150} y={80} width={120} height={80} features={<MoveHandle />}>
          <span>TOP</span>
        </Item>
      </Canvas>,
    );
    const overlap = { x: 200, y: 120 }; // inside both items
    // No selection → the DOM-topmost item wins.
    fireEvent.pointerMove(document.querySelector('[data-canvas]')!, {
      clientX: overlap.x,
      clientY: overlap.y,
      buttons: 0,
    });
    expect(document.querySelector('[data-item-id="top"]')).toHaveAttribute('data-hovered', 'true');
    expect(document.querySelector('[data-item-id="bottom"]')).toHaveAttribute('data-hovered', 'false');
    // Select the covered item → it becomes topmost for hit-testing.
    act(() => holder.current!.select('bottom'));
    fireEvent.pointerMove(document.querySelector('[data-canvas]')!, {
      clientX: overlap.x,
      clientY: overlap.y,
      buttons: 0,
    });
    expect(document.querySelector('[data-item-id="bottom"]')).toHaveAttribute('data-hovered', 'true');
    expect(document.querySelector('[data-item-id="top"]')).toHaveAttribute('data-hovered', 'false');
  });
});

describe('move drag', () => {
  it('moves the item by the pointer delta', async () => {
    const onItemsChange = vi.fn();
    const { holder, ref } = makeRef();
    const { root } = renderCanvas(<Fixture canvasRef={ref} onItemsChange={onItemsChange} />);
    // Grab the move handle (top-left corner at (100, 50)) and drag +20/+20.
    drag(root, { x: 100, y: 50 }, { x: 120, y: 70 });
    const items = holder.current!.getItems();
    const a = items.find((i) => i.id === 'a')!;
    expect(a.x).toBe(120);
    expect(a.y).toBe(70);
    // final exact payload fired on pointerup
    expect(onItemsChange).toHaveBeenLastCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: 'a', x: 120, y: 70 })]),
    );
    await flushAsync();
  });

  it('does not move on a body drag — the body is not a move region', () => {
    const { holder, ref } = makeRef();
    const { root } = renderCanvas(<Fixture canvasRef={ref} />);
    drag(root, { x: 150, y: 75 }, { x: 170, y: 95 });
    const a = holder.current!.getItems().find((i) => i.id === 'a')!;
    expect(a.x).toBe(100);
    expect(a.y).toBe(50);
  });

  it('fires onDragStart/onDragEnd with the drag kind', () => {
    const onDragStart = vi.fn();
    const onDragEnd = vi.fn();
    const { root } = renderCanvas(<Fixture onDragStart={onDragStart} onDragEnd={onDragEnd} />);
    drag(root, { x: 100, y: 50 }, { x: 110, y: 55 });
    expect(onDragStart).toHaveBeenCalledWith('a', 'move');
    expect(onDragEnd).toHaveBeenCalledWith('a', 'move');
  });

  it('respects snapToGrid on both axes', () => {
    const { holder, ref } = makeRef();
    const { root } = renderCanvas(<Fixture canvasRef={ref} snapToGrid={50} />);
    drag(root, { x: 100, y: 50 }, { x: 123, y: 66 }); // dx 23, dy 16
    const a = holder.current!.getItems().find((i) => i.id === 'a')!;
    expect(a.x).toBe(100); // 123 → 100 (snap to 50)
    expect(a.y).toBe(50); // 66 → 50
  });

  it('clamps to constraints', () => {
    const { holder, ref } = makeRef();
    const { root } = renderCanvas(<Fixture canvasRef={ref} constraints={{ maxX: 380, maxY: 280 }} />);
    drag(root, { x: 100, y: 50 }, { x: 350, y: 250 });
    const a = holder.current!.getItems().find((i) => i.id === 'a')!;
    expect(a.x).toBe(180); // right edge may not pass 380
    expect(a.y).toBe(180);
  });

  it('clamps to the canvas bounds by default (no constraints prop)', () => {
    const { holder, ref } = makeRef();
    const { root } = renderCanvas(<Fixture canvasRef={ref} />);
    // Item a is 200×100 at (100, 50) on a 400×300 canvas → x ≤ 200, y ≤ 200.
    drag(root, { x: 100, y: 50 }, { x: 550, y: 350 });
    const a = holder.current!.getItems().find((i) => i.id === 'a')!;
    expect(a.x).toBe(200);
    expect(a.y).toBe(200);
    expect(a.x + a.width!).toBe(400); // right edge flush with the canvas
    expect(a.y + a.height!).toBe(300); // bottom edge flush with the canvas
  });

  it('does not move a locked item, but still selects it', () => {
    const onSelect = vi.fn();
    const { holder, ref } = makeRef();
    const { root } = renderCanvas(
      <Canvas width={400} height={300} ref={ref} onSelect={onSelect} aria-label="locked canvas">
        <Item id="l" x={100} y={50} width={200} height={100} locked features={<MoveHandle />}>
          <span>L</span>
        </Item>
      </Canvas>,
    );
    drag(root, { x: 100, y: 50 }, { x: 200, y: 100 });
    const l = holder.current!.getItems()[0];
    expect(l.x).toBe(100);
    expect(l.y).toBe(50);
    expect(onSelect).toHaveBeenCalledWith('l');
  });
});

describe('resize drag', () => {
  it('resizes from the se handle, keeping x/y', () => {
    const { holder, ref } = makeRef();
    const { root } = renderCanvas(<Fixture canvasRef={ref} />);
    // se handle hit region is a 20×20 square around local (200, 100) → canvas (300, 150)
    drag(root, { x: 300, y: 150 }, { x: 350, y: 180 });
    const a = holder.current!.getItems().find((i) => i.id === 'a')!;
    expect(a.x).toBe(100);
    expect(a.y).toBe(50);
    expect(a.width).toBe(250);
    expect(a.height).toBe(130);
  });

  it('nw resize keeps the opposite corner fixed', () => {
    const { holder, ref } = makeRef();
    const { root } = renderCanvas(
      <Canvas width={400} height={300} ref={ref} aria-label="nw canvas">
        <Item id="a" x={100} y={50} width={200} height={100} features={<ResizeHandle direction="nw" />}>
          <span>A</span>
        </Item>
      </Canvas>,
    );
    drag(root, { x: 100, y: 50 }, { x: 80, y: 40 }); // dx -20, dy -10
    const a = holder.current!.getItems()[0];
    expect(a.width).toBe(220);
    expect(a.height).toBe(110);
    expect(a.x + a.width!).toBe(300); // right edge fixed
    expect(a.y + a.height!).toBe(150); // bottom edge fixed
  });

  it('clamps to min size', () => {
    const { holder, ref } = makeRef();
    const { root } = renderCanvas(<Fixture canvasRef={ref} />);
    // Drag the se corner far past the top-left: dx -200, dy -100 → min sizes.
    drag(root, { x: 300, y: 150 }, { x: 100, y: 50 });
    const a = holder.current!.getItems().find((i) => i.id === 'a')!;
    expect(a.width).toBe(8);
    expect(a.height).toBe(8);
  });

  it('clamps resize growth to the canvas bounds by default', () => {
    const { holder, ref } = makeRef();
    const { root } = renderCanvas(<Fixture canvasRef={ref} />);
    // se drag far past the right/bottom edges: width capped at maxX - x = 300,
    // height capped at maxY - y = 250.
    drag(root, { x: 300, y: 150 }, { x: 500, y: 400 });
    const a = holder.current!.getItems().find((i) => i.id === 'a')!;
    expect(a.width).toBe(300);
    expect(a.height).toBe(250);
    expect(a.x + a.width!).toBe(400);
    expect(a.y + a.height!).toBe(300);
  });
});

describe('resize with lockRatio', () => {
  it('se corner keeps the aspect ratio, top-left fixed', () => {
    const { holder, ref } = makeRef();
    const { root } = renderCanvas(
      <Canvas width={400} height={300} ref={ref} aria-label="locked resize canvas">
        <Item id="a" x={100} y={50} width={200} height={100} features={<ResizeHandle direction="se" lockRatio />}>
          <span>A</span>
        </Item>
      </Canvas>,
    );
    // se handle at (300, 150); drag +50 wide → width 250, height 125 (ratio 0.5).
    drag(root, { x: 300, y: 150 }, { x: 350, y: 150 });
    const a = holder.current!.getItems()[0];
    expect(a.width).toBe(250);
    expect(a.height).toBe(125);
    expect(a.x).toBe(100);
    expect(a.y).toBe(50);
  });

  it('ne corner keeps the bottom-left corner fixed', () => {
    const { holder, ref } = makeRef();
    const { root } = renderCanvas(
      <Canvas width={400} height={300} ref={ref} aria-label="locked ne canvas">
        <Item id="a" x={100} y={50} width={200} height={100} features={<ResizeHandle direction="ne" lockRatio />}>
          <span>A</span>
        </Item>
      </Canvas>,
    );
    // ne handle at (300, 50); drag +50 → width 250, height 125; bottom edge stays at 150.
    drag(root, { x: 300, y: 50 }, { x: 350, y: 50 });
    const a = holder.current!.getItems()[0];
    expect(a.width).toBe(250);
    expect(a.height).toBe(125);
    expect(a.x).toBe(100);
    expect(a.y).toBe(25); // bottom edge fixed at 150 → top moves up
  });

  it('e edge keeps the vertical center fixed', () => {
    const { holder, ref } = makeRef();
    const { root } = renderCanvas(
      <Canvas width={400} height={300} ref={ref} aria-label="locked e canvas">
        <Item id="a" x={100} y={50} width={200} height={100} features={<ResizeHandle direction="e" lockRatio />}>
          <span>A</span>
        </Item>
      </Canvas>,
    );
    // e handle at (300, 100); drag +40 → width 240, height 120, y centered at 40.
    drag(root, { x: 300, y: 100 }, { x: 340, y: 100 });
    const a = holder.current!.getItems()[0];
    expect(a.width).toBe(240);
    expect(a.height).toBe(120);
    expect(a.y).toBe(40); // (100 - 120)/2 = -10 from 50
  });

  it('clamps locked growth to the canvas bounds, keeping the ratio', () => {
    const { holder, ref } = makeRef();
    const { root } = renderCanvas(
      <Canvas width={400} height={300} ref={ref} aria-label="locked bounds canvas">
        <Item id="a" x={100} y={50} width={200} height={100} features={<ResizeHandle direction="se" lockRatio />}>
          <span>A</span>
        </Item>
      </Canvas>,
    );
    // Drag the se corner far past the right edge: width capped at 300 (maxX - x),
    // height keeps the ratio → 150.
    drag(root, { x: 300, y: 150 }, { x: 600, y: 150 });
    const a = holder.current!.getItems()[0];
    expect(a.width).toBe(300);
    expect(a.height).toBe(150);
    expect(a.x).toBe(100);
    expect(a.y).toBe(50);
  });
});

describe('readout features', () => {
  it('EdgeLines appears while moving and disappears on pointer up', () => {
    const { root } = renderCanvas(
      <Canvas width={400} height={300} aria-label="edge canvas">
        <Item id="a" x={100} y={50} width={200} height={100} features={<><MoveHandle /><EdgeLines /></>}>
          <span>A</span>
        </Item>
      </Canvas>,
    );
    expect(document.querySelector('[data-feature="edge-lines"]')).toBeNull();
    // Grab the move handle at (100, 50) and move the item by +25/+35 → (125, 85).
    // Canvas 400×300: top 85, bottom 115, left 125, right 75.
    fireEvent.pointerDown(root, { clientX: 100, clientY: 50, pointerId: 1, buttons: 1 });
    fireEvent.pointerMove(root, { clientX: 125, clientY: 85, pointerId: 1, buttons: 1 });
    const lines = document.querySelector('[data-feature="edge-lines"]')!;
    expect(lines).toBeTruthy();
    const edges = [...document.querySelectorAll('[data-edge-line]')];
    expect(edges).toHaveLength(4);
    const value = (edge: string) =>
      lines.querySelector(`[data-edge-line="${edge}"] [data-edge-value]`)!.textContent;
    expect(value('top')).toBe('85');
    expect(value('bottom')).toBe('115');
    expect(value('left')).toBe('125');
    expect(value('right')).toBe('75');
    fireEvent.pointerUp(root, { clientX: 125, clientY: 85, pointerId: 1, buttons: 1 });
    expect(document.querySelector('[data-feature="edge-lines"]')).toBeNull();
  });

  it('EdgeLines always measures to the canvas bound, ignoring neighbors', () => {
    const { root } = renderCanvas(
      <Canvas width={400} height={300} aria-label="edge neighbor canvas">
        <Item id="a" x={100} y={50} width={200} height={100} features={<><MoveHandle /><EdgeLines /></>}>
          <span>A</span>
        </Item>
        <Item id="b" x={130} y={10} width={60} height={30}>
          <span>B</span>
        </Item>
      </Canvas>,
    );
    // Item b's bottom = 40, but the top line must measure to the CANVAS (50),
    // not the neighbor — lines always run edge-to-canvas.
    fireEvent.pointerDown(root, { clientX: 100, clientY: 50, pointerId: 1, buttons: 1 });
    const lines = document.querySelector('[data-feature="edge-lines"]')!;
    const top = lines.querySelector('[data-edge-line="top"] [data-edge-value]')!.textContent;
    expect(top).toBe('50');
    fireEvent.pointerUp(root, { clientX: 100, clientY: 50, pointerId: 1, buttons: 1 });
  });

  it('RotateValue shows the live angle while rotating', () => {
    const { root } = renderCanvas(
      <Canvas width={400} height={300} aria-label="rotate value canvas">
        <Item id="a" x={100} y={50} width={200} height={100} features={<><RotateHandle /><RotateValue /></>}>
          <span>A</span>
        </Item>
      </Canvas>,
    );
    expect(document.querySelector('[data-feature="rotate-value"]')).toBeNull();
    // Rotate handle at (200, 26); center (200, 100). Drag to (300, 100) → +90°.
    fireEvent.pointerDown(root, { clientX: 200, clientY: 26, pointerId: 1, buttons: 1 });
    fireEvent.pointerMove(root, { clientX: 300, clientY: 100, pointerId: 1, buttons: 1 });
    const rot = document.querySelector('[data-feature="rotate-value"]')!;
    expect(rot).toBeTruthy();
    expect(rot.textContent).toBe('90°');
    // The value span carries data-edge-value → styled like the edge-line pills.
    expect(rot.querySelector('[data-edge-value]')).toBeTruthy();
    fireEvent.pointerUp(root, { clientX: 300, clientY: 100, pointerId: 1, buttons: 1 });
    expect(document.querySelector('[data-feature="rotate-value"]')).toBeNull();
  });

  it('ResizeValue shows width × height while resizing', () => {
    const { root } = renderCanvas(
      <Canvas width={400} height={300} aria-label="resize value canvas">
        <Item id="a" x={100} y={50} width={200} height={100} features={<><ResizeHandle direction="se" /><ResizeValue /></>}>
          <span>A</span>
        </Item>
      </Canvas>,
    );
    expect(document.querySelector('[data-feature="resize-value"]')).toBeNull();
    // se handle at (300, 150); drag +50/+30 → 250 × 130.
    fireEvent.pointerDown(root, { clientX: 300, clientY: 150, pointerId: 1, buttons: 1 });
    fireEvent.pointerMove(root, { clientX: 350, clientY: 180, pointerId: 1, buttons: 1 });
    const size = document.querySelector('[data-feature="resize-value"]')!;
    expect(size).toBeTruthy();
    expect(size.textContent).toBe('250 × 130');
    expect(size.querySelector('[data-edge-value]')).toBeTruthy();
    fireEvent.pointerUp(root, { clientX: 350, clientY: 180, pointerId: 1, buttons: 1 });
    expect(document.querySelector('[data-feature="resize-value"]')).toBeNull();
  });

  it('readouts stay hidden while dragging a different kind', () => {
    const { root } = renderCanvas(
      <Canvas width={400} height={300} aria-label="readout kind canvas">
        <Item id="a" x={100} y={50} width={200} height={100} features={<><MoveHandle /><RotateValue /><ResizeValue /></>}>
          <span>A</span>
        </Item>
      </Canvas>,
    );
    fireEvent.pointerDown(root, { clientX: 100, clientY: 50, pointerId: 1, buttons: 1 });
    fireEvent.pointerMove(root, { clientX: 110, clientY: 60, pointerId: 1, buttons: 1 });
    expect(document.querySelector('[data-feature="rotate-value"]')).toBeNull();
    expect(document.querySelector('[data-feature="resize-value"]')).toBeNull();
    fireEvent.pointerUp(root, { clientX: 110, clientY: 60, pointerId: 1, buttons: 1 });
  });
});

describe('rotate drag', () => {
  it('rotates by the pointer angle delta around the item center', () => {
    const { holder, ref } = makeRef();
    const { root } = renderCanvas(
      <Canvas width={400} height={300} ref={ref} aria-label="rotate canvas">
        <Item id="a" x={100} y={50} width={200} height={100} features={<RotateHandle />}>
          <span>A</span>
        </Item>
      </Canvas>,
    );
    // handle at local (100, -24) → canvas (200, 26); center (200, 100)
    // start angle -90°, drag to (300, 100) → angle 0° → delta +90°
    drag(root, { x: 200, y: 26 }, { x: 300, y: 100 });
    const a = holder.current!.getItems()[0];
    expect(a.rotation).toBe(90);
  });
});

describe('natural-size measurement', () => {
  it('measures auto-sized items and reports the size in onItemsChange', async () => {
    const onItemsChange = vi.fn();
    const { holder, ref } = makeRef();
    renderCanvas(
      <Canvas width={400} height={300} ref={ref} onItemsChange={onItemsChange} aria-label="auto canvas">
        <Item id="auto" x={10} y={10}>
          <span>Auto sized content</span>
        </Item>
      </Canvas>,
    );
    const el = document.querySelector('[data-item-id="auto"]')!;
    act(() => emitResize(el, 140, 28));
    const a = holder.current!.getItems()[0];
    expect(a.width).toBe(140);
    expect(a.height).toBe(28);
    await flushAsync();
    expect(onItemsChange).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: 'auto', width: 140, height: 28 })]),
    );
  });

  it('ignores a ResizeHandle on an auto-sized item (documented no-op)', () => {
    const { holder, ref } = makeRef();
    const { root } = renderCanvas(
      <Canvas width={400} height={300} ref={ref} aria-label="auto resize canvas">
        <Item id="auto" x={10} y={10} features={<ResizeHandle direction="se" />}>
          <span>Auto</span>
        </Item>
      </Canvas>,
    );
    act(() => emitResize(document.querySelector('[data-item-id="auto"]')!, 100, 40));
    const before = holder.current!.getItems()[0];
    // se handle at local (100, 40) → canvas (110, 50)
    drag(root, { x: 110, y: 50 }, { x: 150, y: 90 });
    const after = holder.current!.getItems()[0];
    expect(after.width).toBe(before.width);
    expect(after.height).toBe(before.height);
  });
});

describe('controlled mode', () => {
  it('mirrors the items prop and round-trips drags through onItemsChange', async () => {
    const { holder, ref } = makeRef();
    const latestState: { value: string } = { value: '' };
    function Harness() {
      const [items, setItems] = useState<ItemGeometry[]>([
        { id: 'a', x: 100, y: 50, width: 200, height: 100 },
      ]);
      latestState.value = items[0]?.x?.toFixed(0) ?? 'none';
      return (
        <Canvas
          width={400}
          height={300}
          ref={ref}
          items={items}
          onItemsChange={(next) => setItems(next)}
          aria-label="controlled canvas"
        >
          <Item id="a" x={100} y={50} width={200} height={100} features={<MoveHandle />}>
            <span>A</span>
          </Item>
        </Canvas>
      );
    }
    const { root } = renderCanvas(<Harness />);
    drag(root, { x: 100, y: 50 }, { x: 140, y: 70 });
    expect(latestState.value).toBe('140');
    await flushAsync();
    expect(holder.current!.getItems()[0].x).toBe(140);
  });

  it('controlled selection: onSelect fires and the prop wins', () => {
    const onSelect = vi.fn();
    const Harness = () => {
      const [sel, setSel] = useState<string | null>(null);
      return (
        <Canvas
          width={400}
          height={300}
          selectedId={sel}
          onSelect={(id) => {
            setSel(id);
            onSelect(id);
          }}
          aria-label="controlled selection canvas"
        >
          <Item id="a" x={100} y={50} width={200} height={100} features={<MoveHandle />}>
            <span>A</span>
          </Item>
        </Canvas>
      );
    };
    const { root } = renderCanvas(<Harness />);
    fireEvent.pointerDown(root, { clientX: 100, clientY: 50, pointerId: 1, buttons: 1 });
    expect(onSelect).toHaveBeenCalledWith('a');
    const itemA = screen.getByText('A').closest('[data-item-id="a"]') as HTMLElement;
    expect(itemA).toHaveAttribute('data-selected', 'true');
  });
});

describe('disabled canvas', () => {
  it('renders but disables selection, drag and hover', () => {
    const onSelect = vi.fn();
    const { holder, ref } = makeRef();
    const { root } = renderCanvas(<Fixture canvasRef={ref} disabled onSelect={onSelect} />);
    const itemA = screen.getByText('A').closest('[data-item-id="a"]') as HTMLElement;
    expect(itemA).toHaveAttribute('data-disabled', 'true');
    expect(itemA).not.toHaveAttribute('tabindex');

    drag(root, { x: 150, y: 75 }, { x: 200, y: 100 });
    expect(onSelect).not.toHaveBeenCalled();
    const a = holder.current!.getItems().find((i) => i.id === 'a')!;
    expect(a.x).toBe(100);

    fireEvent.pointerMove(root, { clientX: 150, clientY: 75, buttons: 0 });
    expect(itemA).toHaveAttribute('data-hovered', 'false');
  });
});

describe('keyboard', () => {
  function keyboardFixture() {
    const { holder, ref } = makeRef();
    renderCanvas(<Fixture canvasRef={ref} />);
    const itemA = screen.getByText('A').closest('[data-item-id="a"]') as HTMLElement;
    return {
      itemA,
      get: () => holder.current!.getItems().find((i) => i.id === 'a')!,
    };
  }

  it('arrow keys move the focused item', () => {
    const { itemA, get } = keyboardFixture();
    fireEvent.keyDown(itemA, { key: 'ArrowRight' });
    fireEvent.keyDown(itemA, { key: 'ArrowDown' });
    expect(get().x).toBe(101);
    expect(get().y).toBe(51);
  });

  it('keyboard moves respect the canvas bounds', () => {
    const { itemA, get } = keyboardFixture();
    // Item a is 200×100 at (100, 50) on a 400×300 canvas → x clamps at 200.
    for (let i = 0; i < 150; i++) fireEvent.keyDown(itemA, { key: 'ArrowRight' });
    const a = get();
    expect(a.x).toBe(200);
    expect(a.x + a.width!).toBe(400); // right edge flush with the canvas
  });

  it('shift+arrows resize from the fixed top-left', () => {
    const { itemA, get } = keyboardFixture();
    fireEvent.keyDown(itemA, { key: 'ArrowRight', shiftKey: true });
    fireEvent.keyDown(itemA, { key: 'ArrowDown', shiftKey: true });
    const a = get();
    expect(a.width).toBe(201);
    expect(a.height).toBe(101);
    expect(a.x).toBe(100);
    expect(a.y).toBe(50);
  });

  it('r rotates by ±15° and Esc deselects', () => {
    const { itemA, get } = keyboardFixture();
    fireEvent.keyDown(itemA, { key: 'r' });
    expect(get().rotation).toBe(15);
    fireEvent.keyDown(itemA, { key: 'R' });
    expect(get().rotation).toBe(0);
    fireEvent.keyDown(itemA, { key: 'Escape' });
    expect(itemA).toHaveAttribute('data-selected', 'false');
  });
});

describe('ref handle (CanvasHandle)', () => {
  it('getItems returns geometries in render order; bringToFront/sendToBack reorder', () => {
    const { holder, ref } = makeRef();
    renderCanvas(<Fixture canvasRef={ref} />);
    // Mount order: a (0), b (1) → render order a, b
    expect(holder.current!.getItems().map((i) => i.id)).toEqual(['a', 'b']);

    // Raise a above b: a.zIndex = max(0,1)+1 = 2
    holder.current!.bringToFront('a');
    let items = holder.current!.getItems();
    expect(items.map((i) => i.id)).toEqual(['b', 'a']);
    expect(items.find((i) => i.id === 'a')!.zIndex).toBe(2);

    // Lower b below everything: b.zIndex = min(2,1)-1 = 0
    holder.current!.sendToBack('b');
    items = holder.current!.getItems();
    expect(items.map((i) => i.id)).toEqual(['b', 'a']);
    expect(items.find((i) => i.id === 'b')!.zIndex).toBe(0);
  });

  it('setItems replaces all geometries', () => {
    const { holder, ref } = makeRef();
    renderCanvas(<Fixture canvasRef={ref} />);
    holder.current!.setItems([{ id: 'a', x: 1, y: 2, width: 3, height: 4 }]);
    const items = holder.current!.getItems();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: 'a', x: 1, y: 2 });
  });

  it('select via ref works', () => {
    const { holder, ref } = makeRef();
    renderCanvas(<Fixture canvasRef={ref} />);
    act(() => holder.current!.select('a'));
    const itemA = screen.getByText('A').closest('[data-item-id="a"]') as HTMLElement;
    expect(itemA).toHaveAttribute('data-selected', 'true');
    act(() => holder.current!.select(null));
    expect(itemA).toHaveAttribute('data-selected', 'false');
  });
});

describe('hover', () => {
  it('tracks hoveredId and drives data-hovered', () => {
    const { root } = renderCanvas(<Fixture />);
    const itemA = screen.getByText('A').closest('[data-item-id="a"]') as HTMLElement;
    fireEvent.pointerMove(root, { clientX: 150, clientY: 75, buttons: 0 });
    expect(itemA).toHaveAttribute('data-hovered', 'true');
    fireEvent.pointerMove(root, { clientX: 5, clientY: 5, buttons: 0 });
    expect(itemA).toHaveAttribute('data-hovered', 'false');
  });
});
