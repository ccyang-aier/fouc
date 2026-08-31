"use client"

/**
 * 后端连接客户端：Tauri 环境经 command 取端点（含 token），
 * 浏览器开发环境回退到本地端口（免鉴权开发模式）。
 */

import type { AgentEvent, ApiResult, WsEnvelope } from "@fouc/shared"

type Endpoint = { baseUrl: string; token: string }

let cachedEndpoint: Endpoint | null = null
let endpointPromise: Promise<Endpoint> | null = null

/** 解析后端端点（Tauri command 或开发回退），供设置页展示连接信息 */
export function getBackendEndpoint(): Promise<Endpoint> {
  return resolveEndpoint()
}

async function resolveEndpoint(): Promise<Endpoint> {
  if (cachedEndpoint) return cachedEndpoint
  if (endpointPromise) return endpointPromise

  endpointPromise = (async () => {
    // Tauri WebView：向 Rust 壳要端点
    const tauri = (window as { __TAURI__?: { core?: { invoke?: (cmd: string) => Promise<unknown> } } }).__TAURI__
    if (tauri?.core?.invoke) {
      try {
        const raw = (await tauri.core.invoke("get_backend_endpoint")) as { baseUrl: string; token: string }
        cachedEndpoint = { baseUrl: raw.baseUrl, token: raw.token }
        return cachedEndpoint
      } catch {
        /* fall through to dev fallback */
      }
    }
    // 开发模式（next dev 于浏览器/未就绪壳）
    cachedEndpoint = { baseUrl: "http://127.0.0.1:8710", token: "" }
    return cachedEndpoint
  })()

  return endpointPromise
}

export async function backendFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const endpoint = await resolveEndpoint()
  const response = await fetch(`${endpoint.baseUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(endpoint.token ? { authorization: `Bearer ${endpoint.token}` } : {}),
      ...init?.headers,
    },
  })
  const body = (await response.json()) as ApiResult<T>
  if (!body.ok) {
    throw new Error(body.error?.message ?? `backend error (${response.status})`)
  }
  return body.data
}

/** 订阅后端事件流；返回关闭函数。自动重连（1s 起指数退避，封顶 15s）。 */
export function subscribeBackendEvents(
  onEnvelope: (envelope: WsEnvelope) => void,
  onConnectionChange?: (connected: boolean) => void
): () => void {
  let closed = false
  let attempt = 0
  let ws: WebSocket | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null

  const connect = async () => {
    if (closed) return
    const endpoint = await resolveEndpoint()
    const url = endpoint.baseUrl.replace(/^http/, "ws") + "/ws"
    try {
      ws = new WebSocket(url)
    } catch {
      scheduleReconnect()
      return
    }

    ws.onopen = () => {
      attempt = 0
      onConnectionChange?.(true)
      ws?.send(JSON.stringify({ type: "auth", token: endpoint.token }))
    }
    ws.onmessage = (event) => {
      try {
        onEnvelope(JSON.parse(String(event.data)) as WsEnvelope)
      } catch {
        /* ignore malformed frames */
      }
    }
    ws.onclose = () => {
      onConnectionChange?.(false)
      scheduleReconnect()
    }
    ws.onerror = () => {
      ws?.close()
    }
  }

  const scheduleReconnect = () => {
    if (closed) return
    const delay = Math.min(15000, 1000 * Math.pow(2, attempt++))
    reconnectTimer = setTimeout(() => void connect(), delay)
  }

  void connect()
  return () => {
    closed = true
    if (reconnectTimer) clearTimeout(reconnectTimer)
    ws?.close()
  }
}

export type { AgentEvent }
