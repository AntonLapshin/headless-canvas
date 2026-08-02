/**
 * Styling — the default styled kit in action, light/dark themes, and a
 * "custom flavor" item proving the kit is just consumer CSS you can override.
 *
 * The library still ships ZERO visual styles. Everything you see comes from
 * stories/styled.tsx — the reference styled set (heroicons glyphs, reserved
 * corner positions, hover/selection visibility) that every story showcases.
 * Override any of it with plain CSS; the data-attribute contract is the only
 * stable interface.
 */

import type { Meta, StoryObj } from '@storybook/react';
import { boxStyle, useCanvasHandle } from './helpers';
import {
  MoveHandleStyled,
  ResizeHandleStyled,
  RotateHandleStyled,
  ScaleHandleStyled,
  StyledCanvas,
  StyledItem,
  styledFeatures,
} from './styled';

/** Extra consumer CSS on top of the kit: a custom handle flavor. */
const flavorCss = `
  .hc-demo .hc-flavor .hc-handle {
    background: #fff1e6;
    border-color: #e58a4b;
    color: #e58a4b;
    border-radius: 50%;
  }
  .hc-demo .hc-flavor .hc-handle--rotate::after {
    background: #e58a4b;
  }
`;

function StylingDemo(props: { theme: 'light' | 'dark' }) {
  const ref = useCanvasHandle();
  return (
    <StyledCanvas ref={ref} width={560} height={380} theme={props.theme} aria-label="Styling canvas">
      <style>{flavorCss}</style>
      <StyledItem id="s1" x={90} y={60} width={250} height={130} features={styledFeatures}>
        <div style={boxStyle}>
          <div>
            <strong>The default styled kit</strong>
            <br />
            hover reveals the corner handles · drag anywhere to move
          </div>
        </div>
      </StyledItem>
      <StyledItem
        id="s2"
        x={360}
        y={230}
        width={150}
        height={90}
        className="hc-flavor"
        features={
          <>
            <MoveHandleStyled />
            <ResizeHandleStyled />
            <ScaleHandleStyled />
            <RotateHandleStyled />
          </>
        }
      >
        <div style={{ ...boxStyle, background: '#f7e8e0' }}>
          <div>
            <strong>Custom flavor</strong>
            <br />
            one CSS override away
          </div>
        </div>
      </StyledItem>
      <StyledItem id="s3" x={60} y={240} width={140} height={70} locked features={<MoveHandleStyled />}>
        <div style={{ ...boxStyle, background: '#ece5f5' }}>locked item</div>
      </StyledItem>
    </StyledCanvas>
  );
}

const meta = {
  title: 'Styling',
  component: StylingDemo,
  args: { theme: 'light' },
  argTypes: {
    theme: {
      control: { type: 'inline-radio' },
      options: ['light', 'dark'],
      description: 'Consumer theme — plain CSS variables, no library involvement',
    },
  },
  parameters: {
    docs: {
      description: {
        component:
          'Everything you see is consumer CSS from the default styled kit (stories/styled.tsx): heroicons glyphs, reserved corner positions (move top-left, resize bottom-right, scale top-right, rotate above center), and handles that fade in on hover/selection. The library only rendered data attributes and the interaction. The orange "custom flavor" item shows the kit is plain CSS — override any handle with one class. Wrapping <MoveHandle /> in a styled div cannot break dragging, because hit-testing is geometric, not DOM-based (though the visual should be a *sibling* of the anchor, not a wrapper — the anchor is positioned in item-local coordinates).',
      },
    },
  },
} satisfies Meta<typeof StylingDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Themes: Story = {};

export const DarkTheme: Story = {
  args: { theme: 'dark' },
};
