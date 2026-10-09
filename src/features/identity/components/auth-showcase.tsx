'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Check, CircleNotch } from '@phosphor-icons/react';
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
    <DotField />
    <div className={styles.showcaseContent}>
      <div className={styles.brand}><Image src="/brand/fouc-mark-cropped.png" width={33} height={23} style={{ width: 26, height: 'auto' }} alt="" unoptimized /><b>Fouc</b><span>AI WORKBENCH</span></div>
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

function DotField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let width = 0, height = 0, frame = 0, time = 0;
    const draw = () => {
      context.clearRect(0, 0, width, height);
      context.fillStyle = '#141416';
      for (let y = 6.5; y < height; y += 13) for (let x = 6.5; x < width; x += 13) {
        const nx = x / width, ny = y / height;
        const wave = Math.sin(nx * 5 + time * 2 + Math.sin(ny * 3 + time) * 1.4) + Math.sin(ny * 6 - time * 1.3 + nx * 2) + Math.sin((nx + ny) * 4 + time * 1.7);
        const value = Math.pow((wave / 3 + 1) / 2, 2.4) * (.3 + ny * .85);
        const radius = Math.min(value, 1) * 5.4;
        if (radius < .35) continue;
        context.globalAlpha = .15 + value * .7;
        context.beginPath(); context.arc(x, y, radius, 0, Math.PI * 2); context.fill();
      }
      context.globalAlpha = 1;
    };
    const animate = () => {
      frame = 0;
      if (!width || !height) return;
      if (!document.hidden) { time += .006; draw(); }
      frame = window.requestAnimationFrame(animate);
    };
    const resize = () => {
      width = canvas.clientWidth; height = canvas.clientHeight;
      const density = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * density; canvas.height = height * density;
      context.setTransform(density, 0, 0, density, 0, 0); draw();
      if (!reducedMotion.matches && !frame && width && height) frame = window.requestAnimationFrame(animate);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas); resize();
    return () => { observer.disconnect(); window.cancelAnimationFrame(frame); };
  }, []);
  return <canvas ref={canvasRef} className={styles.field} aria-hidden />;
}
