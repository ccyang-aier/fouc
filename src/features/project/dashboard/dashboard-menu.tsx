'use client';

import { createContext, useContext, useState, type ComponentProps } from 'react';
import { DropdownMenu, DropdownMenuContent } from '@/components/ui/dropdown-menu';

const MenuOpen = createContext(false);

/** Resolve the shared portal host when opening, including after native-dialog hot refresh. */
export function DashboardMenu({
  children,
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  ...props
}: ComponentProps<typeof DropdownMenu>) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const open = controlledOpen ?? internalOpen;
  return (
    <MenuOpen.Provider value={open}>
      <DropdownMenu
        {...props}
        open={open}
        onOpenChange={(next) => {
          setInternalOpen(next);
          onOpenChange?.(next);
        }}
      >
        {children}
      </DropdownMenu>
    </MenuOpen.Provider>
  );
}

export function DashboardMenuContent(props: ComponentProps<typeof DropdownMenuContent>) {
  const open = useContext(MenuOpen);
  return open ? <DropdownMenuContent {...props} /> : null;
}
