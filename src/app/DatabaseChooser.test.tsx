import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { DatabaseChooser } from '@/app/DatabaseChooser';

const dbs = [
  { id: 'warehouse_prod', label: 'warehouse prod', file: 'warehouse_prod.dbml' },
  { id: 'pokemon', label: 'pokemon', file: 'pokemon.dbml' },
];

describe('DatabaseChooser', () => {
  it('lists each database by label', () => {
    render(<DatabaseChooser databases={dbs} onPick={() => {}} />);
    expect(screen.getByText('warehouse prod')).toBeInTheDocument();
    expect(screen.getByText('pokemon')).toBeInTheDocument();
  });

  it('calls onPick with the chosen entry', async () => {
    const onPick = vi.fn();
    render(<DatabaseChooser databases={dbs} onPick={onPick} />);
    fireEvent.click(screen.getByText('pokemon'));
    expect(onPick).toHaveBeenCalledWith(dbs[1]);
  });
});
