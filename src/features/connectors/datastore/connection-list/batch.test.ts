import { describe, expect, test } from 'bun:test';
import { appendConnectionTags, runConnectionBatch, type ConnectionBatchProgress } from './batch';
import { uiText } from '../../i18n/ui-message';
import { ValidationError, validationIssue } from '@fouc/shared';

describe('connection batch operations', () => {
  test('additive tags preserve each connection and deduplicate trimmed input', () => {
    const original = ['开发', '本机'];
    expect(appendConnectionTags(original, [' 开发 ', '测试', '', '测试'])).toEqual([
      '开发',
      '本机',
      '测试',
    ]);
    expect(original).toEqual(['开发', '本机']);
    expect(appendConnectionTags(['生产'], ['测试'])).toEqual(['生产', '测试']);
  });

  test('tag limits reject an invalid batch before performing any write', async () => {
    const items = [
      { id: 'first', name: 'First', tags: [] },
      { id: 'full', name: 'Full', tags: Array.from({ length: 12 }, (_, i) => String(i)) },
    ];
    let writes = 0;
    expect(() => items.map((item) => appendConnectionTags(item.tags, ['new']))).toThrow('12');
    expect(() => appendConnectionTags([], ['x'.repeat(33)])).toThrow('32');
    try {
      const updates = items.map((item) => appendConnectionTags(item.tags, ['new']));
      await runConnectionBatch(
        items,
        'tags',
        async (item) => {
          writes++;
          return updates[items.indexOf(item)];
        },
        () => {},
        () => true,
      );
    } catch {
      /* validation stops all writes */
    }
    expect(writes).toBe(0);
  });

  test('native failures do not stop later requests and results retain exact connection IDs', async () => {
    const items = [
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
      { id: 'c', name: 'C' },
    ];
    const progress: ConnectionBatchProgress[] = [],
      calls: string[] = [];
    let inFlight = 0,
      peak = 0;
    const result = await runConnectionBatch(
      items,
      'test',
      async (item) => {
        inFlight++;
        peak = Math.max(peak, inFlight);
        calls.push(item.id);
        try {
          await Promise.resolve();
          if (item.id === 'b') throw new Error('认证失败');
        } finally {
          inFlight--;
        }
      },
      (value) => progress.push(value),
      () => true,
    );
    expect(calls).toEqual(['a', 'b', 'c']);
    expect(peak).toBe(1);
    expect({
      ...result,
      failed: result.failed.map((item) => ({ ...item, message: uiText(item.message, 'en-US') })),
    }).toEqual({
      action: 'test',
      completed: 3,
      total: 3,
      succeeded: ['a', 'c'],
      failed: [{ id: 'b', name: 'B', message: '认证失败' }],
      stopped: false,
    });
    expect(progress.map((value) => value.completed)).toEqual([1, 2, 3]);
  });

  test('leaving a connection directory finishes the current request without starting the next', async () => {
    let active = true;
    const calls: string[] = [],
      progress: ConnectionBatchProgress[] = [];
    const result = await runConnectionBatch(
      [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
      ],
      'delete',
      async (item) => {
        calls.push(item.id);
        active = false;
      },
      (value) => progress.push(value),
      () => active,
    );
    expect(calls).toEqual(['a']);
    expect(progress).toEqual([]);
    expect(result.succeeded).toEqual(['a']);
    expect(result.stopped).toBe(true);
  });

  test('retained batch failures localize on display while native errors and resource IDs remain intact', async () => {
    const native = new Error('认证失败');
    const issue = validationIssue('sql-snippets.invalidSqlSnippetFormat', 'SQL 代码片段格式无效');
    const result = await runConnectionBatch(
      [
        { id: 'limit', name: '连接 keep 42' },
        { id: 'native', name: 'Native' },
        { id: 'issue', name: 'Issue' },
      ],
      'tags',
      async (item) => {
        if (item.id === 'limit')
          appendConnectionTags(
            Array.from({ length: 13 }, (_, index) => String(index)),
            [],
          );
        if (item.id === 'native') throw native;
        throw new ValidationError(issue);
      },
      () => {},
      () => true,
    );
    expect(result.failed.map((item) => item.id)).toEqual(['limit', 'native', 'issue']);
    expect(result.failed[0].name).toBe('连接 keep 42');
    expect(uiText(result.failed[0].message, 'zh-CN')).toBe('最多添加 12 个标签');
    expect(uiText(result.failed[0].message, 'en-US')).toBe('Add up to 12 tags');
    expect(result.failed[1].message).toBe(native);
    expect(uiText(result.failed[1].message, 'en-US')).toBe('认证失败');
    expect(uiText(result.failed[2].message, 'en-US')).toBe('Invalid SQL snippet format');
    expect(uiText(result.failed[2].message, 'zh-CN')).toBe('SQL 代码片段格式无效');
    expect(result.completed).toBe(3);
  });
});
