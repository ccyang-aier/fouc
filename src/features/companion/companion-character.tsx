import type { RefObject } from 'react';
import styles from './companion-character.module.css';

export function CompanionCharacter({ sceneRef }: {
  sceneRef: RefObject<HTMLDivElement | null>;
}) {
  return (
    <div ref={sceneRef} className={styles.character}>
      <div className={styles['stage']}>
        <div className={styles['shadow']} />
        <div className={styles['hop']}>
          <div className={styles['bubble']} role="status" />
          <div className={styles['squash']}><div className={styles['tilt']}><div className={styles['breath']}>
            <canvas className={styles['body-svg']} aria-hidden />
            <span className={styles['burst-line'] + ' ' + styles['l']} aria-hidden>(</span><span className={styles['burst-line'] + ' ' + styles['r']} aria-hidden>)</span>
            <div className={styles['blush'] + ' ' + styles['l']} /><div className={styles['blush'] + ' ' + styles['r']} />
            <div className={styles['face']} aria-hidden>
              <div className={styles['eye']}><div className={styles['ball']}><div className={styles['pupil']} /><div className={styles['lid']} /></div><div className={styles['arc'] + ' ' + styles['down']} /><div className={styles['arc'] + ' ' + styles['up']} /></div>
              <div className={styles['eye']}><div className={styles['ball']}><div className={styles['pupil']} /><div className={styles['lid']} /></div><div className={styles['arc'] + ' ' + styles['down']} /><div className={styles['arc'] + ' ' + styles['up']} /></div>
            </div>
            <span className={styles['zzz']} aria-hidden>z</span><span className={styles['zzz']} aria-hidden>z</span><span className={styles['zzz']} aria-hidden>Z</span>
          </div></div></div>
        </div>
      </div>
    </div>
  );
}
