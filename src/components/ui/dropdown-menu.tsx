"use client"

import * as React from "react"
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu"
import { Check, CaretRight } from "@phosphor-icons/react"

import { getOverlayRoot } from "@/lib/overlay-root"
import { cn } from "@/lib/utils"

const DropdownMenu = DropdownMenuPrimitive.Root
const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger
const DropdownMenuGroup = DropdownMenuPrimitive.Group

function DropdownMenuContent({
  className,
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal container={getOverlayRoot()}>
      <DropdownMenuPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          "overlay-surface z-50 min-w-44 overflow-hidden rounded-xl border bg-elevated p-1.5 text-[12px] text-[var(--ink)] animate-in fade-in-0 zoom-in-95",
          className,
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  )
}

function DropdownMenuItem({
  className,
  inset,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & {
  inset?: boolean
}) {
  return (
    <DropdownMenuPrimitive.Item
      data-inset={inset}
      className={cn(
        "relative flex h-8 cursor-default select-none items-center gap-2 rounded-lg px-2.5 outline-none transition-colors focus:bg-wash data-[disabled]:pointer-events-none data-[disabled]:opacity-45 data-[inset=true]:pl-8 [&_svg]:size-4 [&_svg]:text-[var(--muted)]",
        className,
      )}
      {...props}
    />
  )
}

function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem>) {
  return (
    <DropdownMenuPrimitive.CheckboxItem
      className={cn(
        "relative flex h-8 cursor-default select-none items-center rounded-lg py-1.5 pr-2 pl-8 text-[12px] outline-none transition-colors focus:bg-wash",
        className,
      )}
      checked={checked}
      {...props}
    >
      <span className="absolute left-2.5 flex size-4 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <Check className="size-3.5" weight="bold" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  )
}

function DropdownMenuLabel({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Label>) {
  return (
    <DropdownMenuPrimitive.Label
      className={cn(
        "px-2.5 py-1.5 text-[11px] font-medium text-[var(--muted)]",
        className,
      )}
      {...props}
    />
  )
}

function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
      className={cn("-mx-1 my-1 h-px bg-[var(--line)]", className)}
      {...props}
    />
  )
}

function DropdownMenuSubTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubTrigger>) {
  return (
    <DropdownMenuPrimitive.SubTrigger
      className={cn(
        "flex h-8 cursor-default items-center gap-2 rounded-lg px-2.5 text-[12px] outline-none focus:bg-wash data-[state=open]:bg-wash",
        className,
      )}
      {...props}
    >
      {children}
      <CaretRight className="ml-auto size-3.5" />
    </DropdownMenuPrimitive.SubTrigger>
  )
}

const DropdownMenuSub = DropdownMenuPrimitive.Sub
const DropdownMenuSubContent = DropdownMenuContent

export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
}
