/**
 * Selection — uncontrolled vs controlled; deselect on empty click.
 * Keyboard — arrows move, shift+arrows resize, r rotates, Esc deselects.
 * Controlled — parent round-trip via items/onItemsChange with a live readout.
 *
 * All stories use the default styled kit: selection rings + corner handles
 * (move top-left, resize bottom-right, rotate above center) + drag readouts.
 */

import type { Meta, StoryObj } from '@storybook/react';
import { expect, fireEvent } from '@storybook/test';
import { useState } from 'react';
import type { ItemGeometry } from '../src/types';
import { boxStyle, clickAt, dragTo, flush, getHandle, useCanvasHandle } from './helpers';
import { MoveHandleStyled, ResizeHandleStyled, StyledCanvas, StyledItem, styledFeatures } from './styled';

/* ------------------------------------------------------------------ */
/* Selection                                                           */
/* ------------------------------------------------------------------ */

function SelectionDemo(props: { controlled: boolean }) {
  const ref = useCanvasHandle();
  const [sel, setSel] = useState<string | null>('a');
  return (
    <StyledCanvas
      ref={ref}
      width={560}
      height={380}
      {...(props.controlled ? { selectedId: sel, onSelect: setSel } : {})}
      aria-label="Selection canvas"
    >
      <StyledItem id="a" x={100} y={90} width={220} height={120} features={styledFeatures}>
        <div style={boxStyle}>
          <div>
            <strong>Item A</strong>
            <br />
            {props.controlled ? 'controlled selection' : 'uncontrolled selection'}
          </div>
        </div>
      </StyledItem>
      <StyledItem id="b" x={350} y={220} width={150} height={90} features={styledFeatures}>
        <div style={{ ...boxStyle, background: '#eef2ea' }}>Item B</div>
      </StyledItem>
    </StyledCanvas>
  );
}

const selectionMeta = {
  title: 'Selection',
  component: SelectionDemo,
  args: { controlled: false },
  argTypes: {
    controlled: {
      control: { type: 'boolean' },
      description: 'Drive selection through selectedId/onSelect instead of internal state',
    },
  },
  parameters: {
    docs: {
      description: {
        component:
          'Selection is either uncontrolled (canvas owns it, onSelect informs you) or controlled (pass selectedId + onSelect). Click empty space to deselect. The data-selected attribute drives the styled kit\'s accent ring — and its handles stay visible on the selected item.',
      },
    },
  },
} satisfies Meta<typeof SelectionDemo>;

export default selectionMeta;
type SelectionStory = StoryObj<typeof selectionMeta>;

export const Uncontrolled: SelectionStory = {
  play: async () => {
    const itemA = document.querySelector('[data-item-id="a"]') as HTMLElement;
    clickAt({ x: 150, y: 120 });
    await flush();
    expect(itemA.getAttribute('data-selected')).toBe('true');
    clickAt({ x: 10, y: 10 });
    await flush();
    expect(itemA.getAttribute('data-selected')).toBe('false');
  },
};

export const Controlled: SelectionStory = {
  args: { controlled: true },
  play: async () => {
    const itemB = document.querySelector('[data-item-id="b"]') as HTMLElement;
    clickAt({ x: 380, y: 240 });
    await flush();
    expect(itemB.getAttribute('data-selected')).toBe('true');
    const itemA = document.querySelector('[data-item-id="a"]') as HTMLElement;
    expect(itemA.getAttribute('data-selected')).toBe('false');
  },
};

/* ------------------------------------------------------------------ */
/* Keyboard                                                            */
/* ------------------------------------------------------------------ */

function KeyboardDemo() {
  const ref = useCanvasHandle();
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', fontSize: 13, color: '#4a3f35' }}>
      <p style={{ margin: '0 0 8px' }}>
        Focus an item (click it, then press Tab if needed), then: <strong>arrows</strong> move ·
        <strong> Shift+arrows</strong> resize · <strong>r / R</strong> rotate ±15° ·{' '}
        <strong>Esc</strong> deselect.
      </p>
      <StyledCanvas ref={ref} width={560} height={340} aria-label="Keyboard canvas">
        <StyledItem id="k1" x={120} y={70} width={220} height={110} features={<MoveHandleStyled />}>
          <div style={boxStyle}>
            <strong>Arrow-key me</strong>
          </div>
        </StyledItem>
        <StyledItem
          id="k2"
          x={330}
          y={210}
          width={160}
          height={90}
          features={<ResizeHandleStyled direction="se" />}
        >
          <div style={{ ...boxStyle, background: '#eef2ea' }}>Shift+arrows resize</div>
        </StyledItem>
      </StyledCanvas>
    </div>
  );
}

