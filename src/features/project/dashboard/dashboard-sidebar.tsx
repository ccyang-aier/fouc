'use client';

import {
  ChartBar,
  ChartPieSlice,
  CaretDown,
  CaretUp,
  FilePlus,
  Flag,
  House,
  ListBullets,
  Plus,
  SidebarSimple,
  SquaresFour,
  Tray,
  UserCircle,
  Question,
  DotsThree,
} from '@phosphor-icons/react';
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, IconButton, ReferenceIcon } from './dashboard-ui';
import type { DashboardFavorite, DashboardTarget } from './dashboard-model';
import {
  DashboardMenu as DropdownMenu,
  DashboardMenuContent as DropdownMenuContent,
} from './dashboard-menu';
import styles from './dashboard.module.css';

export type DashboardSection =
  'Dashboard' | 'My Task' | 'Inbox' | 'Reporting' | 'Portfolio' | 'Accounts' | 'Goals';

const navigation = [
  { name: 'Dashboard', icon: SquaresFour },
  { name: 'My Task', icon: FilePlus },
  { name: 'Inbox', icon: Tray },
  { name: 'Reporting', icon: ChartPieSlice },
  { name: 'Portfolio', icon: ChartBar },
  { name: 'Accounts', icon: UserCircle },
  { name: 'Goals', icon: Flag },
] as const;

interface DashboardSidebarProps {
  section: DashboardSection;
  onSectionChange: (section: DashboardSection) => void;
  collapsed: boolean;
  onCollapse: () => void;
  favorites: DashboardFavorite[];
  unreadCount: number;
  onCreate: () => void;
  onFavorite: (target: DashboardTarget) => void;
  onAddFavorite: () => void;
  onViewFavorites: () => void;
  onHelp: () => void;
  projectName: string;
  onBack: () => void;
}

export function DashboardSidebar({
  section,
  onSectionChange,
  collapsed,
  onCollapse,
  favorites,
  unreadCount,
  onCreate,
  onFavorite,
  onAddFavorite,
  onViewFavorites,
  onHelp,
  projectName,
  onBack,
}: DashboardSidebarProps) {
  return (
    <aside className={styles.sidebar} data-collapsed={collapsed} aria-label="Project navigation">
      <div className={styles.identity}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={styles.profile} aria-label="Sarah Smither account menu">
              <Avatar id="sarah" size={40} />
              <span>
                <strong>Sarah Smither</strong>
                <small>sarahsmit@mail.com</small>
              </span>
              <CaretDown size={14} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={onBack}>
              <House />
              Back to Fouc projects
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onSectionChange('Accounts')}>
              <UserCircle />
              Team accounts
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>{projectName}</DropdownMenuLabel>
          </DropdownMenuContent>
        </DropdownMenu>
        <IconButton
          className={styles.collapse}
          label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={onCollapse}
        >
          <SidebarSimple />
        </IconButton>
      </div>
      <div className={styles.sidebarContent}>
        <button type="button" className={styles.createTask} onClick={onCreate}>
          <Plus size={17} />
          <span>Create Task</span>
        </button>
        <nav className={styles.navigation} aria-label="Dashboard sections">
          {navigation.map(({ name, icon: Icon }) => (
            <button
              type="button"
              className="fouc-action"
              key={name}
              title={collapsed ? name : undefined}
              aria-label={name}
              aria-current={section === name ? 'page' : undefined}
              onClick={() => onSectionChange(name)}
            >
              {name === 'Dashboard' ? <ReferenceIcon name="dashboard" /> : <Icon size={20} />}
              <span>{name}</span>
              {name === 'Inbox' && unreadCount > 0 ? <small>{unreadCount}</small> : null}
            </button>
          ))}
        </nav>
        <div className={styles.favorites}>
          <details open>
            <summary className="fouc-action">
              <CaretUp size={16} />
              <span>Favourite</span>
              <CaretDown className={styles.closedCaret} size={16} />
            </summary>
            <div className={styles.favoriteActions}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className="fouc-action" aria-label="Favourite options">
                    <DotsThree size={18} weight="bold" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onSelect={onViewFavorites}>View favourites</DropdownMenuItem>
                  <DropdownMenuItem onSelect={onAddFavorite}>
                    <Plus />
                    Add favourite
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <button
                type="button"
                className="fouc-action"
                aria-label="Add favourite"
                onClick={onAddFavorite}
              >
                <Plus size={15} />
              </button>
            </div>
            <div className={styles.favoriteList}>
              {favorites.map((favorite) => (
                <button
                  type="button"
                  className="fouc-action"
                  key={favorite.id}
                  title={favorite.label}
                  onClick={() => onFavorite(favorite.target)}
                >
                  <ListBullets size={18} />
                  <span>{favorite.label}</span>
                </button>
              ))}
            </div>
          </details>
        </div>
      </div>
      <button type="button" className={`fouc-action ${styles.help}`} onClick={onHelp}>
        <span>Help Center</span>
        <Question size={22} />
      </button>
    </aside>
  );
}
