"use client";

import type * as React from "react";
import { ArrowUUpLeft, ClockCounterClockwise, FilePlus, FolderPlus, SidebarSimple, Star, Trash, X } from "@phosphor-icons/react";
import type { DocumentVersion, KnowledgeSnapshot } from "./knowledge-model";
import type { KnowledgeAction } from "./knowledge-client";
import styles from "./knowledge-canvas.module.css";

const headings: Record<string, string> = { home: "首页", "all-documents": "全部文档", starred: "星标", trash: "回收站", projects: "项目", recent: "最近" };

interface Props {
  library: KnowledgeSnapshot; status: "loading" | "ready" | "error"; error: string | null;
  clearError: () => void; retry: () => void; activeItem: string; activeResource: string | null;
  onExpandSidebar?: () => void;
  activeDocumentId: string | null; tabs: string[]; splitDocumentId: string | null;
  infoDocumentId: string | null; historyDocumentId: string | null; versions: DocumentVersion[];
  setTabs: React.Dispatch<React.SetStateAction<string[]>>; setActiveDocumentId: (id: string | null) => void;
  setSplitDocumentId: (id: string | null) => void; setInfoDocumentId: (id: string | null) => void;
  setHistoryDocumentId: (id: string | null) => void; openDocument: (id: string) => void;
  createDocument: (projectId?: string | null) => Promise<void>; openProjectDialog: () => void;
  act: (input: KnowledgeAction) => Promise<unknown>;
}

