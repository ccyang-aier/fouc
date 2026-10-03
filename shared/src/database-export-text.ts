/** Shared DBX writer boundary: never split a UTF-16 pair or CRLF during UTF-8 emission. */
export function* textPieces(text: string): Generator<string> {
  for (let start = 0; start < text.length;) {
    let end = Math.min(start + 16_384, text.length);
    const last = text.charCodeAt(end - 1);
    if (end < text.length && ((last >= 0xd800 && last <= 0xdbff) || (last === 13 && text.charCodeAt(end) === 10))) end--;
    yield text.slice(start, end);
    start = end;
  }
}
