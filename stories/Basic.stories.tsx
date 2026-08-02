/**
 * Basic — items with children, no features: selection only.
 * Disabled — the same canvas with interaction switched off.
 *
 * Both showcase the default styled kit (stories/styled.tsx): selection and
 * hover rings, handles fading in on hover/selection.
 */

import type { Meta, StoryObj } from '@storybook/react';
import { expect } from '@storybook/test';
import { boxStyle, clickAt, flush, useCanvasHandle } from './helpers';
import { MoveHandleStyled, StyledCanvas, StyledItem } from './styled';

function BasicDemo() {
  const ref = useCanvasHandle();
  return (
    <StyledCanvas ref={ref} width={560} height={380} aria-label="Basic canvas">
      <StyledItem id="a" x={80} y={70} width={200} height={120}>
        <div style={boxStyle}>
          <div>
            <strong>Item A</strong>
            <br />
            click to select
          </div>
        </div>
      </StyledItem>
      <StyledItem id="b" x={330} y={190} width={160} height={100}>
        <div style={{ ...boxStyle, background: '#eef2ea' }}>Item B</div>
      </StyledItem>
      <StyledItem id="c" x={60} y={250} width={120} height={60}>
        <div style={{ ...boxStyle, background: '#f7e8e0' }}>Item C</div>
      </StyledItem>
    </StyledCanvas>
  );
}

const meta = {
  title: 'Basic',
  component: BasicDemo,
  parameters: {
    docs: {
      description: {
        component:
          'Items without features are selectable but not draggable. Click an item to select it (data-selected="true" — the accent ring), click empty space to deselect. Everything you see is consumer CSS from the default styled kit (stories/styled.tsx); the library itself still ships zero styles.',
      },
    },
  },
} satisfies Meta<typeof BasicDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SelectionOnly: Story = {
  play: async () => {
    const itemA = document.querySelector('[data-item-id="a"]') as HTMLElement;
    clickAt({ x: 120, y: 100 });
    await flush();
    expect(itemA.getAttribute('data-selected')).toBe('true');
    clickAt({ x: 10, y: 10 });
    await flush();
    expect(itemA.getAttribute('data-selected')).toBe('false');
  },
};

/* ------------------------------------------------------------------ */
/* Disabled                                                            */
/* ------------------------------------------------------------------ */

function DisabledDemo() {
  const ref = useCanvasHandle();
  return (
    <StyledCanvas ref={ref} width={560} height={380} disabled aria-label="Disabled canvas">
      <StyledItem id="a" x={100} y={80} width={240} height={130} features={<MoveHandleStyled />}>
        <div style={boxStyle}>
          <div>
            <strong>Still renders</strong>
            <br />
            but nothing responds
          </div>
        </div>
      </StyledItem>
      <StyledItem id="b" x={360} y={220} width={140} height={80}>
        <div style={{ ...boxStyle, background: '#eef2ea' }}>data-disabled="true"</div>
      </StyledItem>
    </StyledCanvas>
  );
}

const disabledMeta = {
  title: 'Disabled',
  component: DisabledDemo,
  parameters: {
    docs: {
      description: {
        component:
          'disabled="true" renders the canvas and its context, but selection, dragging, hovering and keyboard are all switched off. Items carry data-disabled="true" — the styled kit dims them and hides their handles.',
      },
    },
  },
} satisfies Meta<typeof DisabledDemo>;

export const Disabled: StoryObj<typeof disabledMeta> = {
  name: 'Disabled',
  render: () => <DisabledDemo />,
  parameters: {
    docs: {
      description: {
        story:
          'disabled="true" renders the canvas and its context, but selection, dragging, hovering and keyboard are all switched off. Items carry data-disabled="true" — the styled kit dims them and hides their handles.',
      },
    },
  },
  play: async () => {
    const itemA = document.querySelector('[data-item-id="a"]') as HTMLElement;
    expect(itemA.getAttribute('data-disabled')).toBe('true');
    clickAt({ x: 150, y: 100 });
    expect(itemA.getAttribute('data-selected')).toBe('false');
  },
};
