import type { ReactNode } from "react"
import styles from "./settings-panel.module.css"

export function SettingsPanel({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <div className={styles.panel}>
      <header className={styles.header}>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </header>
      {children}
    </div>
  )
}
