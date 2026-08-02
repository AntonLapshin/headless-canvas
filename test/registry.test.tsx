/**
 * Feature-registry tests: custom features via useFeatureRegistration
 * (registration/unregistration, custom drag behavior, drag context).
 */

import { render } from '@testing-library/react';
import { useCallback } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Canvas } from '../src/Canvas';
import { Item } from '../src/Item';
import { useItemId } from '../src/context';
import { useFeatureRegistration, type DragHandler } from '../src/registry';
import type { CanvasHandle } from '../src/types';
import { drag, renderCanvas } from './helpers';

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

/** A consumer-built "crop" handle using the public custom-feature hook. */
function CropHandle({ onDrag }: { onDrag?: DragHandler }) {
  const itemId = useItemId();
  const hitRect = useCallback(() => ({ x: -12, y: -12, width: 24, height: 24 }), []);
  useFeatureRegistration(itemId, 'crop', hitRect, {
    cursor: 'crosshair',
    onDrag,
  });
  // The anchor div is consumer-rendered (the library renders none for customs).
  return <div data-testid="crop-handle" />;
}

interface HarnessProps {
  onDrag?: DragHandler;
  onDragStart?: (id: string, kind: string) => void;
  onDragEnd?: (id: string, kind: string) => void;
  snapToGrid?: number;
  canvasRef?: React.Ref<CanvasHandle>;
}

function Harness(props: HarnessProps) {
  return (
    <Canvas
      width={400}
      height={300}
      ref={props.canvasRef}
      snapToGrid={props.snapToGrid}
      onDragStart={props.onDragStart as never}
      onDragEnd={props.onDragEnd as never}
      aria-label="custom canvas"
    >
      <Item id="a" x={100} y={50} width={200} height={100} features={<CropHandle onDrag={props.onDrag} />}>
        <span>A</span>
      </Item>
    </Canvas>
  );
}

describe('useFeatureRegistration', () => {
  it('registers a custom hit region and applies the custom drag patch', () => {
    const onDrag = vi.fn(({ dx, dy, start }: Parameters<DragHandler>[0]) => ({
      width: (start.width ?? 0) + dx,
      height: (start.height ?? 0) + dy,
    }));
    const { holder, ref } = makeRef();
    const { root } = renderCanvas(<Harness onDrag={onDrag as DragHandler} canvasRef={ref} />);
    // Crop hit region is a 24×24 square around local (-12,-12) → canvas (88..112, 38..62)
    drag(root, { x: 100, y: 50 }, { x: 130, y: 80 });
    expect(onDrag).toHaveBeenCalled();
    const a = holder.current!.getItems()[0];
    expect(a.width).toBe(230);
    expect(a.height).toBe(130);
  });

  it('passes a working snap function in the drag context', () => {
    const onDrag = vi.fn(({ snap }: Parameters<DragHandler>[0]) => ({ width: snap(23) }));
    const R = () => <Harness onDrag={onDrag as DragHandler} snapToGrid={10} />;
    const { root } = renderCanvas(<R />);
    drag(root, { x: 100, y: 50 }, { x: 133, y: 80 });
    expect(onDrag.mock.calls[0][0].snap(23)).toBe(20);
    // The patch the canvas applied used the snapped value.
    expect(onDrag.mock.results[0].value).toEqual({ width: 20 });
  });

  it('fires drag start/end with the custom kind', () => {
    const onDragStart = vi.fn();
    const onDragEnd = vi.fn();
    const R = () => <Harness onDragStart={onDragStart} onDragEnd={onDragEnd} />;
    const { root } = renderCanvas(<R />);
    drag(root, { x: 100, y: 50 }, { x: 120, y: 70 });
    expect(onDragStart).toHaveBeenCalledWith('a', 'crop');
    expect(onDragEnd).toHaveBeenCalledWith('a', 'crop');
  });

  it('unregisters on unmount: the hit region stops working', () => {
    const onDrag = vi.fn();
    const { holder, ref } = makeRef();
    const R = ({ show }: { show: boolean }) => (
      <Canvas width={400} height={300} ref={ref} aria-label="custom canvas">
        {show && (
          <Item
            id="a"
            x={100}
            y={50}
            width={200}
            height={100}
            features={<CropHandle onDrag={onDrag as DragHandler} />}
          >
            <span>A</span>
          </Item>
        )}
      </Canvas>
    );
    const { root, rerender } = renderCanvas(<R show />);
    drag(root, { x: 100, y: 50 }, { x: 120, y: 70 });
    expect(onDrag).toHaveBeenCalledTimes(1);

    rerender(<R show={false} />);
    drag(root, { x: 100, y: 50 }, { x: 120, y: 70 });
    expect(onDrag).toHaveBeenCalledTimes(1); // no feature left to hit
    expect(holder.current!.getItems()).toHaveLength(0); // item unregistered too
  });
});

describe('hooks', () => {
  it('useItemId throws outside an Item', () => {
    const Boom = () => {
      useItemId();
      return null;
    };
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Boom />)).toThrow(/inside an <Item>/);
    spy.mockRestore();
  });
});
