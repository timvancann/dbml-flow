import { render, screen, fireEvent } from '@testing-library/react';
import { Inspector } from '@/app/Inspector';
import { useAppStore } from '@/app/store';

const dbml = `
Table users {
  id text [pk, note: 'Internal identifier, never exposed.']
  email text
  Note: 'Every person who can sign in.'
}
Table sessions {
  id text [pk]
}
`;

describe('Inspector notes', () => {
  beforeEach(() => {
    useAppStore.getState().loadDbml(dbml);
  });

  it('renders the table note under the header', () => {
    useAppStore.getState().setSelectedTable('users');
    render(<Inspector />);
    expect(screen.getByText('Every person who can sign in.')).toBeInTheDocument();
  });

  it('omits the note block for a table without a note', () => {
    useAppStore.getState().setSelectedTable('sessions');
    render(<Inspector />);
    expect(screen.queryByTestId('table-note')).toBeNull();
  });

  it('hides a column note until the row is clicked', () => {
    useAppStore.getState().setSelectedTable('users');
    render(<Inspector />);
    expect(screen.queryByText('Internal identifier, never exposed.')).toBeNull();
    fireEvent.click(screen.getByText('id'));
    expect(screen.getByText('Internal identifier, never exposed.')).toBeInTheDocument();
    fireEvent.click(screen.getByText('id'));
    expect(screen.queryByText('Internal identifier, never exposed.')).toBeNull();
  });

  it('marks only documented columns with a chevron', () => {
    useAppStore.getState().setSelectedTable('users');
    render(<Inspector />);
    const rows = screen.getAllByTestId('column-row');
    expect(rows[0]).toHaveTextContent('▸');
    expect(rows[1]).not.toHaveTextContent('▸');
  });
});
