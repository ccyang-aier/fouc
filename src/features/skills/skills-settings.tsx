'use client';

import { Sparkle } from '@phosphor-icons/react';
import { useTranslation } from '@/lib/i18n';
import { getBuiltinSkills, toggleBuiltinSkill, useBuiltinSkills } from './builtin-skills';
import styles from './skills-settings.module.css';

const messages = {
  title: ['Skills', 'Skills'],
  hint: ['管理新任务默认启用的内置 Skills。设置在本次应用会话内生效。', 'Manage built-in skills enabled by default for new tasks. Changes apply to this app session.'],
  builtin: ['内置 Skills', 'Built-in skills'],
  enabled: ['已启用', 'Enabled'], disabled: ['未启用', 'Disabled'],
  toggle: ['启用{name}', 'Enable {name}'],
} as const;

export function SkillsSettings() {
  const { t, locale } = useTranslation(messages);
  const disabled = useBuiltinSkills();
  return <section className={styles.page}>
    <h1>{t('title')}</h1><p className={styles.hint}>{t('hint')}</p>
    <h2>{t('builtin')}</h2>
    <div className={styles.list}>
      {getBuiltinSkills(locale).map(skill => {
        const enabled = !disabled.includes(skill.id);
        return <div key={skill.id} className={styles.row}>
          <span className={styles.icon}><Sparkle size={20} /></span>
          <div className={styles.text}><h3>{skill.name}</h3><p>{skill.description}</p><span>{skill.author}</span></div>
          <span className={styles.state}>{t(enabled ? 'enabled' : 'disabled')}</span>
          <button type="button" role="switch" aria-checked={enabled} aria-label={t('toggle', { name: skill.name })}
            className={styles.switch} onClick={() => toggleBuiltinSkill(skill.id)}><span /></button>
        </div>;
      })}
    </div>
  </section>;
}
