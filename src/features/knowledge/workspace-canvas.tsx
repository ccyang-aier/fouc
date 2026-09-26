'use client';

/**
 * The main column of the knowledge shell (U02): breadcrumb header above, the
 * workspace / teamspace overview below. Everything on screen is real server
 * state — the A00 access snapshot, the O01 workspace row and the O03 teamspace
 * row — and the states that cannot resolve yet say so instead of inventing
 * content. The canvas body for one page (E03) mounts here later.
 */

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { KnowledgeAuthUser } from './auth/auth-api';
import type { KnowledgeAccess } from './data/hooks';
import type { Teamspace, WorkspaceWithRole } from './organization/client';
import { AccessBadge, KindBadge, RoleBadge } from './organization/ui';
import { defaultAccessDescription, workspaceKindLabels } from './organization/view-model';
import { CanvasError, CanvasForbidden, CanvasNotice, CanvasSkeletonCard } from './canvas-states';

type CanvasPhase = 'workspace-loading' | 'workspace-error' | 'workspace-forbidden' | 'ready';

export function WorkspaceCanvas({
  phase,
  workspace,
  access,
  user,
  teamspaces,
  selectedTeamspace,
  errorText,
  onRetry,
  actions,
}: {
  phase: CanvasPhase;
  workspace: WorkspaceWithRole | null;
  access: KnowledgeAccess | undefined;
  user: KnowledgeAuthUser;
  teamspaces: readonly Teamspace[];
  selectedTeamspace: Teamspace | null;
  errorText?: string;
  onRetry?: () => void;
  /** Header actions of the shell (assistant-rail toggle). */
  actions?: ReactNode;
}) {
  return (
    <section aria-label="知识工作区" className="flex h-full min-w-0 flex-1 flex-col bg-[var(--panel)]">
      <header className="flex h-[42px] shrink-0 items-center justify-between gap-4 border-b border-[var(--line)] px-4">
        <nav aria-label="面包屑" className="flex min-w-0 items-center gap-1.5 text-[11px] text-[var(--muted)]">
          <span>知识库</span>
          {workspace ? (
            <>
              <span aria-hidden className="text-[var(--line-strong)]">/</span>
              <span className="truncate font-medium text-[var(--muted-strong)]">{workspace.name}</span>
            </>
          ) : null}
          {selectedTeamspace ? (
            <>
              <span aria-hidden className="text-[var(--line-strong)]">/</span>
              <span className="truncate font-medium text-[var(--muted-strong)]">{selectedTeamspace.name}</span>
            </>
          ) : null}
        </nav>
        {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {phase === 'workspace-loading' ? (
          <div role="status" aria-label="正在确认工作区访问">
            <CanvasSkeletonCard />
          </div>
        ) : phase === 'workspace-error' ? (
          <CanvasError
            title="无法确认工作区访问"
            detail={errorText ?? '知识服务暂时不可用，请稍后重试。'}
            onRetry={onRetry}
            retryLabel="重试连接"
          />
        ) : phase === 'workspace-forbidden' ? (
          <CanvasForbidden
            title="没有该工作区的访问权限"
            detail="当前凭证对这个工作区没有读取权限；如果是最近被移出或权限调整，请联系工作区所有者。"
          />
        ) : workspace ? (
          <WorkspaceOverview
            workspace={workspace}
            access={access}
            user={user}
            teamspaces={teamspaces}
            selectedTeamspace={selectedTeamspace}
          />
        ) : null}
      </div>
    </section>
  );
}

function WorkspaceOverview({
  workspace,
  access,
  user,
  teamspaces,
  selectedTeamspace,
}: {
  workspace: WorkspaceWithRole;
  access: KnowledgeAccess | undefined;
  user: KnowledgeAuthUser;
  teamspaces: readonly Teamspace[];
  selectedTeamspace: Teamspace | null;
}) {
  return (
    <div className="mx-auto w-full max-w-[640px] px-8 pb-10 pt-10">
      <p className="text-[11px] font-medium tracking-[0.04em] text-[var(--muted)]">
        {workspaceKindLabels[workspace.kind]}
      </p>
      <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
        <h1 className="text-[20px] font-semibold tracking-[-0.01em] text-[var(--ink)]">{selectedTeamspace?.name ?? workspace.name}</h1>
        {selectedTeamspace ? <AccessBadge access={selectedTeamspace.defaultAccess} /> : <KindBadge kind={workspace.kind} />}
        <RoleBadge role={access?.role ?? workspace.role} />
      </div>
      <p className="mt-2.5 max-w-[520px] text-[12.5px] leading-relaxed text-[var(--muted-strong)]">
        {selectedTeamspace
          ? defaultAccessDescription(selectedTeamspace.defaultAccess)
          : '在左侧选择一个团队空间查看它的页面目录；工作区级身份与访问能力如下。'}
      </p>

      {selectedTeamspace ? (
        <div className="mt-6 space-y-2.5">
          <div className="rounded-[10px] border border-[var(--line)] bg-[var(--surface-subtle)] px-4 py-3">
            <p className="text-[11px] font-medium text-[var(--muted-strong)]">页面目录</p>
            <p className="mt-1 text-[12px] leading-relaxed text-[var(--ink-soft)]">
              该团队空间尚未接入页面读取接口，页面树与正文编辑器会在接入后在这里展开。
            </p>
          </div>
        </div>
      ) : (
        <dl className="mt-6 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <OverviewCard title="会话身份">
            <OverviewLine label="账号" value={user.email} />
            <OverviewLine label="凭证" value={access ? credentialLabel(access.credentialKind) : '—'} />
            <OverviewLine label="主体" value={access ? actorLabel(access.actor) : '—'} mono />
          </OverviewCard>
          <OverviewCard title="访问能力">
            <OverviewLine label="角色" value={roleLabel(access?.role ?? workspace.role)} />
            <div className="flex items-start justify-between gap-3">
              <dt className="shrink-0 text-[11px] text-[var(--muted)]"> scopes</dt>
              <dd className="flex flex-wrap justify-end gap-1">
                {(access?.scopes ?? []).map((scope) => (
                  <ScopeChip key={scope} scope={scope} />
                ))}
                {!access?.scopes?.length ? <span className="text-[11.5px] text-[var(--ink-soft)]">—</span> : null}
              </dd>
            </div>
            <OverviewLine label="团队空间" value={`${teamspaces.length} 个`} />
          </OverviewCard>
        </dl>
      )}

      <div className="mt-5">
        <CanvasNotice>
          当前版本提供工作区与团队空间导航；页面正文编辑、页面树操作与评审 / AI 栏位将在接入后开放。
        </CanvasNotice>
      </div>
    </div>
  );
}

function OverviewCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-[10px] border border-[var(--line)] bg-[var(--surface-subtle)] px-4 py-3">
      <p className="mb-2 text-[11px] font-medium text-[var(--muted-strong)]">{title}</p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function OverviewLine({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-[11px] text-[var(--muted)]">{label}</dt>
      <dd className={cn('min-w-0 truncate text-[11.5px] text-[var(--ink-soft)]', mono && 'font-mono text-[10.5px]')} title={value}>
        {value}
      </dd>
    </div>
  );
}

function ScopeChip({ scope }: { scope: string }) {
  return (
    <span className="inline-flex h-[19px] items-center rounded-full border border-[var(--accent-soft-line)] bg-[var(--accent-soft)] px-2 text-[10px] font-medium text-[var(--accent-ink)]">
      {scope}
    </span>
  );
}

function credentialLabel(kind: 'session' | 'pat' | string | undefined): string {
  if (kind === 'pat') return '个人访问令牌';
  if (kind === 'session') return '登录会话';
  return kind ?? '—';
}

/** The access snapshot's actor is the human principal of this request. */
function actorLabel(actor: KnowledgeAccess['actor'] | undefined): string {
  if (!actor) return '—';
  if (typeof actor === 'string') return actor;
  return `${actor.kind}:${actor.userId}`;
}

function roleLabel(role: string): string {
  const labels: Record<string, string> = { owner: '所有者', admin: '管理员', member: '成员', guest: '访客' };
  return labels[role] ?? role;
}
