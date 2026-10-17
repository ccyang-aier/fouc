import type { CSSProperties } from "react";
import styles from "./chat-greeting.module.css";

export function ChatGreeting({ text }: { text: string }) {
  const characters = Array.from(text);
  const lastCharacterAt = 160 + (characters.length - 1) * 90;
  const cycleDuration = lastCharacterAt + 1800;
  const percent = (time: number) => `${time / cycleDuration * 100}%`;

  return (
    <h1 aria-label={text} style={{ "--typing-cycle": `${cycleDuration}ms` } as CSSProperties}>
      <span aria-hidden="true">
        {characters.map((character, index) => {
          const appearsAt = 160 + index * 90;
          const cursorWindows = index === characters.length - 1
            ? Array.from({ length: 3 }, (_, blink) => [appearsAt + blink * 600, appearsAt + blink * 600 + 300])
            : [[appearsAt, appearsAt + 90]];
          const cursorStops = cursorWindows.flatMap(([start, end]) => [
            `0 ${percent(start)}`, `1 ${percent(start)}`,
            `1 ${percent(end)}`, `0 ${percent(end)}`,
          ]);

          return (
            <span
              className={styles.character}
              style={{
                "--character-curve": `linear(0, 0 ${percent(appearsAt)}, 1 ${percent(appearsAt)}, 1)`,
                "--cursor-curve": `linear(0, ${cursorStops.join(", ")}, 0)`,
              } as CSSProperties}
              key={index}
            >
              {character}
            </span>
          );
        })}
      </span>
    </h1>
  );
}
