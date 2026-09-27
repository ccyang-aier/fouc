import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, openSync, closeSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { parseEnv } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { setTimeout as delay } from 'node:timers/promises';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const logDirectory = path.join(root, '.runtime', 'dev');
const normalize = (value) => value.replaceAll('\\', '/').toLowerCase();
const bunName = process.platform === 'win32' ? 'bun.exe' : 'bun';
const bunExecutable = [
  process.env.FOUC_BUN_PATH,
  ...String(process.env.PATH).split(path.delimiter).map((directory) => path.join(directory, bunName)),
  path.join(path.dirname(process.execPath), 'node_modules', 'bun', 'bin', bunName),
  path.join(process.env.BUN_INSTALL ?? path.join(homedir(), '.bun'), 'bin', bunName),
].find((file) => file && existsSync(file));
if (!bunExecutable) throw new Error('Bun executable was not found. Install Bun or set FOUC_BUN_PATH to its executable.');
const serverEnvironment = ['.env.fouc.local', '.env.knowledge.models.local'].filter((file) => existsSync(path.join(root, file))).map((file) => `--env-file=${file}`);
const serverLocalEnvironment = existsSync(path.join(root, '.env.fouc.local')) ? parseEnv(readFileSync(path.join(root, '.env.fouc.local'), 'utf8')) : {};
const services = [
  { name: 'Web', port: 3000, health: '/', executable: process.execPath, args: [require.resolve('next/dist/bin/next'), 'dev', '--hostname', '0.0.0.0', '--port', '3000'], owner: (command) => normalize(command).includes(normalize(root) + '/node_modules/') && /next[\\/]/.test(command) },
  { name: 'Device', port: Number(process.env.FOUC_BACKEND_PORT ?? 8710), health: '/health', executable: bunExecutable, args: ['--hot', path.join(root, 'backend/device/src/entrypoints/index.ts')] },
  { name: 'Server', port: Number(process.env.FOUC_SERVICE_PORT ?? serverLocalEnvironment.FOUC_SERVICE_PORT ?? 8711), health: '/api/auth/ok', executable: bunExecutable, args: ['--watch', ...serverEnvironment, path.join(root, 'backend/server/src/entrypoints/server.ts')] },
];

function listenerCommands(port) {
  if (process.platform === 'win32') {
    const output = execFileSync('powershell.exe', ['-NoProfile', '-Command', `$ErrorActionPreference='Stop'; $listeners=Get-NetTCPConnection -State Listen -LocalPort ${port} -ErrorAction SilentlyContinue; $commands=@($listeners | ForEach-Object { $listenerProcess=Get-CimInstance Win32_Process -Filter ('ProcessId='+$_.OwningProcess); $listenerProcess.CommandLine }); ConvertTo-Json -InputObject $commands -Compress`], { encoding: 'utf8', windowsHide: true });
    return JSON.parse(output.trim() || '[]');
  }
  // lsof is only needed when reusing an existing Unix listener. A port owned
  // by another checkout is rejected instead of silently switching projects.
  try {
    const ids = execFileSync('lsof', ['-t', '-iTCP:' + port, '-sTCP:LISTEN'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim().split(/\s+/);
    return ids.map((id) => execFileSync('ps', ['-p', id, '-o', 'args='], { encoding: 'utf8' }).trim());
  } catch (error) {
    if (error.status === 1) return [];
    throw new Error('Existing listener ownership requires lsof and ps on this platform.', { cause: error });
  }
}

async function ready(service) {
  try {
    const response = await fetch(`http://127.0.0.1:${service.port}${service.health}`, { signal: AbortSignal.timeout(2_000) });
    if (!response.ok) return false;
    return service.name === 'Web' || (await response.json()).ok === true;
  } catch { return false; }
}

for (const service of services) {
  const commands = listenerCommands(service.port);
  const owned = service.owner ?? ((command) => normalize(command).includes(normalize(service.args.at(-1))));
  if (commands.length) {
    if (!commands.every(owned)) throw new Error(`${service.name}: port ${service.port} belongs to another process or checkout. Stop that process or select a different port.`);
    if (!await ready(service)) throw new Error(`${service.name}: existing process is not ready. Check its logs before restarting.`);
    console.log(`${service.name}: reusing http://localhost:${service.port}`);
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
  let available = false;
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    if (await ready(service)) { available = true; break; }
    if (child.exitCode !== null) break;
    await delay(500);
  }
  if (!available) throw new Error(`${service.name} failed to become ready; inspect ${logDirectory}.`);
  console.log(`${service.name}: started http://localhost:${service.port} (PID ${child.pid})`);
}
console.log('Development services remain running. Next.js and Bun watch source changes automatically.');
