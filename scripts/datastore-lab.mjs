import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directory = path.join(root, '.runtime/dbx-lab');
const envPath = path.join(directory, 'mysql.env');
const windows = process.platform === 'win32';
const distro = process.env.KNOWLEDGE_WSL_DISTRO ?? 'Ubuntu-22.04';
const linuxPath = (value) =>
  windows
    ? value.replace(/^([A-Za-z]):[\\/]/, (_, drive) => `/mnt/${drive.toLowerCase()}/`).replaceAll('\\', '/')
    : value;
function linux(tool, args, options = {}) {
  return execFileSync(windows ? 'wsl.exe' : tool, windows ? ['-d', distro, '--exec', tool, ...args] : args, {
    windowsHide: true,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    ...options,
  });
}
const action = process.argv[2] ?? 'status';
if (!['up', 'status'].includes(action)) throw new Error('Usage: node scripts/datastore-lab.mjs up|status');
if (action === 'up') {
  mkdirSync(directory, { recursive: true });
  execFileSync('git', ['check-ignore', '.runtime/dbx-lab/mysql.env'], {
    cwd: root,
    windowsHide: true,
    stdio: 'pipe',
  });
  if (!existsSync(envPath))
    writeFileSync(
      envPath,
      `FOUC_MYSQL_LAB_ROOT_PASSWORD=${randomBytes(32).toString('hex')}\nFOUC_MYSQL_LAB_PASSWORD=${randomBytes(32).toString('hex')}\n`,
      { mode: 0o600, flag: 'wx' },
    );
  linux(
    'docker',
    [
      'compose',
      '--project-name',
      'fouc-datastore-lab',
      '--project-directory',
      linuxPath(root),
      '--env-file',
      linuxPath(envPath),
      '-f',
      linuxPath(path.join(root, 'compose.datastore-lab.yaml')),
      'up',
      '-d',
      '--wait',
      '--wait-timeout',
      '120',
    ],
    { stdio: 'inherit' },
  );
  const host = windows
    ? linux('hostname', ['-I'])
        .trim()
        .split(/\s+/)
        .find((address) => /^\d+(\.\d+){3}$/.test(address))
    : '127.0.0.1';
  if (!host) throw new Error('WSL datasource host unavailable');
  const env = parseEnv(readFileSync(envPath, 'utf8'));
  writeFileSync(
    path.join(directory, 'mysql-connection.json'),
    JSON.stringify({
      provider: 'mysql',
      host,
      port: 53306,
      username: 'fouc_lab',
      password: env.FOUC_MYSQL_LAB_PASSWORD,
      database: 'fouc_datastore_lab',
      ssl: false,
    }),
    { mode: 0o600 },
  );
  console.log(
    `MySQL lab ready: ${host}:53306 / fouc_datastore_lab. Credentials saved only in gitignored runtime files.`,
  );
} else {
  console.log(
    linux('docker', [
      'inspect',
      '--format',
      '{{.Name}} {{.State.Status}} {{.State.Health.Status}}',
      'fouc-datastore-lab-mysql-1',
    ]).trim(),
  );
}
