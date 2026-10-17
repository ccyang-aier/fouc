import styles from "./chat-greeting-companion.module.css";

export function ChatGreetingCompanion() {
  return (
    <div className={styles.character} aria-hidden="true">
      <svg className={styles.shadow} viewBox="0 0 80 72" fill="currentColor">
        <ellipse cx="40" cy="66" rx="15" ry="2" />
      </svg>
      <div className={styles.float}>
        <svg className={styles.body} viewBox="0 0 80 72" fill="none">
          <path
            className={styles.outline}
            d="M21 20C19 16 20 14 22 14L27 17C28 13 31 12 34 14C37 9 42 9 45 14C49 11 53 13 54 17L60 15L59 22C65 25 66 30 64 35L68 39L63 41C64 48 60 53 55 54L55 59L49 57C43 61 36 61 30 57L25 60L25 55C18 53 15 47 17 42L12 40L16 35C13 29 16 23 21 20Z"
          />
          <g className={styles.eyes}>
            <ellipse className={styles.eye} cx="31" cy="35" rx="8" ry="9" />
            <ellipse className={styles.eye} cx="49" cy="35" rx="8" ry="9" />
            <g className={styles.pupils} fill="currentColor">
              <circle cx="32" cy="36" r="3.2" />
              <circle cx="50" cy="36" r="3.2" />
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
}