const keyboardMeta = {
  title: 'Keyboard',
  component: KeyboardDemo,
  parameters: {
    docs: {
      description: {
        component:
          'Items are focusable (tabIndex=0). Keyboard handling lives on the canvas root and operates on the focused item: arrows move 1px, Shift+arrows resize 1px from the top-left, r/R rotate ±15°, Esc deselects. Moves and resizes respect the canvas bounds. Delete is intentionally not handled — consumers own deletion.',
      },
    },
  },
} satisfies Meta<typeof KeyboardDemo>;

export const Keyboard: StoryObj<typeof keyboardMeta> = {
  name: 'Keyboard',
  render: () => <KeyboardDemo />,
  play: async () => {
    const handle = await getHandle();
    const item = document.querySelector('[data-item-id="k1"]') as HTMLElement;
    item.focus();
    const before = handle.getItems().find((i) => i.id === 'k1')!;
    fireEvent.keyDown(item, { key: 'ArrowRight' });
    fireEvent.keyDown(item, { key: 'ArrowDown' });
    fireEvent.keyDown(item, { key: 'r' });
    const after = handle.getItems().find((i) => i.id === 'k1')!;
    expect(after.x).toBe(before.x + 1);
    expect(after.y).toBe(before.y + 1);
    expect(after.rotation).toBe(15);
  },
};

/* ------------------------------------------------------------------ */
/* Controlled mode                                                     */
/* ------------------------------------------------------------------ */

function ControlledDemo() {
  const ref = useCanvasHandle();
  const [items, setItems] = useState<ItemGeometry[]>([
    { id: 'c1', x: 120, y: 90, width: 240, height: 120 },
    { id: 'c2', x: 340, y: 230, width: 150, height: 80 },
  ]);
  const first = items.find((i) => i.id === 'c1')!;
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', fontSize: 13, color: '#4a3f35' }}>
      <p style={{ margin: '0 0 8px' }}>
        Parent state round-trip — c1 is at{' '}
        <strong>
          ({Math.round(first.x)}, {Math.round(first.y)})
        </strong>{' '}
        · c2 at ({Math.round(items[1].x)}, {Math.round(items[1].y)}). Drag anything — the canvas
        keeps items inside its bounds.
      </p>
      <StyledCanvas
        ref={ref}
        width={560}
        height={340}
        items={items}
        onItemsChange={setItems}
        aria-label="Controlled canvas"
      >
        <StyledItem id="c1" x={120} y={90} width={240} height={120} features={styledFeatures}>
          <div style={boxStyle}>
            <strong>Controlled item</strong>
          </div>
        </StyledItem>
        <StyledItem id="c2" x={340} y={230} width={150} height={80} features={styledFeatures}>
          <div style={{ ...boxStyle, background: '#eef2ea' }}>also controlled</div>
        </StyledItem>
      </StyledCanvas>
    </div>
  );
}

const controlledMeta = {
  title: 'Controlled',
  component: ControlledDemo,
  parameters: {
    docs: {
      description: {
        component:
          'Pass `items` and the canvas mirrors your array into its store; drags are reported through onItemsChange and the parent round-trips. The readout above is plain parent state — drag an item and watch it update. Drags are clamped to the canvas bounds before they are reported.',
      },
    },
  },
} satisfies Meta<typeof ControlledDemo>;

export const ControlledRoundTrip: StoryObj<typeof controlledMeta> = {
  name: 'Controlled mode',
  render: () => <ControlledDemo />,
  play: async () => {
    const handle = await getHandle();
    const before = handle.getItems().find((i) => i.id === 'c1')!;
    dragTo({ x: 180, y: 130 }, { x: 230, y: 160 });
    const after = handle.getItems().find((i) => i.id === 'c1')!;
    expect(after.x).toBe(before.x + 50);
    expect(after.y).toBe(before.y + 30);
  },
};
