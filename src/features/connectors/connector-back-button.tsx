"use client"

import { ArrowLeft } from "@phosphor-icons/react/dist/csr/ArrowLeft"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

export function ConnectorBackButton({ onBack }: { onBack: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onBack}
          aria-label="返回连接器"
          className="fouc-action inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-[7px] border-0 bg-transparent p-0 text-[var(--muted-strong)] outline-none"
        >
          <ArrowLeft size={17} aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">返回连接器</TooltipContent>
    </Tooltip>
  )
}
