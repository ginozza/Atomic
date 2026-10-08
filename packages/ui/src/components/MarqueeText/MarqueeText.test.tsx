import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MarqueeText } from './MarqueeText';

describe('MarqueeText', () => {
  it('renders text content', () => {
    render(<MarqueeText text="Bohemian Rhapsody" />);
    expect(screen.getByText('Bohemian Rhapsody')).toBeInTheDocument();
  });

  it('renders static text when content fits in container', () => {
    render(<MarqueeText text="Short Title" />);
    expect(screen.getByTestId('marquee-static-text')).toBeInTheDocument();
  });
});
