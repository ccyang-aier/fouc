import type { CSSProperties } from "react";
import styles from "./chat-greeting.module.css";

const typingDelay = 160;
const characterInterval = 138;
const cursorBlinkPeriod = 1200;
const cursorBlinkCount = 3;

export function ChatGreeting({ text }: { text: string }) {
  const characters = Array.from(text);
  const lastCharacterAt = typingDelay + (characters.length - 1) * characterInterval;
  const cycleDuration = lastCharacterAt + cursorBlinkCount * cursorBlinkPeriod;
  const percent = (time: number) => `${time / cycleDuration * 100}%`;

  return (
    <h1 aria-label={text} style={{ "--typing-cycle": `${cycleDuration}ms` } as CSSProperties}>
      <span aria-hidden="true">
        {characters.map((character, index) => {
          const appearsAt = typingDelay + index * characterInterval;
          const cursorWindows = index === characters.length - 1
            ? Array.from({ length: cursorBlinkCount }, (_, blink) => [
                appearsAt + blink * cursorBlinkPeriod,
                appearsAt + blink * cursorBlinkPeriod + cursorBlinkPeriod / 2,
              ])
            : [[appearsAt, appearsAt + characterInterval]];
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
