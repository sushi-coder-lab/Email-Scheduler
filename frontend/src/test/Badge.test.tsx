import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from '../components/common/Badge';

describe('Badge Component', () => {
  it('renders status text correctly', () => {
    render(<Badge status="SENT" />);
    expect(screen.getByText('SENT')).toBeInTheDocument();
  });

  it('renders custom children', () => {
    render(<Badge variant="success">Completed Successfully</Badge>);
    expect(screen.getByText('Completed Successfully')).toBeInTheDocument();
  });
});
