import { expect, test } from 'bun:test';
import { decodeJsonUnicodeEscapes, formatJsonSource, mapDisplayToRaw } from './json-source';

test('JSON formatting preserves original numeric tokens, duplicate fields, key order and escapes', () => {
  const source = '{"integer":9007199254740993,"integer":9223372036854775807,"decimal":1.230000000000000000001,"exponent":1e+300,"negative":-0,"text":"\\u4e2d\\/\\n"}';
  const pretty = formatJsonSource(source, 2);
  expect(formatJsonSource(pretty)).toBe(source);
  expect(pretty).toContain('1.230000000000000000001'); expect(pretty.match(/"integer"/g)).toHaveLength(2);
  for (const valid of ['null', 'true', 'false', '[]', '{}', '"x"', '1e9999']) expect(formatJsonSource(valid)).toBe(valid);
  for (const invalid of ['{"x":01}', '[1,]', '{"x":}', '"\\u123"', '"\\q"', '"\n"', 'true false', '-']) expect(() => formatJsonSource(invalid)).toThrow();
});

test('Unicode display and multi-span edits keep untouched escapes, controls, surrogate pairs and literal backslashes', () => {
  const source = '{"name":"\\u4e2d\\u6587","emoji":"\\ud83d\\ude00","literal":"\\\\u4e2d","control":"\\u000a","lone":"\\ud800","quote":"a\\\"b","count":9007199254740993}';
  const display = decodeJsonUnicodeEscapes(source);
  expect(display).toContain('中文'); expect(display).toContain('😀'); expect(display).toContain('\\\\u4e2d'); expect(display).toContain('\\u000a'); expect(display).toContain('\\ud800');
  expect(mapDisplayToRaw(source, display)).toBe(source);
  const edited = display.replace('中文', '中文编辑').replace('9007199254740993', '9007199254740995');
  const restored = mapDisplayToRaw(source, edited);
  expect(restored).toContain('\\u4e2d\\u6587编辑'); expect(restored).toContain('\\ud83d\\ude00'); expect(formatJsonSource(restored)).toContain('9007199254740995');
  const quoted = mapDisplayToRaw(source, display.replace('a\\\"b', 'a\\\"bc'));
  expect(JSON.parse(quoted).quote).toBe('a"bc');
});

test('Large Unicode drafts use bounded diff fallback while retaining valid scalar and surrogate semantics', () => {
  const source = '{"value":"' + 'a'.repeat(110000) + '\\ud83d\\ude00' + 'b'.repeat(110000) + '"}';
  const display = decodeJsonUnicodeEscapes(source), edited = display.replace('aaa', 'ccc').replace('bbb', 'ddd');
  const raw = mapDisplayToRaw(source, edited);
  expect(JSON.parse(raw)).toEqual(JSON.parse(edited)); expect(formatJsonSource(raw)).toBe(raw);
});
