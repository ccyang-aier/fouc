'use client';
import { translateFixed } from '../i18n/display';

import { useTranslation } from '@/lib/i18n';
import { openSettings } from '@/lib/settings-navigation';
import { fixtureField } from '../i18n/display';
import { messages } from './i18n/dashboard-sidebar';

import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  CaretDown,
  CaretUp,
  ChartBar,
  ChartPieSlice,
  DotsThree,
  FilePlus,
  Flag,
  House,
  ListBullets,
  Plus,
  Question,
  SidebarSimple,
  SquaresFour,
  Tray,
  UserCircle,
} from '@phosphor-icons/react';
import {
  DashboardMenu as DropdownMenu,
  DashboardMenuContent as DropdownMenuContent,
} from './dashboard-menu';
import type { DashboardFavorite, DashboardTarget } from './dashboard-model';
import { Avatar, IconButton, ReferenceIcon } from './dashboard-ui';
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
  const { t, locale } = useTranslation(messages);
  const uiLabel = (value: string) => translateFixed(value, locale);

  return (
    <aside
      className={styles.sidebar}
      data-collapsed={collapsed}
      aria-label={t('Project navigation')}
    >
      <div className={styles.identity}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={styles.profile} aria-label={t('Sarah Smither account menu')}>
              <Avatar id="sarah" size={40} />
              <span>
                <strong>{t('Sarah Smither')}</strong>
                <small>{t('sarahsmit@mail.com')}</small>
              </span>
              <CaretDown size={14} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={onBack}>
              <House />
              {t('Back to Fouc projects')}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onSectionChange('Accounts')}>
              <UserCircle />
              {t('Team accounts')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => openSettings('general')}>
              {uiLabel('Settings')}
            </DropdownMenuItem>
            <DropdownMenuLabel>{projectName}</DropdownMenuLabel>
          </DropdownMenuContent>
        </DropdownMenu>
        <IconButton
          className={styles.collapse}
          label={collapsed ? t('Expand sidebar') : t('Collapse sidebar')}
          onClick={onCollapse}
        >
          <SidebarSimple />
        </IconButton>
      </div>
      <div className={styles.sidebarContent}>
        <button type="button" className={styles.createTask} onClick={onCreate}>
          <Plus size={17} />
          <span>{t('Create Task')}</span>
        </button>
        <nav className={styles.navigation} aria-label={t('Dashboard sections')}>
          {navigation.map(({ name, icon: Icon }) => (
            <button
              type="button"
              className="fouc-action"
              key={name}
              title={collapsed ? uiLabel(name) : undefined}
              aria-label={uiLabel(name)}
              aria-current={section === name ? 'page' : undefined}
              onClick={() => onSectionChange(name)}
            >
              {name === 'Dashboard' ? <ReferenceIcon name="dashboard" /> : <Icon size={20} />}
              <span>{uiLabel(name)}</span>
              {name === 'Inbox' && unreadCount > 0 ? <small>{unreadCount}</small> : null}
            </button>
          ))}
        </nav>
        <div className={styles.favorites}>
          <details open>
            <summary className="fouc-action">
              <CaretUp size={16} />
              <span>{t('Favourite')}</span>
              <CaretDown className={styles.closedCaret} size={16} />
            </summary>
            <div className={styles.favoriteActions}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className="fouc-action" aria-label={t('Favourite options')}>
                    <DotsThree size={18} weight="bold" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onSelect={onViewFavorites}>
                    {t('View favourites')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={onAddFavorite}>
                    <Plus />
                    {t('Add favourite')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <button
                type="button"
                className="fouc-action"
                aria-label={t('Add favourite')}
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
                  title={fixtureField(favorite, 'label', locale)}
                  onClick={() => onFavorite(favorite.target)}
                >
                  <ListBullets size={18} />
                  <span>{fixtureField(favorite, 'label', locale)}</span>
                </button>
              ))}
            </div>
          </details>
        </div>
      </div>
      <button type="button" className={`fouc-action ${styles.help}`} onClick={onHelp}>
        <span>{t('Help Center')}</span>
        <Question size={22} />
      </button>
    </aside>
  );
}
