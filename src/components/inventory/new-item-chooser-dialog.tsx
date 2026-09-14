'use client';

import { Package, Pill, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/** Compact item-type menu used by the Storage toolbar. */
export function NewItemChooserDialog({
  open,
  onOpenChange,
  onDrug,
  onProduct,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDrug: () => void;
  onProduct: () => void;
}) {
  const choose = (next: () => void) => {
    onOpenChange(false);
    next();
  };

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger render={<Button size="sm" variant="outline" />}>
        <Plus className="mr-1.5 h-4 w-4" /> New Item
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => choose(onDrug)}>
          <Pill className="mr-2 h-4 w-4" /> New Drug
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => choose(onProduct)}>
          <Package className="mr-2 h-4 w-4" /> New Product
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
