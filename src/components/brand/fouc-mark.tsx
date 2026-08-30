import { cn } from "@/lib/utils"

export function FoucMark({
  className,
}: {
  className?: string
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 32 32"
      className={cn("shrink-0", className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="5.5"
        y="11.5"
        width="19"
        height="17"
        rx="3.5"
        stroke="#151718"
        strokeWidth="4.5"
      />
      <rect
        x="11.5"
        y="5.5"
        width="15"
        height="16"
        rx="3"
        stroke="#A4A8AA"
        strokeWidth="2.5"
      />
    </svg>
  )
}