export function KnowledgeContent(props: Props) {
  const { library, activeItem, activeDocumentId, tabs } = props;
  const activeDocument = library.documents.find((document) => document.id === activeDocumentId) ?? null;
  const splitDocument = library.documents.find((document) => document.id === props.splitDocumentId) ?? null;
  const infoDocument = library.documents.find((document) => document.id === props.infoDocumentId) ?? null;
  const projectId = props.activeResource?.startsWith("project:") ? props.activeResource.slice(8) : null;
  const activeProject = library.projects.find((project) => project.id === projectId);

  const liveDocuments = library.documents.filter((document) => !document.trashedAt);
  const listedDocuments = activeProject ? liveDocuments.filter((document) => document.projectId === activeProject.id) : activeItem === "trash" ? library.documents.filter((document) => document.trashedAt) : activeItem === "starred" ? liveDocuments.filter((document) => document.starred) : liveDocuments;

  return <main className={styles.content}>
    {props.onExpandSidebar && <button type="button" className={styles.expandSidebar} aria-label="展开知识库侧边栏" title="展开知识库侧边栏" onClick={props.onExpandSidebar}><SidebarSimple aria-hidden="true" weight="regular" /></button>}
    {props.error && <div role="alert" className={styles.error}>{props.error}<button type="button" onClick={props.clearError} aria-label="关闭错误"><X size={15} /></button></div>}
    {props.status === "loading" ? <div className={styles.empty}>正在加载知识库…</div> : props.status === "error" ? <div className={styles.empty}><button type="button" onClick={props.retry}>重试连接知识库</button></div> : activeDocument ? <>
      {tabs.length > 0 && <div className={`${styles.tabs} ${props.onExpandSidebar ? styles.tabsWithExpand : ""}`}>{tabs.map((id) => { const document = library.documents.find((item) => item.id === id); return document && <div key={id} className={styles.tab} data-active={id === activeDocumentId}><button type="button" onClick={() => props.openDocument(id)}>{document.title}</button><button type="button" aria-label={`关闭 ${document.title}`} onClick={() => { const next = tabs.filter((tab) => tab !== id); props.setTabs(next); if (activeDocumentId === id) props.setActiveDocumentId(next.at(-1) ?? null); }}><X size={12} /></button></div>; })}</div>}
      <div className={styles.editorLayout}><article className={styles.editor}><input aria-label="文档标题" key={activeDocument.id + activeDocument.title} defaultValue={activeDocument.title} onBlur={(event) => { const title = event.target.value.trim(); if (title && title !== activeDocument.title) void props.act({ action: "update-document", id: activeDocument.id, title }); }} className={styles.titleInput} /><textarea aria-label="文档内容" key={activeDocument.id + activeDocument.updatedAt} defaultValue={activeDocument.content} onBlur={(event) => { const content = event.target.value; if (content !== activeDocument.content) void props.act({ action: "update-document", id: activeDocument.id, content }); }} className={styles.editorInput} placeholder="开始记录…" /></article>{splitDocument && <article className={styles.editor}><div className={styles.splitHeader}>{splitDocument.title}<button type="button" onClick={() => props.setSplitDocumentId(null)} aria-label="关闭分屏"><X size={14} /></button></div><p>{splitDocument.content || "暂无内容"}</p></article>}</div>
    </> : <div className={styles.libraryView}>
      <div className={styles.viewHeader}><div><span className={styles.eyebrow}>知识库</span><h1>{activeProject?.name ?? headings[activeItem] ?? "知识库"}</h1></div>{activeItem !== "trash" && <button type="button" className={styles.primaryAction} onClick={() => void props.createDocument(activeProject?.id ?? null)}><FilePlus size={16} />新建文档</button>}</div>
      {listedDocuments.length ? <div className={styles.documentList}>{listedDocuments.map((document) => <div key={document.id} className={styles.documentCard}><button type="button" onClick={() => props.openDocument(document.id)}><span>{document.title}</span><small>{new Date(document.updatedAt).toLocaleDateString("zh-CN")}</small></button>{document.trashedAt ? <><button type="button" aria-label="恢复文档" title="恢复" onClick={() => void props.act({ action: "trash-document", id: document.id, trashed: false })}><ArrowUUpLeft size={16} /></button><button type="button" aria-label="永久删除文档" title="永久删除" onClick={() => { if (window.confirm(`永久删除「${document.title}」？`)) void props.act({ action: "delete-document", id: document.id }); }}><Trash size={16} /></button></> : <button type="button" aria-label={document.starred ? "取消星标" : "添加星标"} onClick={() => void props.act({ action: "star-document", id: document.id, starred: !document.starred })}><Star size={16} weight={document.starred ? "fill" : "regular"} /></button>}</div>)}</div> : <div className={styles.empty}>{activeItem === "trash" ? "回收站为空" : "这里还没有文档"}</div>}
      {activeItem === "projects" && <button type="button" className={styles.secondaryAction} onClick={props.openProjectDialog}><FolderPlus size={16} />新建项目</button>}
    </div>}
    {infoDocument && <div className={styles.dialogBackdrop} role="presentation" onMouseDown={() => props.setInfoDocumentId(null)}><div className={styles.dialog} role="dialog" aria-modal="true" aria-label="文档信息" onMouseDown={(event) => event.stopPropagation()}><h2>文档信息</h2><p>标题：{infoDocument.title}</p><p>创建时间：{new Date(infoDocument.createdAt).toLocaleString("zh-CN")}</p><p>最近更新：{new Date(infoDocument.updatedAt).toLocaleString("zh-CN")}</p><button type="button" onClick={() => props.setInfoDocumentId(null)}>关闭</button></div></div>}
    {props.historyDocumentId && <div className={styles.dialogBackdrop} role="presentation" onMouseDown={() => props.setHistoryDocumentId(null)}><div className={styles.dialog} role="dialog" aria-modal="true" aria-label="版本历史" onMouseDown={(event) => event.stopPropagation()}><h2><ClockCounterClockwise size={18} />版本历史</h2>{props.versions.length ? props.versions.map((version) => <div key={version.id} className={styles.version}><span>{new Date(version.createdAt).toLocaleString("zh-CN")} · {version.title}</span><button type="button" onClick={() => { void props.act({ action: "restore-version", id: props.historyDocumentId!, versionId: version.id }); props.setHistoryDocumentId(null); }}>恢复</button></div>) : <p>暂无历史版本</p>}<button type="button" onClick={() => props.setHistoryDocumentId(null)}>关闭</button></div></div>}
  </main>;
}
