import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, openSync, closeSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { parseEnv } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { ensureDevelopmentInfrastructure } from '../backend/server/scripts/infra.mjs';
import { waitForReady } from './dev-readiness.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const logDirectory = path.join(root, '.runtime', 'dev');
const normalize = (value) => (value ?? '').replaceAll('\\', '/').toLowerCase();
const bunName = process.platform === 'win32' ? 'bun.exe' : 'bun';
const bunExecutable = [
  process.env.FOUC_BUN_PATH,
  ...String(process.env.PATH).split(path.delimiter).map((directory) => path.join(directory, bunName)),
  path.join(path.dirname(process.execPath), 'node_modules', 'bun', 'bin', bunName),
  path.join(process.env.BUN_INSTALL ?? path.join(homedir(), '.bun'), 'bin', bunName),
].find((file) => file && existsSync(file));
if (!bunExecutable) throw new Error('Bun executable was not found. Install Bun or set FOUC_BUN_PATH to its executable.');
const { endpointsChanged } = await ensureDevelopmentInfrastructure();
const databaseCommand = (command) => execFileSync(bunExecutable, [path.join(root, 'backend/server/scripts/database.ts'), command], { cwd: root, env: process.env, encoding: 'utf8', windowsHide: true, timeout: 30_000 });
const databaseStatus = JSON.parse(databaseCommand('status'));
if (databaseStatus.state === 'empty') databaseCommand('init');
else databaseCommand('check');
console.log('Database structure: ready; existing application data retained.');
const serverEnvironment = ['.env.fouc.local'].filter((file) => existsSync(path.join(root, file))).map((file) => `--env-file=${file}`);
const serverLocalEnvironment = existsSync(path.join(root, '.env.fouc.local')) ? parseEnv(readFileSync(path.join(root, '.env.fouc.local'), 'utf8')) : {};
const webPort = Number(process.env.FOUC_WEB_PORT ?? serverLocalEnvironment.FOUC_WEB_PORT ?? 3000);
const services = [
  { name: 'Web', port: webPort, health: '/', executable: process.execPath, args: [require.resolve('next/dist/bin/next'), 'dev', '--hostname', '0.0.0.0', '--port', String(webPort)], owner: ({ command, parentCommand }) => normalize(command).includes(normalize(root) + '/node_modules/') && /next[\\/]/.test(command) && /\bnext\b.*\bdev\b/.test(command + ' ' + parentCommand) },
  { name: 'Device', port: Number(process.env.FOUC_BACKEND_PORT ?? 8710), health: '/health', executable: bunExecutable, args: ['--watch', path.join(root, 'backend/device/src/entrypoints/index.ts')] },
  { name: 'Server', port: Number(process.env.FOUC_SERVICE_PORT ?? serverLocalEnvironment.FOUC_SERVICE_PORT ?? 8711), health: '/api/auth/ok', executable: bunExecutable, args: ['--watch', ...serverEnvironment, path.join(root, 'backend/server/src/entrypoints/server.ts')] },
];

function listenerCommands(port) {
  if (process.platform === 'win32') {
    const output = execFileSync('powershell.exe', ['-NoProfile', '-Command', `$ErrorActionPreference='Stop'; $listeners=Get-NetTCPConnection -State Listen -LocalPort ${port} -ErrorAction SilentlyContinue; $commands=@($listeners | ForEach-Object { $listenerProcess=Get-CimInstance Win32_Process -Filter ('ProcessId='+$_.OwningProcess); $parentProcess=Get-CimInstance Win32_Process -Filter ('ProcessId='+$listenerProcess.ParentProcessId); @{ pid=$listenerProcess.ProcessId; command=$listenerProcess.CommandLine; parentPid=$listenerProcess.ParentProcessId; parentCommand=$parentProcess.CommandLine } }); ConvertTo-Json -InputObject $commands -Compress`], { encoding: 'utf8', windowsHide: true });
    return JSON.parse(output.trim() || '[]');
  }
  // lsof is only needed when reusing an existing Unix listener. A port owned
  // by another checkout is rejected instead of silently switching projects.
  try {
    const ids = execFileSync('lsof', ['-t', '-iTCP:' + port, '-sTCP:LISTEN'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim().split(/\s+/);
    return ids.map((id) => {
      const command = execFileSync('ps', ['-p', id, '-o', 'args='], { encoding: 'utf8' }).trim();
      const parentPid = Number(execFileSync('ps', ['-p', id, '-o', 'ppid='], { encoding: 'utf8' }).trim());
      const parentCommand = execFileSync('ps', ['-p', String(parentPid), '-o', 'args='], { encoding: 'utf8' }).trim();
      return { pid: Number(id), command, parentPid, parentCommand };
    });
  } catch (error) {
    if (error.status === 1) return [];
    throw new Error('Existing listener ownership requires lsof and ps on this platform.', { cause: error });
  }
}

const pending = [];
for (const service of services) {
  let commands = listenerCommands(service.port);
  const owned = service.owner ?? (({ command }) => normalize(command).includes(normalize(service.args.at(-1)))
    && /(?:^|\s)--watch(?:\s|$)/.test(command));
  if (commands.length) {
    if (!commands.every(owned)) throw new Error(`${service.name}: port ${service.port} belongs to another process or checkout. Stop that process or select a different port.`);
  }
  if (commands.length && service.name === 'Server' && endpointsChanged) {
    for (const listener of commands) {
      const watcher = owned({ command: listener.parentCommand }) ? listener.parentPid : listener.pid;
      if (process.platform === 'win32') execFileSync('taskkill.exe', ['/PID', String(watcher), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
      else { process.kill(watcher, 'SIGTERM'); if (watcher !== listener.pid) process.kill(listener.pid, 'SIGTERM'); }
    }
    commands = [];
    console.log('Server: restarting the owned watcher to reload updated infrastructure endpoints.');
  }
  if (commands.length) {
    pending.push({ service, reused: true });
    continue;
  }
  mkdirSync(logDirectory, { recursive: true });
  const stdout = openSync(path.join(logDirectory, service.name.toLowerCase() + '.log'), 'a');
  const stderr = openSync(path.join(logDirectory, service.name.toLowerCase() + '.error.log'), 'a');
  const child = spawn(service.executable, service.args, { cwd: root, env: process.env, detached: true, windowsHide: true, stdio: ['ignore', stdout, stderr] });
  closeSync(stdout);
  closeSync(stderr);
  await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
  child.unref();
  console.log(`${service.name}: started dev process (PID ${child.pid}); waiting for HTTP 200.`);
  pending.push({ service, child });
}
const results = await Promise.allSettled(pending.map(async ({ service, child, reused }) => {
  const ready = await waitForReady({
    url: `http://127.0.0.1:${service.port}${service.health}`,
    timeoutMs: service.name === 'Web' ? 180_000 : 45_000,
    requestTimeoutMs: service.name === 'Web' ? 60_000 : 2_000,
    jsonHealth: service.name !== 'Web',
  }, { child, onWaiting: () => console.log(`${service.name}: waiting for HTTP 200${service.name === 'Web' ? ' (first page compilation may take up to 180 seconds)' : ''}…`) });
  if (!ready) throw new Error(`${service.name} failed to become ready; inspect ${logDirectory}.`);
  console.log(`${service.name}: ${reused ? 'reusing' : 'ready at'} http://localhost:${service.port}${service.health} (HTTP 200)`);
}));
const failures = results.filter((result) => result.status === 'rejected');
if (failures.length) throw new Error(failures.map((result) => result.reason.message).join('\n'));
console.log('Development services remain running. Next.js and Bun watch source changes automatically.');
