import Image from "next/image"
import { Sparkle } from "@phosphor-icons/react"

import { cn } from "@/lib/utils"

import type { WorkAssignee } from "./project-work-data"

export function WorkAssigneeAvatar({ assignee, size = "md" }: { assignee: WorkAssignee; size?: "sm" | "md" }) {
  const sizeClass = size === "sm" ? "size-[18px]" : "size-6"

  if (assignee.avatar) {
    return <Image src={assignee.avatar} alt={assignee.name} width={24} height={24} className={cn(sizeClass, "shrink-0 rounded-full object-cover")} />
  }

  if (assignee.name === "Nova") {
    return (
      <span className={cn(sizeClass, "flex shrink-0 items-center justify-center rounded-full bg-[#7c79d9] text-white")}>
        <Sparkle className="size-[11px]" weight="fill" />
      </span>
    )
  }

  const colors = assignee.name === "小满" ? "bg-[#dce9f8] text-[#4671a7]" : "bg-[#f0e1d3] text-[#9a6740]"
  return <span className={cn(sizeClass, "flex shrink-0 items-center justify-center rounded-full text-[8px] font-semibold", colors)}>{assignee.name.slice(-1)}</span>
}
