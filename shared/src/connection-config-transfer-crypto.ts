import {
  validationIssue,
  validationValue,
  ValidationError,
  type ValidationIssue,
  type ValidationValue,
} from './validation-issue';
import {
  CONNECTION_CONFIG_LIMITS,
  parseConnectionConfigBundle,
  validateConnectionConfigBundle,
  type ConnectionConfigBundle,
} from './connection-config-transfer';
export type EncryptedConnectionConfig = {
  format: 'fouc-connection-config-encrypted';
  version: 1;
  cipher: 'AES-256-GCM';
  kdf: 'PBKDF2-SHA256';
  iterations: 600000;
  salt: string;
  iv: string;
  data: string;
};
const iterations = 600000;
const additionalData = new TextEncoder().encode(
  'fouc-connection-config-encrypted:1:AES-256-GCM:PBKDF2-SHA256:600000',
);
function runtime(): Crypto {
  if (!globalThis.crypto?.subtle || !globalThis.crypto?.getRandomValues)
    throw new ValidationError(
      validationIssue(
        'connection-config-transfer-crypto.webcryptoIsUnavailableInThisBrowserOpenOver',
        '当前浏览器未提供 WebCrypto；请使用 HTTPS 或 localhost 打开后进行加密操作',
      ),
    );
  return globalThis.crypto;
}
function password(passphrase: string) {
  if (
    typeof passphrase !== 'string' ||
    Array.from(passphrase).length < 12 ||
    passphrase.length > 1024
  )
    throw new ValidationError(
      validationIssue(
        'connection-config-transfer-crypto.encryptionPasswordsMustContainCharacters',
        '加密口令须为 12–1024 个字符',
      ),
    );
}
function base64(bytes: Uint8Array<ArrayBuffer>): string {
  let text = '';
  for (let index = 0; index < bytes.length; index += 8192)
    text += String.fromCharCode(...bytes.subarray(index, index + 8192));
  return btoa(text);
}
function bytes(text: unknown, expected: number | null): Uint8Array<ArrayBuffer> {
  if (
    typeof text !== 'string' ||
    text.length > Math.ceil((CONNECTION_CONFIG_LIMITS.plainBytes + 16) / 3) * 4 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(text)
  )
    throw new ValidationError(
      validationIssue(
        'connection-config-transfer-crypto.encryptedConfigurationContainsInvalidBaseData',
        '加密配置包含无效 Base64 数据',
      ),
    );
  const decoded = atob(text),
    value = new Uint8Array(decoded.length);
  for (let index = 0; index < decoded.length; index++) value[index] = decoded.charCodeAt(index);
  if (
    base64(value) !== text ||
    (expected !== null && value.length !== expected) ||
    (expected === null && value.length < 17)
  )
    throw new ValidationError(
      validationIssue(
        'connection-config-transfer-crypto.invalidEncryptedConfigurationLengthOrEncoding',
        '加密配置长度或编码无效',
      ),
    );
  return value;
}
async function key(passphrase: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  password(passphrase);
  const subtle = runtime().subtle;
  const material = await subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}
export function validateEncryptedConnectionConfig(value: unknown): EncryptedConnectionConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new ValidationError(
      validationIssue(
        'connection-config-transfer-crypto.encryptedConfigurationMustBeAnObject',
        '加密配置须为对象',
      ),
    );
  const raw = value as Record<string, unknown>;
  if (
    Object.keys(raw).some(
      (key) =>
        !['format', 'version', 'cipher', 'kdf', 'iterations', 'salt', 'iv', 'data'].includes(key),
    ) ||
    raw.format !== 'fouc-connection-config-encrypted' ||
    raw.version !== 1 ||
    raw.cipher !== 'AES-256-GCM' ||
    raw.kdf !== 'PBKDF2-SHA256' ||
    raw.iterations !== iterations
  )
    throw new ValidationError(
      validationIssue(
        'connection-config-transfer-crypto.encryptedConfigurationFormatVersionOrEncryptionParametersAre',
        '加密配置格式、版本或加密参数不受支持',
      ),
    );
  bytes(raw.salt, 16);
  bytes(raw.iv, 12);
  bytes(raw.data, null);
  return raw as EncryptedConnectionConfig;
}
export async function encryptConnectionConfig(
  bundle: ConnectionConfigBundle,
  passphrase: string,
  signal?: AbortSignal,
): Promise<EncryptedConnectionConfig> {
  signal?.throwIfAborted();
  const valid = validateConnectionConfigBundle(bundle),
    crypto = runtime();
  const salt = crypto.getRandomValues(new Uint8Array(16)),
    iv = crypto.getRandomValues(new Uint8Array(12));
  const derived = await key(passphrase, salt);
  signal?.throwIfAborted();
  const data = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData, tagLength: 128 },
    derived,
    new TextEncoder().encode(JSON.stringify(valid)),
  );
  signal?.throwIfAborted();
  return {
    format: 'fouc-connection-config-encrypted',
    version: 1,
    cipher: 'AES-256-GCM',
    kdf: 'PBKDF2-SHA256',
    iterations,
    salt: base64(salt),
    iv: base64(iv),
    data: base64(new Uint8Array(data)),
  };
}
export async function decodeConnectionConfigFile(
  source: string,
  passphrase = '',
  signal?: AbortSignal,
): Promise<ConnectionConfigBundle> {
  signal?.throwIfAborted();
  if (new TextEncoder().encode(source).length > CONNECTION_CONFIG_LIMITS.fileBytes)
    throw new ValidationError(
      validationIssue(
        'connection-config-transfer-crypto.configurationFilesMustNotExceedMib',
        '配置文件不能超过 3 MiB',
      ),
    );
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    throw new ValidationError(
      validationIssue(
        'connection-config-transfer-crypto.configurationFileIsNotValidJson',
        '配置文件不是有效 JSON',
      ),
    );
  }
  if (
    !value ||
    typeof value !== 'object' ||
    !('format' in value) ||
    value.format !== 'fouc-connection-config-encrypted'
  )
    return parseConnectionConfigBundle(source);
  const encrypted = validateEncryptedConnectionConfig(value),
    derived = await key(passphrase, bytes(encrypted.salt, 16));
  signal?.throwIfAborted();
  let plaintext: ArrayBuffer;
  try {
    plaintext = await runtime().subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: bytes(encrypted.iv, 12),
        additionalData,
        tagLength: 128,
      },
      derived,
      bytes(encrypted.data, null),
    );
  } catch {
    throw new ValidationError(
      validationIssue(
        'connection-config-transfer-crypto.decryptionFailedThePasswordIsIncorrectOrThe',
        '解密失败：口令不正确或文件已被修改；未导入任何连接',
      ),
    );
  }
  signal?.throwIfAborted();
  let decoded: string;
  try {
    decoded = new TextDecoder('utf-8', { fatal: true }).decode(plaintext);
  } catch {
    throw new ValidationError(
      validationIssue(
        'connection-config-transfer-crypto.decryptedConfigurationIsNotValidUtfText',
        '解密后的配置不是有效 UTF-8 文本',
      ),
    );
  }
  return parseConnectionConfigBundle(decoded);
}
