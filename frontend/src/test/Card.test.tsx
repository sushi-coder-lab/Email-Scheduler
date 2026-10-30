import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card } from '../components/common/Card';

describe('Card Component', () => {
  it('renders card title, subtitle and children content', () => {
    render(
      <Card title="Active Campaigns" subtitle="Live analytics overview">
        <div>Card body content here</div>
      </Card>
    );

    expect(screen.getByText('Active Campaigns')).toBeInTheDocument();
    expect(screen.getByText('Live analytics overview')).toBeInTheDocument();
    expect(screen.getByText('Card body content here')).toBeInTheDocument();
  });

  it('renders header actions when provided', () => {
    render(
      <Card title="Senders" action={<button>Add Sender</button>}>
        <div>Sender List</div>
      </Card>
    );

    expect(screen.getByRole('button', { name: /add sender/i })).toBeInTheDocument();
  });
});
