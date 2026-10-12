"use client"

import { useEffect, useRef } from "react"
import { Info, PaintBrush, Robot, SlidersHorizontal, X } from "@phosphor-icons/react"

import { ScrollArea } from "@/components/ui/scroll-area"
import { AboutSettings } from "./about-settings"
import { AgentSettings } from "./agent-settings"
import { AppearanceSettings } from "./appearance-settings"
import { GeneralSettings } from "./general-settings"
import styles from "./settings-dialog.module.css"

export type SettingsSection = "general" | "appearance" | "agents" | "about"

const SECTIONS = [
  { id: "general", label: "通用", icon: SlidersHorizontal },
  { id: "appearance", label: "外观", icon: PaintBrush },
  { id: "agents", label: "Agent 管理", icon: Robot },
  { id: "about", label: "关于", icon: Info },
] as const

export function SettingsDialog({ open, section, onSectionChange, onClose }: {
  open: boolean
  section: SettingsSection
  onSectionChange: (section: SettingsSection) => void
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (open && dialog && !dialog.open) {
      dialog.showModal()
      dialog.querySelector<HTMLButtonElement>('[aria-current="page"]')?.focus({ preventScroll: true })
    } else if (!open && dialog?.open) {
      dialog.close()
    }
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="settings-dialog-title"
      className={styles.dialog}
      onCancel={(event) => { event.preventDefault(); onClose() }}
      onClose={() => { if (open) onClose() }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose() }}
    >
      {open ? (
        <div className={styles.layout}>
          <button type="button" aria-label="关闭设置" onClick={onClose} className={`fouc-action ${styles.close}`}>
            <X size={18} aria-hidden />
          </button>
          <aside className={`${styles.sidebar} sidebar-material`}>
            <h1 id="settings-dialog-title" className={styles.title}>设置</h1>
            <ScrollArea className={styles.navigationScroll}>
              <nav aria-label="设置分区" className={styles.navigation}>
                {SECTIONS.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    aria-current={section === id ? "page" : undefined}
                    onClick={() => onSectionChange(id)}
                    className={`fouc-action ${styles.navigationItem}`}
                  >
                    <Icon size={19} aria-hidden />
                    <span>{label}</span>
                  </button>
                ))}
              </nav>
            </ScrollArea>
          </aside>
          <ScrollArea key={section} as="section" aria-label={`${SECTIONS.find(item => item.id === section)?.label}设置`} className={styles.content}>
            {section === "general" ? <GeneralSettings />
              : section === "appearance" ? <AppearanceSettings />
                : section === "agents" ? <AgentSettings /> : <AboutSettings />}
          </ScrollArea>
        </div>
      ) : null}
    </dialog>
  )
}
