"use client";

import type { ComponentProps, ComponentPropsWithRef, ReactNode } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import styles from "./chat-picker.module.css";

export function ChatPickerContent({ className, ...props }: ComponentProps<typeof DropdownMenuContent>) {
  return <DropdownMenuContent align="start" side="top" sideOffset={6} collisionPadding={12}
    {...props} className={cn(styles.surface, className)} />;
}

export function ChatPickerSearch({ icon, containerClassName, onKeyDown, ...props }: ComponentPropsWithRef<"input"> & { icon?: ReactNode; containerClassName?: string }) {
  return <label className={cn(styles.search, containerClassName)}>
    {icon ?? <MagnifyingGlass size={14} aria-hidden="true" />}
    <input autoFocus {...props} onKeyDown={(event) => {
      onKeyDown?.(event);
      if (event.defaultPrevented || event.key === "Escape" || event.key === "Tab") return;
      event.stopPropagation();
      if (event.key === "ArrowDown") {
        event.preventDefault();
        event.currentTarget.closest('[role="menu"]')?.querySelector<HTMLElement>('[role="menuitemradio"], [role="menuitemcheckbox"]')?.focus();
      }
    }} />
  </label>;
}

export function ChatPickerItem({ className, ...props }: ComponentProps<typeof DropdownMenuItem>) {
  return <DropdownMenuItem {...props} className={cn(styles.item, className)} />;
}
