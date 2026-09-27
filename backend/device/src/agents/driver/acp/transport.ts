/**
 * @license
 * 传输层移植自 AionUi (aionui.com) 的 src/process/acp/infra/NdjsonTransport.ts
 * （Apache-2.0），Copyright 2025 AionUi (aionui.com)，按 Apache-2.0 授权复用并修改。
 *
 * ACP over stdio：子进程 stdin/stdout 上的 NDJSON（按行分隔的 JSON-RPC）。
 * 编解码直接使用官方 SDK 的 ndJsonStream。
 */

import type { Stream } from '@agentclientprotocol/sdk';
import { ndJsonStream } from '@agentclientprotocol/sdk';
import { Readable, Writable } from 'node:stream';
import type { ChildProcess } from 'node:child_process';

const HIGH_WATER_MARK = 64;

type AnyMessage = Record<string, unknown>;

function safeJsonParse(line: string): AnyMessage | null {
  try {
    return JSON.parse(line) as AnyMessage;
  } catch {
    return null;
  }
}

export class NdjsonTransport {
  /** 从原始字节流创建 Stream（委托 SDK 的 ndJsonStream） */
  static fromByteStreams(
    rawWritable: WritableStream<Uint8Array>,
    rawReadable: ReadableStream<Uint8Array>
  ): Stream {
    return ndJsonStream(rawWritable, rawReadable);
  }

  /** 从子进程 stdio 创建 Stream（要求 stdio: pipe） */
  static fromChildProcess(child: ChildProcess): Stream {
    if (!child.stdout || !child.stdin) {
      throw new Error('Child process must be spawned with stdio: pipe');
    }
    const rawReadable = Readable.toWeb(child.stdout) as ReadableStream<Uint8Array>;
    const rawWritable = Writable.toWeb(child.stdin) as WritableStream<Uint8Array>;
    return ndJsonStream(rawWritable, rawReadable);
  }

  /** 从 WebSocket 连接创建 Stream（SDK 未提供 WS 适配，保留自定义实现） */
  static fromWebSocket(ws: WebSocket): Stream {
    const readable = new ReadableStream<AnyMessage>(
      {
        start(controller) {
          ws.addEventListener('message', (event) => {
            const data = typeof event.data === 'string' ? event.data : '';
            for (const line of data.split('\n')) {
              const trimmed = line.trim();
              if (trimmed.length === 0) continue;
              const msg = safeJsonParse(trimmed);
              if (msg) controller.enqueue(msg);
            }
          });
          ws.addEventListener('close', () => controller.close());
          ws.addEventListener('error', (e) => controller.error(e));
        },
      },
      new CountQueuingStrategy({ highWaterMark: HIGH_WATER_MARK })
    );

    const writable = new WritableStream<AnyMessage>({
      write(message) {
        ws.send(JSON.stringify(message) + '\n');
      },
    });

    return { readable, writable } as Stream;
  }
}
