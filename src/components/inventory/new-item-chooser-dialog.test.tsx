import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { NewItemChooserDialog } from './new-item-chooser-dialog';

describe('NewItemChooserDialog', () => {
  it('offers separate drug and product choices', () => {
    const onDrug = vi.fn();
    const onProduct = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <NewItemChooserDialog
        open
        onOpenChange={onOpenChange}
        onDrug={onDrug}
        onProduct={onProduct}
      />,
    );

    expect(screen.getByRole('menuitem', { name: /new drug/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /new product/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('menuitem', { name: /new product/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onProduct).toHaveBeenCalledOnce();
    expect(onDrug).not.toHaveBeenCalled();
  });
});
