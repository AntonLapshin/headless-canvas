/**
 * Perf — 500 items with live drag frame-time readout.
 *
 * Demonstrates the performance model: one pointer listener on the canvas
 * root, geometric hit-testing, per-item store subscriptions (only the dragged
 * item re-renders per frame), rAF-throttled onItemsChange, and a single CSS
 * transform for zoom.
 */

import type { Meta, StoryObj } from '@storybook/react';
import { useEffect, useRef, useState } from 'react';
import { Item } from '../src/Item';
import { MoveHandle } from '../src/features';
import { useCanvasHandle } from './helpers';
import { StyledCanvas } from './styled';

const COUNT = 500;
const GRID = 22;
const CELL = 36;

function makeItems(count: number) {
  const items = [];
  for (let i = 0; i < count; i++) {
    const col = i % GRID;
    const row = Math.floor(i / GRID);
    items.push(
      <Item
        key={i}
        id={`p${i}`}
        x={12 + col * CELL}
        y={12 + row * CELL}
        width={30}
        height={22}
        features={<MoveHandle />}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            background: i % 2 ? '#e8dcc8' : '#dbe3d3',
            border: '1px solid #c9b896',
            boxSizing: 'border-box',
          }}
        />
      </Item>,
    );
  }
  return items;
}

function PerfDemo(props: { count: number }) {
  const ref = useCanvasHandle();
  const [stats, setStats] = useState({ last: 0, avg: 0, samples: 0, items: 0 });
  const [items] = useState(() => makeItems(props.count));
  const lastRef = useRef(0);
  const rafRef = useRef(0);

  useEffect(() => {
    let disposed = false;
    const tick = () => {
      if (disposed) return;
      const now = performance.now();
      if (lastRef.current) {
        const dt = now - lastRef.current;
        setStats((s) => ({
          last: dt,
          avg: s.samples === 0 ? dt : s.avg * 0.9 + dt * 0.1,
          samples: s.samples + 1,
          items: s.items,
        }));
      }
      lastRef.current = now;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      disposed = true;
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', fontSize: 13, color: '#4a3f35' }}>
      <p style={{ margin: '0 0 8px' }}>
        <strong>{props.count} items</strong> · drag any tile by its top-left handle · frame time:{' '}
        <strong>{stats.last.toFixed(2)}ms</strong> (smoothed avg{' '}
        {stats.avg.toFixed(2)}ms)
      </p>
      <StyledCanvas ref={ref} width={560} height={420} aria-label="Perf canvas">
        {items}
      </StyledCanvas>
    </div>
  );
}

const meta = {
  title: 'Perf',
  component: PerfDemo,
  args: { count: COUNT },
  argTypes: {
    count: {
      control: { type: 'range', min: 50, max: 1500, step: 50 },
      description: 'Number of items (each with a MoveHandle)',
    },
  },
  parameters: {
    docs: {
      description: {
        component:
          'A drag re-renders only the dragged item: geometry lives in an external store and each Item subscribes to its own slice (useSyncExternalStore). The pointer listeners, hit-testing and onItemsChange throttling all live on the canvas root. Hit-testing is a registry scan — O(features + items); a uniform-grid spatial index is the documented upgrade path beyond ~1–2k items.',
      },
    },
  },
} satisfies Meta<typeof PerfDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FiveHundred: Story = {};
