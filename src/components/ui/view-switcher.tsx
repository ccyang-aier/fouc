"use client"

import { SquaresFour, Table } from "@phosphor-icons/react"
import { Button } from "./button"
import styles from "./view-switcher.module.css"

export type ViewMode = "list" | "grid"

export function ViewSwitcher({
  value,
  onValueChange,
  listLabel = "列表视图",
  gridLabel = "卡片视图",
}: {
  value: ViewMode
  onValueChange: (value: ViewMode) => void
  listLabel?: string
  gridLabel?: string
}) {
  return (
    <div className={styles.switcher} role="group" aria-label="浏览方式">
      {(["list", "grid"] as const).map(mode => {
        const Icon = mode === "list" ? Table : SquaresFour
        return (
          <Button
            key={mode}
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={mode === "list" ? listLabel : gridLabel}
            aria-pressed={value === mode}
            onClick={() => onValueChange(mode)}
            className={styles.option}
          >
            <Icon data-icon="inline-start" size={16} weight={value === mode ? "fill" : "regular"} />
          </Button>
        )
      })}
    </div>
  )
}
