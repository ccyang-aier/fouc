import { afterAll, beforeAll, beforeEach, expect, mock, test } from 'bun:test';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Window } from 'happy-dom';
import type { ChannelPoll } from '@fouc/shared/chats';

let browser: Window;
let root: Root;
let host: HTMLDivElement;
let Poll: typeof import('./channel-poll').ChannelPollCard;

beforeAll(async () => {
  browser = new Window({ url: 'http://127.0.0.1:3000/' });
  const globals = globalThis as Record<string, unknown>;
  for (const name of ['document', 'navigator', 'HTMLElement', 'Element', 'Node', 'Event', 'MutationObserver']) globals[name] = (browser as unknown as Record<string, unknown>)[name];
  globals.window = browser;
  globals.IS_REACT_ACT_ENVIRONMENT = true;
  mock.module('@/features/chats/channel-ui', () => ({ ChannelAvatar: () => null }));
  mock.module('@/lib/i18n', () => ({ defineMessages: (value: unknown) => value, useTranslation: () => ({ t: (key: string, args?: { count: number }) => key === 'votes' ? `${args?.count} votes` : key }) }));
  Poll = (await import('./channel-poll')).ChannelPollCard;
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
}, 20_000);

beforeEach(async () => { await act(async () => root.render(null)); });
afterAll(async () => { await act(async () => root.unmount()); await browser.happyDOM.abort(); });

function poll(selected = false, closed = false): ChannelPoll {
  return { question: 'Choose a topic', closed, options: [{ id: 'a', text: 'Conversation', voterIds: selected ? ['actor'] : [] }, { id: 'b', text: 'Assets', voterIds: ['peer'] }] };
}
async function render(value: ChannelPoll, onVote: (id: string) => Promise<boolean> = async () => true, canVote = true) {
  await act(async () => root.render(<Poll poll={value} actorId="actor" members={[]} canVote={canVote} onVote={onVote} />));
}
function choices() { return [...host.querySelectorAll<HTMLButtonElement>('button[aria-pressed]')]; }

test('unvoted poll keeps results private until participation', async () => {
  await render(poll());
  expect(choices().every(option => option.getAttribute('aria-pressed') === 'false')).toBe(true);
  expect(host.textContent).not.toContain('%');
  expect(host.textContent).toContain('voteChooseHint');
});

test('pending vote prevents duplicate requests and failed acknowledgement retains selection', async () => {
  let finish!: (ok: boolean) => void;
  const requested: string[] = [];
  await render(poll(true), id => { requested.push(id); return new Promise<boolean>(resolve => { finish = resolve; }); });
  await act(async () => { choices()[1].click(); choices()[1].click(); });
  expect(requested).toEqual(['b']);
  expect(choices().every(option => option.disabled)).toBe(true);
  expect(choices()[1].getAttribute('aria-busy')).toBe('true');
  expect(choices()[0].getAttribute('aria-pressed')).toBe('true');
  await act(async () => { finish(false); });
  expect(choices().every(option => !option.disabled)).toBe(true);
  expect(choices()[0].getAttribute('aria-pressed')).toBe('true');
});

test('server selection and withdrawal update pressed state and visible results', async () => {
  await render(poll(true));
  expect(choices()[0].getAttribute('aria-pressed')).toBe('true');
  expect(choices()[0].textContent).toContain('50%');
  const changed = poll(); changed.options[1].voterIds.push('actor');
  await render(changed);
  expect(choices()[1].getAttribute('aria-pressed')).toBe('true');
  expect(choices()[1].textContent).toContain('100%');
  await render(poll());
  expect(host.textContent).not.toContain('%');
  expect(choices().every(option => option.getAttribute('aria-pressed') === 'false')).toBe(true);
});

test('closed polls expose results and resource permissions prevent voting', async () => {
  const requested: string[] = [];
  await render(poll(false, true), async id => { requested.push(id); return true; });
  expect(choices().every(option => option.disabled)).toBe(true);
  expect(host.textContent).toContain('100%');
  expect(host.textContent).toContain('pollClosedHint');
  await render(poll(), async id => { requested.push(id); return true; }, false);
  await act(async () => choices()[0].click());
  expect(requested).toEqual([]);
  expect(host.textContent).toContain('restricted');
});
