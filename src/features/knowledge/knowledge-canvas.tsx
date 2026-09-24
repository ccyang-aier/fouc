"use client"

import { useState } from "react"
import {
  CaretRight,
  Clock,
  FileText,
  Folder,
  House,
  Star,
  Tag,
  TrashSimple,
} from "@phosphor-icons/react"

import styles from "./knowledge-canvas.module.css"

type Section = "home" | "all" | "starred" | "trash" | "projects" | "recent"
type Selection = { id: string; label: string; section: Section }

const mainItems = [
  { id: "home", label: "首页", icon: House, color: "#3f8990" },
  { id: "all", label: "全部文档", icon: FileText, color: "#667dc4" },
  { id: "starred", label: "星标", icon: Star, color: "#e9ad16" },
  { id: "trash", label: "回收站", icon: TrashSimple, color: "#d76d68" },
] as const

const initialSelection: Selection = { id: "starred", label: "星标", section: "starred" }

export function KnowledgeCanvas() {
  const [selection, setSelection] = useState<Selection>(initialSelection)
  const [projectsOpen, setProjectsOpen] = useState(true)
  const [locationOpen, setLocationOpen] = useState(false)
  const [tagsOpen, setTagsOpen] = useState(true)
  const [tag13Open, setTag13Open] = useState(true)
  const [dawaOpen, setDawaOpen] = useState(false)
  const [dawadeOpen, setDawadeOpen] = useState(false)
  const [recentOpen, setRecentOpen] = useState(false)

  const choose = (id: string, label: string, section: Section = "projects") =>
    setSelection({ id, label, section })

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar} aria-label="知识库侧边栏">
        <nav className={styles.navigation} aria-label="知识库导航">
          <div className={styles.mainItems}>
            {mainItems.map(({ id, label, icon: Icon, color }) => (
              <button
                key={id}
                type="button"
                className={styles.mainRow}
                data-selected={selection.id === id}
                aria-current={selection.id === id ? "page" : undefined}
                onClick={() => choose(id, label, id)}
              >
                <Icon size={16} weight="fill" color={color} aria-hidden />
                <span>{label}</span>
              </button>
            ))}
          </div>

          <section className={styles.group} aria-label="项目">
            <div className={styles.sectionRow} data-selected={selection.id === "projects"}>
              <Folder size={16} aria-hidden />
              <button type="button" className={styles.sectionTitle} onClick={() => choose("projects", "项目", "projects")}>项目</button>
              <button type="button" className={styles.caretButton} aria-label={projectsOpen ? "收起项目" : "展开项目"} aria-expanded={projectsOpen} onClick={() => setProjectsOpen(!projectsOpen)}>
                <CaretRight size={11} weight="fill" className={projectsOpen ? styles.rotated : ""} aria-hidden />
              </button>
            </div>
            {projectsOpen && (
              <div role="tree" aria-label="项目" className={styles.tree}>
                <div role="treeitem" aria-expanded={locationOpen} aria-selected={selection.id === "location"}>
                  <div className={styles.treeRow} data-selected={selection.id === "location"}>
                    <button type="button" className={styles.treeCaret} aria-label={locationOpen ? "收起定位" : "展开定位"} aria-expanded={locationOpen} onClick={() => setLocationOpen(!locationOpen)}><CaretRight size={12} className={locationOpen ? styles.rotated : ""} aria-hidden /></button>
                    <button type="button" className={styles.treeLabel} onClick={() => choose("location", "定位")}><span className={styles.projectGlyph}><FileText size={11} weight="fill" color="white" aria-hidden /></span>定位</button>
                  </div>
                  {locationOpen && <div role="group" className={styles.emptyTree}>暂无文档</div>}
                </div>
              </div>
            )}
          </section>

          <section className={styles.group} aria-label="标签">
            <div className={styles.sectionRow}>
              <Tag size={16} aria-hidden />
              <button type="button" className={styles.sectionTitle} onClick={() => setTagsOpen(!tagsOpen)}>标签</button>
              <button type="button" className={styles.caretButton} aria-label={tagsOpen ? "收起标签" : "展开标签"} aria-expanded={tagsOpen} onClick={() => setTagsOpen(!tagsOpen)}><CaretRight size={11} weight="fill" className={tagsOpen ? styles.rotated : ""} aria-hidden /></button>
            </div>
            {tagsOpen && <div role="tree" aria-label="标签" className={styles.tree}>
              <div role="treeitem" aria-expanded={tag13Open} aria-selected={selection.id === "tag-13"}>
                <div className={styles.treeRow} data-selected={selection.id === "tag-13"}>
                  <button type="button" className={styles.treeCaret} aria-label={tag13Open ? "收起 13" : "展开 13"} aria-expanded={tag13Open} onClick={() => setTag13Open(!tag13Open)}><CaretRight size={12} className={tag13Open ? styles.rotated : ""} aria-hidden /></button>
                  <button type="button" className={styles.treeLabel} onClick={() => choose("tag-13", "13")}><span className={styles.dot} style={{ backgroundColor: "#ada34e" }} />13</button>
                </div>
                {tag13Open && <div role="group"><button type="button" className={styles.documentRow} data-selected={selection.id === "untitled"} onClick={() => choose("untitled", "Untitled")}><FileText size={15} weight="fill" aria-hidden />Untitled</button></div>}
              </div>
              {[
                { id: "dawa", label: "达瓦", color: "#d8777b", open: dawaOpen, toggle: () => setDawaOpen(!dawaOpen) },
                { id: "dawade", label: "达瓦的", color: "#cd9552", open: dawadeOpen, toggle: () => setDawadeOpen(!dawadeOpen) },
              ].map((tag) => <div key={tag.id} role="treeitem" aria-expanded={tag.open} aria-selected={selection.id === tag.id}>
                <div className={styles.treeRow} data-selected={selection.id === tag.id}>
                  <button type="button" className={styles.treeCaret} aria-label={`${tag.open ? "收起" : "展开"}${tag.label}`} aria-expanded={tag.open} onClick={tag.toggle}><CaretRight size={12} className={tag.open ? styles.rotated : ""} aria-hidden /></button>
                  <button type="button" className={styles.treeLabel} onClick={() => choose(tag.id, tag.label)}><span className={styles.dot} style={{ backgroundColor: tag.color }} />{tag.label}</button>
                </div>
                {tag.open && <div role="group" className={styles.emptyTree}>暂无文档</div>}
              </div>)}
            </div>}
          </section>

          <section className={styles.group} aria-label="最近">
            <div className={styles.sectionRow} data-selected={selection.id === "recent"}>
              <Clock size={16} aria-hidden />
              <button type="button" className={styles.sectionTitle} onClick={() => choose("recent", "最近", "recent")}>最近</button>
              <button type="button" className={styles.caretButton} aria-label={recentOpen ? "收起最近" : "展开最近"} aria-expanded={recentOpen} onClick={() => setRecentOpen(!recentOpen)}><CaretRight size={11} weight="fill" className={recentOpen ? styles.rotated : ""} aria-hidden /></button>
            </div>
            {recentOpen && <div className={styles.emptyTree}>暂无最近文档</div>}
          </section>
        </nav>
      </aside>

      <section className={styles.content} aria-label="知识库内容">
        <div className={styles.contentInner}>
          <span className={styles.eyebrow}>知识库</span>
          <h1>{selection.label}</h1>
          <p>{selection.id === "starred" ? "收藏的文档会显示在这里。" : selection.id === "untitled" ? "文档内容即将在这里呈现。" : "这个空间即将承载你的文档。"}</p>
        </div>
      </section>
    </div>
  )
}
