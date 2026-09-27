import { authenticatedFetch } from './authenticated-fetch';

/** Native HTTP obtains a disposable handshake ticket, so WebView third-party
 * cookie policy cannot break collaboration. Session cookies never enter JS. */
class DesktopServiceSocket extends EventTarget {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  readonly CONNECTING = 0;
  readonly OPEN = 1;
  readonly CLOSING = 2;
  readonly CLOSED = 3;
  readonly url: string;
  binaryType: BinaryType = 'blob';
  bufferedAmount = 0;
  extensions = '';
  protocol = '';
  readyState: number = 0;
  onopen: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  private socket?: WebSocket;
  private controller = new AbortController();

  constructor(url: string | URL, protocols?: string | string[]) {
    super();
    this.url = String(url);
    void this.connect(protocols);
  }

  private async connect(protocols?: string | string[]) {
    try {
      const target = new URL(this.url);
      const origin = `${target.protocol === 'wss:' ? 'https:' : 'http:'}//${target.host}`;
      const response = await authenticatedFetch(`${origin}/api/auth/socket-ticket`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: target.pathname }), signal: this.controller.signal,
      });
      if (!response.ok) throw new Error('Socket authentication failed');
      const { ticket } = await response.json() as { ticket: string };
      if (this.readyState !== 0) return;
      target.searchParams.set('fouc_socket_ticket', ticket);
      const socket = this.socket = new WebSocket(target, protocols);
      socket.binaryType = this.binaryType;
      socket.onopen = () => { this.readyState = 1; this.emit(new Event('open')); };
      socket.onmessage = (event) => this.emit(new MessageEvent('message', { data: event.data, origin: event.origin }));
      socket.onerror = () => this.emit(new Event('error'));
      socket.onclose = (event) => { this.readyState = 3; this.emit(new CloseEvent('close', { code: event.code, reason: event.reason, wasClean: event.wasClean })); };
    } catch {
      if (this.readyState === 3) return;
      this.readyState = 3;
      this.emit(new Event('error'));
      this.emit(new CloseEvent('close', { code: 1006, reason: 'Socket authentication failed' }));
    }
  }

  private emit(event: Event) {
    this.dispatchEvent(event);
    const handler = this[`on${event.type}` as 'onopen' | 'onerror' | 'onclose' | 'onmessage'];
    (handler as ((event: Event) => void) | null)?.call(this, event);
  }

  send(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
    if (!this.socket || this.readyState !== 1) throw new DOMException('Socket is not open', 'InvalidStateError');
    this.socket.send(data);
  }

  close(code?: number, reason?: string) {
    if (this.socket) { this.readyState = 2; this.socket.close(code, reason); }
    else { this.readyState = 3; this.controller.abort(); this.emit(new CloseEvent('close', { code: code ?? 1000, reason: reason ?? '', wasClean: true })); }
  }
}

export function getFoucServiceWebSocket(): typeof WebSocket {
  const native = typeof window !== 'undefined' && '__TAURI__' in window;
  return native ? DesktopServiceSocket as unknown as typeof WebSocket : WebSocket;
}
