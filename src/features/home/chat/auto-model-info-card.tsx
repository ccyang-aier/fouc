'use client';

import { useId, useState } from 'react';
import { ArrowCounterClockwise, ArrowLeft, Check, WarningCircle } from '@phosphor-icons/react';
import type { ModelCatalogEntry } from '@fouc/shared/model-catalog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTranslation } from '@/lib/i18n';
import type { AutoModelRules } from './chat-types';
import { autoExecutionOption, modelExecutionOption, modelProviders } from './chat-execution-options';
import { ChatExecutionLogo } from './chat-execution-logo';
import styles from './auto-model-info-card.module.css';

const autoModelMessages = {
  details: ['Auto 设置', 'Auto settings'],
  description: ['根据任务类型与复杂度自动选择合适模型', 'Automatically choose a suitable model for each task’s type and complexity'],
  candidates: ['候选模型', 'Candidate models'],
  selected: ['已选 {selected} / {total}', '{selected} of {total} selected'],
  selectAll: ['全选', 'Select all'],
  reset: ['重置', 'Reset'],
  resetHint: ['恢复为全部目录模型', 'Restore all catalog models'],
  minimum: ['至少保留一个候选模型', 'Keep at least one candidate model'],
  blocked: ['已保留此模型，至少需要一个候选模型', 'This model was kept. At least one candidate is required.'],
  missing: ['请选择至少一个当前可用的候选模型', 'Select at least one currently available candidate model'],
  loading: ['正在加载模型…', 'Loading models…'],
  unavailable: ['模型目录暂不可用', 'Model catalog unavailable'],
  empty: ['暂未发布模型资料', 'No model metadata published yet'],
  retry: ['重试', 'Retry'],
  draft: ['草稿偏好 · 自动路由尚未启用', 'Draft preferences · Automatic routing is not enabled yet'],
  back: ['返回模型列表', 'Back to models'],
  useAuto: ['使用 Auto', 'Use Auto'],
} as const;

export function AutoModelInfoCard({ models, rules, onChange, onSelect, onClose, loading, unavailable, onRetry }: {
  models: ModelCatalogEntry[];
  rules: AutoModelRules;
  onChange: (rules: AutoModelRules) => void;
  onSelect: () => void;
  onClose: () => void;
  loading: boolean;
  unavailable: boolean;
  onRetry: () => void;
}) {
  const { t } = useTranslation(autoModelMessages);
  const feedbackId = useId();
  const [blockedModelId, setBlockedModelId] = useState<string | null>(null);
  const availableIds = new Set(models.map(model => model.id));
  const selectedIds = rules.modelIds === null
    ? availableIds
    : new Set(rules.modelIds.filter(id => availableIds.has(id)));
  const selectedCount = selectedIds.size;
  const hasModels = models.length > 0;
  const canEdit = hasModels && !loading && !unavailable;
  const blocked = blockedModelId !== null && selectedCount === 1 && selectedIds.has(blockedModelId);

  function updateRules(nextRules: AutoModelRules) {
    setBlockedModelId(null);
    onChange(nextRules);
  }

  function toggleModel(modelId: string) {
    if (selectedIds.has(modelId) && selectedCount <= 1) {
      setBlockedModelId(modelId);
      return;
    }
    const nextIds = models
      .filter(model => model.id === modelId ? !selectedIds.has(model.id) : selectedIds.has(model.id))
      .map(model => model.id);
    updateRules({ modelIds: nextIds });
  }

  return <article className={styles.card} aria-label={t('details')} onKeyDown={event => {
    if (event.key !== 'Escape') event.stopPropagation();
  }}>
    <header className={styles.header}>
      <Button type="button" variant="ghost" size="icon-sm" className={styles.back} aria-label={t('back')} onClick={onClose}>
        <ArrowLeft size={16} />
      </Button>
      <div className={styles.identity}>
        <ChatExecutionLogo option={autoExecutionOption} size={28} />
        <h2>Auto</h2>
      </div>
      <p className={styles.description}>{t('description')}</p>
    </header>

    <section className={styles.rules} aria-label={t('candidates')}>
      <div className={styles.rulesHeader}>
        <h3>{t('candidates')}</h3>
        <span className={styles.count} aria-live="polite">{t('selected', { selected: selectedCount, total: models.length })}</span>
      </div>
      <div className={styles.toolbar}>
        <Button type="button" variant="ghost" size="sm" disabled={!canEdit || selectedCount === models.length}
          onClick={() => updateRules({ modelIds: models.map(model => model.id) })}>
          <Check size={13} />{t('selectAll')}
        </Button>
        <Button type="button" variant="ghost" size="sm" disabled={!canEdit || rules.modelIds === null}
          title={t('resetHint')} onClick={() => updateRules({ modelIds: null })}>
          <ArrowCounterClockwise size={13} />{t('reset')}
        </Button>
      </div>

      {loading ? <div className={styles.state} role="status"><span className={styles.loadingMark} aria-hidden="true" />{t('loading')}</div>
        : unavailable || !hasModels ? <div className={styles.state} role={unavailable ? 'alert' : 'status'}>
          {unavailable ? <WarningCircle size={20} aria-hidden="true" /> : null}
          <p>{t(unavailable ? 'unavailable' : 'empty')}</p>
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>{t('retry')}</Button>
        </div>
          : <ScrollArea className={styles.modelScroll} viewportClassName={styles.modelViewport}>
            <div className={styles.models} role="group" aria-label={t('candidates')} aria-describedby={feedbackId}>
              {models.map(model => {
                const checked = selectedIds.has(model.id);
                return <button key={model.id} type="button" role="checkbox" aria-checked={checked}
                  className={`fouc-menu-item ${styles.model}`} onClick={() => toggleModel(model.id)}
                  title={checked && selectedCount === 1 ? t('minimum') : model.name}>
                  <ChatExecutionLogo option={modelExecutionOption(model)} size={21} />
                  <span className={styles.modelText}><span>{model.name}</span>
                    <span>{modelProviders.find(provider => provider.id === model.provider)?.name}</span>
                  </span>
                  <span className={styles.checkbox} data-checked={checked} aria-hidden="true">{checked ? <Check size={11} weight="bold" /> : null}</span>
                </button>;
              })}
            </div>
          </ScrollArea>}

      {canEdit ? <p id={feedbackId} className={styles.feedback} data-warning={blocked || selectedCount === 0} role="status">
        {blocked || selectedCount === 0 ? <WarningCircle size={13} aria-hidden="true" /> : null}
        {t(blocked ? 'blocked' : selectedCount === 0 ? 'missing' : 'minimum')}
      </p> : null}
    </section>

    <footer className={styles.footer}>
      <p>{t('draft')}</p>
      <Button type="button" variant="outline" size="sm" className={styles.useAuto}
        disabled={rules.modelIds !== null && !loading && !unavailable && selectedCount === 0} onClick={onSelect}>{t('useAuto')}</Button>
    </footer>
  </article>;
}
