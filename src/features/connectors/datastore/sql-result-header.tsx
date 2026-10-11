"use client"

import type { ReactNode } from 'react'
import { CaretDown, IconContext } from '@phosphor-icons/react'
import type { SqlResultView } from '@fouc/shared'
import styles from './sql-result-header.module.css'

export type SqlResultHeaderHost = {
  tabs: HTMLElement | null; actions: HTMLElement | null; pin: HTMLElement | null;
  active: boolean; onActivate: () => void;
  pinnedLabels: readonly string[];
}
export function SqlResultHeader({ label, tabs, selectedPin, pinActions, pinnedPinControl, empty, view, onCollapse, onTabsTarget, onActionsTarget, onPinTarget, onPinnedToolsTarget }: {
  label: string; tabs: ReactNode; selectedPin: boolean; pinActions: ReactNode; pinnedPinControl: ReactNode; empty: boolean; onCollapse: () => void;
  view: SqlResultView;
  onTabsTarget: (target: HTMLDivElement | null) => void; onActionsTarget: (target: HTMLDivElement | null) => void;
  onPinTarget: (target: HTMLDivElement | null) => void; onPinnedToolsTarget: (target: HTMLDivElement | null) => void;
}) {
  return <IconContext.Provider value={{ weight: 'bold', size: 16 }}><header className={styles.bar} data-empty={empty || undefined} data-view={view}>
    <div className={styles.pinSlot}><div ref={onPinTarget} hidden={selectedPin} />{selectedPin && pinnedPinControl}</div>
    <div className={styles.tabs} role="tablist" aria-label="查询结果标签">{tabs}<div ref={onTabsTarget} className={styles.currentTabs} /></div>
    <strong className={styles.badge} title={label}>{label}</strong>
    <div ref={onActionsTarget} className={styles.actions} hidden={selectedPin} />
    <div className={styles.actions} hidden={!selectedPin}><div ref={onPinnedToolsTarget} className={styles.tools} />{pinActions}</div>
    <button type="button" className={`fouc-action ${styles.collapse}`} aria-label="收起查询结果" title="收起查询结果" onClick={onCollapse}><CaretDown /></button>
  </header></IconContext.Provider>
}
