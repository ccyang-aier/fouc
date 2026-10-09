'use client';

import { useEffect, useState } from 'react';
import { Check, CircleNotch } from '@phosphor-icons/react';
import { FoucMark } from '@/components/fouc-mark';
import styles from './account-dialog.module.css';

const examples = [
  { agent: 'Research', task: '梳理 AI 工作台竞品格局', steps: ['检索公开资料', '交叉核对关键结论', '生成结构化报告'], quote: ['你定方向，', '剩下的路交给 Agent。'] },
  { agent: 'Writer', task: '起草产品发布说明', steps: ['读取产品需求与变更', '撰写不同语气的草稿', '提交给你审阅'], quote: ['思考是你的，', '执行是它的。'] },
  { agent: 'Developer', task: '把想法变成可用的产品', steps: ['理解需求与设计', '实现并验证交互', '交付可审阅的成果'], quote: ['从一个想法，', '到下一步行动。'] },
] as const;

/** Decorative, local-only preview. It never represents a running user task. */
export function AuthShowcase() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reducedMotion.matches) return;
    const timer = window.setInterval(() => setTick((value) => value + 1), 1800);
    return () => window.clearInterval(timer);
  }, []);
  const exampleIndex = Math.floor(tick / 4) % examples.length;
  const stepIndex = tick % 4;
  const example = examples[exampleIndex];
  return <aside className={styles.showcase} aria-label="Fouc 协作示例">
    <div className={styles.atmosphere} aria-hidden />
    <div className={styles.showcaseContent}>
      <div className={styles.brand}><FoucMark compact /><b>Fouc</b><span>AI WORKBENCH</span></div>
      <div className={styles.example} key={exampleIndex}>
        <div className={styles.exampleHeader}><span>Agent · {example.agent}</span><span className={styles.exampleLabel}>协作示例</span></div>
        <p className={styles.exampleTitle}>{example.task}</p>
        <div className={styles.steps}>{example.steps.map((step, index) => <div className={styles.step} data-progress={index < stepIndex ? 'done' : index === stepIndex ? 'active' : 'pending'} key={step}>
          <span className={styles.stepIcon}>{index < stepIndex ? <Check size={10} weight="bold" /> : index === stepIndex ? <CircleNotch size={16} /> : null}</span><span>{step}</span>
        </div>)}</div>
        <div className={styles.progress} aria-hidden><span style={{ width: `${Math.min(stepIndex + 1, 3) / 3 * 100}%` }} /></div>
      </div>
      <p className={styles.quote} key={example.quote[0]}>{example.quote[0]}<br /><em>{example.quote[1]}</em></p>
      <div className={styles.showcaseFooter}><span className={styles.pages} aria-hidden>{examples.map((item, index) => <i key={item.agent} data-active={index === exampleIndex} />)}</span><span>0{exampleIndex + 1} / 03</span></div>
    </div>
  </aside>;
}
