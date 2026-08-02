/**
 * Intro — API overview playground.
 *
 * One canvas, three items: a full-featured item (move + resize + scale +
 * rotate), a move-only item, and an auto-sized item. Play with the controls:
 * scale zooms the whole design space, snapToGrid snaps dragged geometry.
 * Showcases the default styled kit (stories/styled.tsx).
 */

import type { Meta, StoryObj } from '@storybook/react';
import { boxStyle, useCanvasHandle } from './helpers';
import {
  MoveHandleStyled,
  StyledCanvas,
  StyledItem,
  styledFeatures,
} from './styled';

function IntroDemo(props: { scale?: number; snapToGrid?: number; disabled?: boolean }) {
  const ref = useCanvasHandle();
  return (
    <StyledCanvas
      ref={ref}
      width={560}
      height={380}
      scale={props.scale}
      snapToGrid={props.snapToGrid}
      disabled={props.disabled}
      aria-label="Intro canvas"
    >
      <StyledItem id="hero" x={150} y={90} width={260} height={140} features={styledFeatures}>
        <div style={boxStyle}>
          <div>
            <strong>Full-featured item</strong>
            <br />
            move · resize · scale · rotate
          </div>
        </div>
      </StyledItem>
      <StyledItem id="move-only" x={60} y={60} width={180} height={70} features={<MoveHandleStyled />}>
        <div style={{ ...boxStyle, background: '#eef2ea' }}>Move only</div>
      </StyledItem>
      <StyledItem id="auto" x={330} y={40} features={<MoveHandleStyled />}>
        <div style={{ ...boxStyle, width: 140, height: 48, background: '#f7e8e0' }}>
          Auto-sized (measured)
        </div>
      </StyledItem>
    </StyledCanvas>
  );
}

const meta = {
  title: 'Intro',
  component: IntroDemo,
  args: {
    scale: 1,
    snapToGrid: 0,
    disabled: false,
  },
  argTypes: {
    scale: {
      control: { type: 'range', min: 0.4, max: 1.5, step: 0.05 },
      description: 'Display zoom (children are authored in logical units)',
    },
    snapToGrid: {
      control: { type: 'number' },
      description: 'Snap dragged geometry to this grid (0 = off)',
    },
    disabled: {
      control: { type: 'boolean' },
      description: 'Disable all interaction',
    },
  },
  parameters: {
    docs: {
      description: {
        component:
          'Headless, declarative React canvas. Everything is draggable: grab any item body (MoveHandle covers the whole item), drag the bottom-right corner to resize, the top-right handle scales proportionally, the top handle rotates. Handles fade in on hover/selection; items stay inside the canvas. The library renders no visuals — this story styles its own items with the default styled kit (plain consumer CSS).',
      },
    },
  },
} satisfies Meta<typeof IntroDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
