'use client';

import { useId, useRef, useState } from 'react';
import {
  Bell,
  CaretRight,
  Check,
  ClockCounterClockwise,
  DotsThree,
  FolderSimple,
  MagnifyingGlass,
  ShareNetwork,
  UsersThree,
} from '@phosphor-icons/react';
import { DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { DashboardMenu, DashboardMenuContent } from './dashboard-menu';
import { AvatarGroup, DashboardButton, IconButton, ReferenceIcon } from './dashboard-ui';
import type { DashboardSection } from './dashboard-sidebar';
import type { DashboardPersonId, DashboardTarget } from './dashboard-model';
import styles from './dashboard.module.css';

export interface DashboardSearchResult {
  id: string;
  title: string;
  detail: string;
  target: DashboardTarget;
}
interface ToolbarProps {
  section: DashboardSection;
  query: string;
  onQueryChange: (query: string) => void;
  results: DashboardSearchResult[];
  onOpen: (target: DashboardTarget) => void;
  memberIds: DashboardPersonId[];
  unreadCount: number;
  updatedAt: string | null;
  onBack: () => void;
  onShare: () => void;
  onNotify: () => void;
  onInvite: () => void;
  onViewProjects: () => void;
}

export function DashboardToolbar(props: ToolbarProps) {
  const {
    section,
    query,
    onQueryChange,
    results,
    onOpen,
    memberIds,
    unreadCount,
    updatedAt,
    onBack,
    onShare,
    onNotify,
    onInvite,
    onViewProjects,
  } = props;
  const [searchFocused, setSearchFocused] = useState(false);
  const [selectedResult, setSelectedResult] = useState(0);
  const searchInput = useRef<HTMLInputElement>(null);
  const resultId = useId();
  const visibleResults = results.slice(0, 8);
  const activeIndex = Math.min(selectedResult, visibleResults.length - 1);
  const showResults = searchFocused && Boolean(query.trim());

  function openResult(result: DashboardSearchResult) {
    setSearchFocused(false);
    onOpen(result.target);
  }

  return (
    <>
      <header className={styles.topbar}>
        <div className={styles.breadcrumb}>
          <button
            type="button"
            className="fouc-action"
            title="Back to Fouc projects"
            onClick={onBack}
          >
            Synchro
          </button>
          <CaretRight size={14} />
          <span>
            <ReferenceIcon name="dashboard" size={19} />
            {section}
          </span>
        </div>
        <div className={styles.topbarTools}>
          <div className={styles.searchWrap}>
            <label className={styles.search}>
              <MagnifyingGlass size={21} />
              <input
                ref={searchInput}
                role="combobox"
                aria-label="Search projects, tasks, documents and meetings"
                aria-expanded={showResults}
                aria-controls={showResults ? resultId : undefined}
                aria-activedescendant={
                  showResults && activeIndex >= 0 ? `${resultId}-${activeIndex}` : undefined
                }
                aria-autocomplete="list"
                value={query}
                placeholder="Search projects..."
                onChange={(event) => {
                  onQueryChange(event.target.value);
                  setSelectedResult(0);
                  setSearchFocused(true);
                }}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                    event.preventDefault();
                    setSearchFocused(true);
                    if (visibleResults.length)
                      setSelectedResult(
                        (index) =>
                          (index + (event.key === 'ArrowDown' ? 1 : -1) + visibleResults.length) %
                          visibleResults.length,
                      );
                  }
                  if (event.key === 'Enter' && visibleResults[activeIndex]) {
                    event.preventDefault();
                    openResult(visibleResults[activeIndex]);
                  }
                  if (event.key === 'Escape') {
                    onQueryChange('');
                    setSearchFocused(false);
                    searchInput.current?.blur();
                  }
                }}
              />
            </label>
            {showResults ? (
              <div
                className={styles.searchResults}
                id={resultId}
                role="listbox"
                aria-label="Search results"
              >
                {visibleResults.length ? (
                  visibleResults.map((result, index) => (
                    <button
                      id={`${resultId}-${index}`}
                      type="button"
                      role="option"
                      aria-selected={index === activeIndex}
                      className="fouc-action"
                      key={result.id}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => openResult(result)}
                    >
                      <FolderSimple size={17} />
                      <span>
                        {result.title}
                        <small>{result.detail}</small>
                      </span>
                    </button>
                  ))
                ) : (
                  <p role="status">No results found</p>
                )}
              </div>
            ) : null}
          </div>
          <span className={styles.toolbarDivider} />
          <IconButton label="Share Dashboard" onClick={onShare}>
            <ShareNetwork />
          </IconButton>
          <IconButton
            label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
            className={styles.notificationButton}
            onClick={onNotify}
          >
            <Bell />
            {unreadCount ? <i aria-hidden="true" /> : null}
          </IconButton>
        </div>
      </header>
      <div className={styles.titlebar}>
        <h1>{section}</h1>
        <div className={styles.titlebarTools}>
          <span
            className={styles.lastUpdated}
            title={updatedAt ? new Date(updatedAt).toLocaleString() : undefined}
          >
            {updatedAt ? <Check size={14} /> : <ClockCounterClockwise size={14} />}
            {updatedAt ? 'Saved' : '3 min ago'}
          </span>
          <button
            type="button"
            className={`fouc-action ${styles.collaborators}`}
            aria-label="Manage collaborators"
            onClick={onInvite}
          >
            <AvatarGroup
              ids={memberIds.slice(0, 3)}
              size={28}
              extra={Math.max(0, memberIds.length - 3)}
            />
          </button>
          <DashboardButton onClick={onInvite}>
            <UsersThree size={21} weight="fill" />
            Invite
          </DashboardButton>
          <DashboardMenu>
            <DropdownMenuTrigger asChild>
              <IconButton label="Dashboard options">
                <DotsThree weight="bold" />
              </IconButton>
            </DropdownMenuTrigger>
            <DashboardMenuContent align="end">
              <DropdownMenuItem onSelect={onShare}>
                <ShareNetwork />
                Copy Dashboard link
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onViewProjects}>
                <FolderSimple />
                View all projects
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onBack}>Back to Fouc projects</DropdownMenuItem>
            </DashboardMenuContent>
          </DashboardMenu>
        </div>
      </div>
    </>
  );
}
