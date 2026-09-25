"use client";

import * as React from "react";
import { ExpandedPrimarySidebar, type SidebarSectionId } from "./dense-sidebar/expanded-primary-sidebar";
import { getProjectIconDefinition } from "./dense-sidebar/project-icons";
import { DEFAULT_PROJECT_ICON_ID, type ProjectIconId } from "./dense-sidebar/project-icons";
import { ProjectIconPicker } from "./dense-sidebar/project-icon-picker";
import type { SidebarProjectNode, SidebarRecentNote } from "./dense-sidebar/sidebar-navigation";
import type { SidebarProjectAction } from "./dense-sidebar/sidebar-project-tree";
import type { SidebarTagAction } from "./dense-sidebar/sidebar-tag-tree";
import type { DocumentAction } from "./dense-sidebar/document-action-menu-content";
import { EMPTY_KNOWLEDGE, type DocumentVersion, type HyperdocDocumentSummary, type KnowledgeSnapshot } from "./knowledge-model";
import { loadDocumentVersions, loadKnowledge, runKnowledgeAction, type KnowledgeAction } from "./knowledge-client";
import { KnowledgeContent } from "./knowledge-content";
import { KnowledgeBaseHeader } from "./knowledge-base-header";
import styles from "./knowledge-canvas.module.css";

// Adapted from dense/src/shell/app-shell.tsx: buildSidebarProjects.
function buildSidebarProjects(projects: KnowledgeSnapshot["projects"], documents: HyperdocDocumentSummary[]): SidebarProjectNode[] {
  const projectIds = new Set(projects.map((project) => project.id));
  const childrenByParent = new Map<string | null, typeof projects>();
  for (const project of projects) {
    const parentId = project.parentId && projectIds.has(project.parentId) ? project.parentId : null;
    const siblings = childrenByParent.get(parentId) ?? [];
    siblings.push(project);
    childrenByParent.set(parentId, siblings);
  }
  const documentsByProject = new Map<string, typeof documents>();
  for (const document of documents) {
    if (!document.projectId) continue;
    const siblings = documentsByProject.get(document.projectId) ?? [];
    siblings.push(document);
    documentsByProject.set(document.projectId, siblings);
  }
  const toNode = (project: (typeof projects)[number]): SidebarProjectNode => {
    const children: SidebarProjectNode[] = [
      ...(childrenByParent.get(project.id) ?? []).map(toNode),
      ...(documentsByProject.get(project.id) ?? []).map((document) => ({ id: document.id, kind: "document" as const, label: document.title, icon: "file" as const, starred: document.starred })),
    ];
    return { id: project.id, kind: "project", label: project.name, projectIconId: getProjectIconDefinition(project.iconId).id, starred: project.starred, expandable: children.length > 0, defaultExpanded: children.length > 0, children };
  };
  return (childrenByParent.get(null) ?? []).map(toNode);
}

const tagPalette = ["#ada34e", "#d8777b", "#cd9552", "#6e9a8f", "#798dc0"];

