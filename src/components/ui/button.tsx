import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md text-[12px] font-medium outline-none transition-[color,background-color,border-color,box-shadow,transform] disabled:pointer-events-none disabled:opacity-45 focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-panel active:translate-y-px [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--accent)] text-white shadow-[0_4px_12px_rgba(14,166,132,0.16)] hover:bg-[var(--accent-strong)]",
        outline:
          "border border-[var(--line)] bg-panel/80 text-[var(--ink)] hover:border-[var(--line-strong)] hover:bg-[var(--surface-subtle)]",
        ghost:
          "text-[var(--muted-strong)] hover:bg-wash hover:text-[var(--ink)]",
        subtle:
          "border border-[var(--line)] bg-[var(--surface-subtle)] text-[var(--muted-strong)] hover:bg-surface-hover hover:text-[var(--ink)]",
      },
      size: {
        default: "h-9 px-4",
        sm: "h-8 rounded-lg px-3 text-[11px]",
        icon: "size-9",
        "icon-sm": "size-8 rounded-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
