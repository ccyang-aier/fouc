import { CONNECTION_OPTIONS_LIMITS } from '@fouc/shared/connection-options';

export type ConnectionPemKind = 'caPem' | 'certificatePem' | 'privateKeyPem';

/** Read the actual selected Web file, rather than forwarding an unusable browser path. */
export async function readConnectionPem(
  file: File,
  kind: ConnectionPemKind,
): Promise<string> {
  if (file.size > CONNECTION_OPTIONS_LIMITS.pemBytes)
    throw new Error('PEM 文件不能超过 256 KiB');
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(
      await file.arrayBuffer(),
    );
  } catch {
    throw new Error('文件无法读取为 UTF-8 文本，请选择 PEM 文件');
  }
  if (text.includes('\0')) throw new Error('PEM 文件包含无效字符');
  const expression =
    kind === 'privateKeyPem'
      ? /^\s*-----BEGIN (?:RSA |EC |ENCRYPTED )?PRIVATE KEY-----[\s\S]+-----END (?:RSA |EC |ENCRYPTED )?PRIVATE KEY-----\s*$/
      : /^\s*-----BEGIN CERTIFICATE-----[\s\S]+-----END CERTIFICATE-----\s*$/;
  if (!expression.test(text))
    throw new Error(
      kind === 'privateKeyPem'
        ? '请选择 PEM 格式的客户端私钥'
        : '请选择 PEM CERTIFICATE 证书文件',
    );
  return text;
}