export function KnowledgePage({ onOpenSettings }: { onOpenSettings: () => void }) {
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [library, setLibrary] = React.useState<KnowledgeSnapshot>(EMPTY_KNOWLEDGE);
  const [activeKnowledgeBaseId, setActiveKnowledgeBaseId] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = React.useState<string | null>(null);
  const [activeItem, setActiveItem] = React.useState("all-documents");
  const [activeResource, setActiveResource] = React.useState<string | null>(null);
  const [activeDocumentId, setActiveDocumentId] = React.useState<string | null>(null);
  const [activeDocumentLocation, setActiveDocumentLocation] = React.useState<"project" | "recent" | "tag" | null>(null);
  const [expandedSections, setExpandedSections] = React.useState<Record<SidebarSectionId, boolean>>({ projects: true, tags: true, recent: false });
  const [expandedProjects, setExpandedProjects] = React.useState<Record<string, boolean>>({});
  const [expandedTags, setExpandedTags] = React.useState<Record<string, boolean>>({});
  const [projectDialogOpen, setProjectDialogOpen] = React.useState(false);
  const [projectName, setProjectName] = React.useState("");
  const [projectIconId, setProjectIconId] = React.useState<ProjectIconId>(DEFAULT_PROJECT_ICON_ID);
  const [tabs, setTabs] = React.useState<string[]>([]);
  const [splitDocumentId, setSplitDocumentId] = React.useState<string | null>(null);
  const [infoDocumentId, setInfoDocumentId] = React.useState<string | null>(null);
  const [historyDocumentId, setHistoryDocumentId] = React.useState<string | null>(null);
  const [versions, setVersions] = React.useState<DocumentVersion[]>([]);
  const snapshotRequest = React.useRef(0);

  const applySnapshot = React.useCallback((next: KnowledgeSnapshot) => {
    const projectIds = new Set(next.projects.map((project) => project.id));
    const knowledgeBaseIds = next.projects.filter((project) => !project.parentId).map((project) => project.id);
    const documentIds = new Set(next.documents.map((document) => document.id));
    setLibrary(next);
    setActiveKnowledgeBaseId((current) => current && knowledgeBaseIds.includes(current) ? current : knowledgeBaseIds[0] ?? null);
    setActiveResource((current) => current?.startsWith("project:") && !projectIds.has(current.slice(8)) ? null : current);
    setActiveDocumentId((current) => current && !documentIds.has(current) ? null : current);
    setTabs((current) => current.filter((id) => documentIds.has(id)));
    setSplitDocumentId((current) => current && !documentIds.has(current) ? null : current);
    setInfoDocumentId((current) => current && !documentIds.has(current) ? null : current);
    setHistoryDocumentId((current) => current && !documentIds.has(current) ? null : current);
    setStatus("ready");
    setError(null);
  }, []);
  const refresh = React.useCallback(async () => {
    const request = ++snapshotRequest.current;
    const next = await loadKnowledge();
    if (request === snapshotRequest.current) applySnapshot(next);
    return next;
  }, [applySnapshot]);
  React.useEffect(() => {
    const requests = snapshotRequest;
    let firstLoad = true;
    const update = () => {
      const initial = firstLoad;
      firstLoad = false;
      void refresh().catch((cause) => { if (initial) { setError(String(cause)); setStatus("error"); } });
    };
    const updateWhenVisible = () => { if (document.visibilityState === "visible") update(); };
    update();
    window.addEventListener("focus", updateWhenVisible);
    document.addEventListener("visibilitychange", updateWhenVisible);
    const timer = window.setInterval(updateWhenVisible, 30_000);
    return () => { requests.current++; window.removeEventListener("focus", updateWhenVisible); document.removeEventListener("visibilitychange", updateWhenVisible); window.clearInterval(timer); };
  }, [refresh]);
  const act = React.useCallback(async <T,>(input: KnowledgeAction): Promise<T | null> => {
    try {
      setError(null);
      const result = await runKnowledgeAction<T>(input);
      await refresh();
      return result;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      if (message.includes("不存在")) {
        try { await refresh(); setError("所选内容已变化，知识库已刷新，请重试。"); return null; } catch { /* Show the original error if refresh also fails. */ }
      }
      setError(message);
      return null;
    }
  }, [refresh]);

  const activeDocuments = React.useMemo(() => library.documents.filter((document) => !document.trashedAt), [library.documents]);
  const knowledgeBases = React.useMemo(() => library.projects.filter((project) => !project.parentId), [library.projects]);
  const sidebarProjects = React.useMemo(() => buildSidebarProjects(library.projects, activeDocuments), [library.projects, activeDocuments]);
  const recentNotes = React.useMemo<SidebarRecentNote[]>(() => activeDocuments.slice(0, 10).map((document) => ({ id: document.id, label: document.title, starred: document.starred })), [activeDocuments]);
  const tagDocuments = React.useMemo(() => Object.fromEntries(library.tags.map((tag) => [tag.id, activeDocuments.filter((document) => library.documentTags[document.id]?.includes(tag.id))])), [library, activeDocuments]);

  function navigate(id: string) { setActiveItem(id); setActiveResource(null); setActiveDocumentId(null); setActiveDocumentLocation(null); }
  function selectProject(id: string) {
    setActiveResource(id);
    setActiveDocumentId(null);
    setActiveDocumentLocation(null);
    let project = library.projects.find((item) => item.id === id.slice(8));
    while (project?.parentId) project = library.projects.find((item) => item.id === project?.parentId);
    if (project) setActiveKnowledgeBaseId(project.id);
  }
  function selectKnowledgeBase(id: string) { selectProject(`project:${id}`); }
  function openProjectDialog() { setProjectName(""); setProjectIconId(DEFAULT_PROJECT_ICON_ID); setProjectDialogOpen(true); }
  function openDocument(id: string, location: "project" | "recent" | "tag" | null = null) { setActiveDocumentId(id); setActiveResource(null); setActiveDocumentLocation(location); setTabs((current) => current.includes(id) ? current : [...current, id]); }
  async function createDocument(projectId: string | null = null, tagId: string | null = null) { const document = await act<HyperdocDocumentSummary>({ action: "create-document", projectId, tagId }); if (document) openDocument(document.id, tagId ? "tag" : projectId ? "project" : null); }
  async function createProject(name: string, parentId: string | null = null, iconId: ProjectIconId = DEFAULT_PROJECT_ICON_ID) { const project = await act<{ id: string }>({ action: "create-project", name, iconId, parentId }); if (project) { if (!parentId) setActiveKnowledgeBaseId(project.id); selectProject(`project:${project.id}`); } }

  // Adapted from dense/src/shell/app-shell.tsx: sidebar action handlers.
  function projectAction(id: string, action: SidebarProjectAction) {
    const project = library.projects.find((item) => item.id === id);
    if (!project) return;
    if (action === "new-document") { void createDocument(id); return; }
    if (action === "rename") { const name = window.prompt("重命名知识库", project.name)?.trim(); if (name && name !== project.name) void act({ action: "rename-project", id, name }); return; }
    if (action === "new-subfolder") { const name = window.prompt("子知识库名称")?.trim(); if (name) void createProject(name, id); return; }
    if (action === "add-tag") { const name = window.prompt("标签名称")?.trim(); if (name) void act({ action: "create-tag", name, color: tagPalette[library.tags.length % tagPalette.length] }); return; }
    if (action === "toggle-star") { void act({ action: "star-project", id, starred: !project.starred }); return; }
    if (action === "delete" && window.confirm(`删除「${project.name}」？其中的文档会保留。`)) { void act({ action: "delete-project", id }).then(() => navigate("projects")); }
  }
  function tagAction(id: string, action: SidebarTagAction) {
    const tag = library.tags.find((item) => item.id === id);
    if (!tag) return;
    if (action === "new-document") { void createDocument(null, id); return; }
    if (action === "rename") { const name = window.prompt("重命名标签", tag.name)?.trim(); if (name && name !== tag.name) void act({ action: "rename-tag", id, name }); return; }
    if (action === "delete" && window.confirm(`删除「${tag.name}」？文档会保留。`)) void act({ action: "delete-tag", id });
  }
  function documentAction(id: string, action: DocumentAction) {
    const document = library.documents.find((item) => item.id === id);
    if (!document) return;
    if (action === "rename") { const title = window.prompt("重命名文档", document.title)?.trim(); if (title && title !== document.title) void act({ action: "update-document", id, title }); return; }
    if (action === "info") { setInfoDocumentId(id); return; }
    if (action === "open-new-tab") { openDocument(id); return; }
    if (action === "open-split") { if (activeDocumentId && activeDocumentId !== id) setSplitDocumentId(id); else openDocument(id); return; }
    if (action === "toggle-star") { void act({ action: "star-document", id, starred: !document.starred }); return; }
    if (action === "remove-from-folder") { void act({ action: "move-document", id, projectId: null }); return; }
    if (action === "history") { openDocument(id); setHistoryDocumentId(id); void loadDocumentVersions(id).then(setVersions).catch((cause) => setError(String(cause))); return; }
    if (action === "trash") { void act({ action: "trash-document", id, trashed: true }).then(() => { if (activeDocumentId === id) { setActiveDocumentId(null); setTabs((current) => current.filter((tab) => tab !== id)); } }); }
  }

  return <div className={styles.layout}>
    <ExpandedPrimarySidebar
      collapsed={sidebarCollapsed}
      header={<KnowledgeBaseHeader knowledgeBases={knowledgeBases} activeKnowledgeBaseId={activeKnowledgeBaseId} onSelectKnowledgeBase={selectKnowledgeBase} onCollapse={() => setSidebarCollapsed(true)} onCreateKnowledgeBase={openProjectDialog} onOpenSettings={onOpenSettings} />}
      className={styles.sidebar} activeItem={activeItem} activeResource={activeResource} activeDocumentId={activeDocumentId} activeDocumentLocation={activeDocumentLocation} projects={sidebarProjects} tags={library.tags} tagDocuments={tagDocuments} recentNotes={recentNotes} expandedProjects={expandedProjects} expandedTags={expandedTags} expandedSections={expandedSections} onNavigateMain={navigate} onBrowseProjects={() => navigate("projects")} onSelectProject={(id) => selectProject(`project:${id}`)} onSelectDocument={(id) => openDocument(id, "project")} onToggleProject={(id) => setExpandedProjects((current) => ({ ...current, [id]: !(current[id] ?? sidebarProjects.some((node) => node.id === id && node.defaultExpanded)) }))} onProjectAction={projectAction} onTagAction={tagAction} onDocumentAction={documentAction} onToggleSection={(section) => setExpandedSections((current) => ({ ...current, [section]: !current[section] }))} onNewProject={openProjectDialog} onCreateTag={(name) => { void act({ action: "create-tag", name, color: tagPalette[library.tags.length % tagPalette.length] }); }} onSelectTagDocument={(id) => openDocument(id, "tag")} onToggleTag={(id) => setExpandedTags((current) => ({ ...current, [id]: !(current[id] ?? true) }))} onSelectRecent={(id) => openDocument(id, "recent")} />
    <KnowledgeContent library={library} status={status} error={error} clearError={() => setError(null)} retry={() => { setStatus("loading"); void refresh().catch((cause) => { setError(String(cause)); setStatus("error"); }); }} onExpandSidebar={sidebarCollapsed ? () => setSidebarCollapsed(false) : undefined} activeItem={activeItem} activeResource={activeResource} activeDocumentId={activeDocumentId} tabs={tabs} splitDocumentId={splitDocumentId} infoDocumentId={infoDocumentId} historyDocumentId={historyDocumentId} versions={versions} setTabs={setTabs} setActiveDocumentId={setActiveDocumentId} setSplitDocumentId={setSplitDocumentId} setInfoDocumentId={setInfoDocumentId} setHistoryDocumentId={setHistoryDocumentId} openDocument={openDocument} selectProject={selectProject} createDocument={createDocument} openProjectDialog={openProjectDialog} act={act} />
    {projectDialogOpen && <div className={styles.dialogBackdrop} role="presentation" onMouseDown={() => setProjectDialogOpen(false)}><form className={styles.dialog} role="dialog" aria-modal="true" aria-label="新建知识库" onMouseDown={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); const name = projectName.trim(); if (name) { void createProject(name, null, projectIconId); setProjectDialogOpen(false); } }}><h2>新建知识库</h2><label>知识库名称<input autoFocus value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="输入知识库名称" maxLength={36} /></label><ProjectIconPicker value={projectIconId} onChange={setProjectIconId} /><div><button type="button" onClick={() => setProjectDialogOpen(false)}>取消</button><button type="submit" disabled={!projectName.trim()}>创建知识库</button></div></form></div>}
  </div>;
}
