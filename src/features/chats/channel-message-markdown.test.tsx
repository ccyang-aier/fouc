import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ChannelMember } from '@fouc/shared/chats';
import { ChannelMessageMarkdown } from './channel-message-markdown';

const members: ChannelMember[] = [{ id: 'peer', userId: 'person', name: '苏晴 · 示例', image: null, kind: 'user', role: 'member', installationId: null, agentOwnerId: null, joinedAt: '2026-10-25T00:00:00Z', active: true }];

test('message mentions enhance prose but preserve literal code and links', () => {
  const html = renderToStaticMarkup(<ChannelMessageMarkdown members={members} body={'@苏晴 · 示例 看看。\n\n`@苏晴 · 示例`\n\n[@苏晴 · 示例](https://example.com)\n\n```text\n@苏晴 · 示例\n```'} />);
  expect(html.match(/data-channel-mention="peer"/g)).toHaveLength(1);
  expect(html).toContain('<code>@苏晴 · 示例</code>');
  expect(html).toContain('rel="noopener noreferrer"');
  expect(html).toContain('<code class="language-text">@苏晴 · 示例');
});

test('images and raw HTML cannot bypass the compact attachment presentation', () => {
  const html = renderToStaticMarkup(<ChannelMessageMarkdown members={members} body={'![inline picture](https://untrusted.invalid/image.png)\n\n<script>alert(1)</script>\n\n@Nobody'} />);
  expect(html).not.toContain('<img');
  expect(html).not.toContain('<script>');
  expect(html).not.toContain('data-channel-mention');
  expect(html).toContain('inline picture');
});

test('message emojis render local artwork instead of the operating system font', () => {
  const html = renderToStaticMarkup(<ChannelMessageMarkdown members={members} body="收到 👍，一起出发 🚀" />);
  expect(html.match(/src="\/emoji\//g)).toHaveLength(2);
  expect(html).toContain('alt="👍"');
  expect(html).toContain('alt="🚀"');
});
