import styles from "./chat-greeting-mark.module.css";

export function ChatGreetingMark() {
  return (
    <div className={styles.mark} aria-hidden="true">
      <span className={styles.gear}>
        <svg
          width="40"
          height="40"
          viewBox="0 0 48 48"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="miter"
          focusable="false"
        >
          <path d="M20.8 3H27.2L28.5 8.2L32 9.7L36.6 6.9L41.1 11.4L38.3 16L39.8 19.5L45 20.8V27.2L39.8 28.5L38.3 32L41.1 36.6L36.6 41.1L32 38.3L28.5 39.8L27.2 45H20.8L19.5 39.8L16 38.3L11.4 41.1L6.9 36.6L9.7 32L8.2 28.5L3 27.2V20.8L8.2 19.5L9.7 16L6.9 11.4L11.4 6.9L16 9.7L19.5 8.2Z" />
          <circle cx="24" cy="24" r="7.5" />
        </svg>
      </span>
    </div>
  );
}
