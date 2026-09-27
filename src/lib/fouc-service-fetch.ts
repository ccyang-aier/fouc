/** Web uses browser cookies; desktop uses the WebView's native cookie store. */
export const foucServiceFetch: typeof fetch = async (input, init) => {
  const invoke = typeof window === 'undefined' ? undefined :
    (window as Window & { __TAURI__?: { core?: { invoke?: (command: string, args: unknown) => Promise<unknown> } } }).__TAURI__?.core?.invoke;
  if (!invoke) return fetch(input, init);
  const request = new Request(input, init);
  request.signal.throwIfAborted();
  const result = await invoke('fouc_service_request', {
    url: request.url,
    method: request.method,
    headers: Object.fromEntries(request.headers),
    body: ['GET', 'HEAD'].includes(request.method) ? null : Array.from(new Uint8Array(await request.arrayBuffer())),
  }) as { status: number; headers: Record<string, string>; body: number[] };
  request.signal.throwIfAborted();
  return new Response([204, 205, 304].includes(result.status) || request.method === 'HEAD' ? null : Uint8Array.from(result.body).buffer, {
    status: result.status, headers: result.headers,
  });
};
