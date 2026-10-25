'use client';

import { type Locale } from '@/lib/i18n/locale';
import { createTranslator } from '@/lib/i18n/messages';
import { useTranslation } from '@/lib/i18n/react';
import { messages } from './i18n/auth-showcase.messages';

import { useEffect, useState } from 'react';
import { FoucMark } from '@/components/fouc-mark';
import { AuthBackdrop } from './auth-backdrop';
import styles from './account-dialog.module.css';

function getExamples(locale: Locale) {
  const uiText = createTranslator(messages, locale);
  return [
    {
      agent: 'Research',
      quote: [uiText('你定方向，'), uiText('剩下的路交给 Agent。')],
    },
    {
      agent: 'Writer',
      quote: [uiText('思考是你的，'), uiText('执行是它的。')],
    },
    {
      agent: 'Developer',
      quote: [uiText('从一个想法，'), uiText('到下一步行动。')],
    },
  ] as const;
}

/** Product copy rotates independently of the interactive background. */
export function AuthShowcase() {
  const { t: uiText, locale } = useTranslation(messages);
  const examples = getExamples(locale);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setTick((value) => value + 1), 7200);
    return () => window.clearInterval(timer);
  }, []);
  const exampleIndex = tick % examples.length;
  const example = examples[exampleIndex];
  return (
    <aside className={styles.showcase} aria-label={uiText('Fouc 协作示例')}>
      <AuthBackdrop />
      <div className={styles.showcaseContent}>
        <div className={styles.brand}>
          <FoucMark compact />
          <b>Fouc</b>
          <span>{uiText('AI工作台')}</span>
        </div>
        <p className={styles.quote} key={example.quote[0]}>
          {example.quote[0]}
          <br />
          <em>{example.quote[1]}</em>
        </p>
        <div className={styles.showcaseFooter}>
          <span className={styles.pages} aria-hidden>
            {examples.map((item, index) => (
              <i key={item.agent} data-active={index === exampleIndex} />
            ))}
          </span>
          <span>0{exampleIndex + 1} / 03</span>
        </div>
      </div>
    </aside>
  );
}
