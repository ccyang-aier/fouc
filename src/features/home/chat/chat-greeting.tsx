import type { CSSProperties } from "react";
import styles from "./chat-greeting.module.css";

export function ChatGreeting({ text }: { text: string }) {
  return (
    <h1 aria-label={text}>
      <span aria-hidden="true">
        {Array.from(text).map((character, index) => (
          <span
            className={styles.character}
            style={{ "--typing-delay": `${160 + index * 90}ms` } as CSSProperties}
            key={index}
          >
            {character}
          </span>
        ))}
      </span>
    </h1>
  );
}
