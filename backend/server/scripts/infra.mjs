import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { parseEnv } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { findServiceContainer, selectSubnet } from './infra-plan.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const envPath = path.join(root, '.env.fouc.local');
const project = 'fouc-dev';
const windows = process.platform === 'win32';
const linuxPath = (value) => windows ? value.replace(/^([A-Za-z]):[\\/]/, (_, drive) => `/mnt/${drive.toLowerCase()}/`).replaceAll('\\', '/') : value;
let localEnv = {};
let serviceContainers = {};
const wslDistro = () => process.env.FOUC_WSL_DISTRO ?? localEnv.FOUC_WSL_DISTRO ?? 'Ubuntu-22.04';

// Windows reaches the WSL-side services through the WSL NAT address. The
// Windows→WSL loopback relay cannot sustain pooled concurrent connections, so
// host-side endpoints must never point at 127.0.0.1.
async function endpointHost() {
  if (!windows) return '127.0.0.1';
  const output = await run('wsl.exe', ['-d', wslDistro(), '--exec', 'hostname', '-I'], { quiet: true, timeout: 15000 });
  const address = output.trim().split(/\s+/).find((token) => /^\d+(\.\d+){3}$/.test(token) && !token.startsWith('127.'));
  if (!address) throw new Error('Could not resolve the WSL address for development endpoints.');
  return address;
}

// The WSL NAT address changes across reboots; realign endpoint hosts in the
// gitignored env file so test suites keep a single source of truth.
function syncEndpoints(host) {
  const updates = {};
  for (const key of ['DATABASE_URL', 'DATABASE_ADMIN_URL', 'REDIS_URL', 'S3_ENDPOINT']) {
    if (!localEnv[key]) continue;
    const url = new URL(localEnv[key]);
    if (url.hostname !== host) { url.hostname = host; updates[key] = url.toString(); }
  }
  const changed = Object.keys(updates).length > 0;
  if (changed) {
    updateLocalEnv(updates);
    console.log(`Development endpoints in .env.fouc.local updated to the current WSL address ${host}.`);
  }
  return changed;
}

function loadLocalEnv() {
  if (!existsSync(envPath)) throw new Error('Run node backend/server/scripts/infra.mjs init first.');
  return parseEnv(readFileSync(envPath, 'utf8'));
}

function updateLocalEnv(values) {
  let content = readFileSync(envPath, 'utf8');
  for (const [key, value] of Object.entries(values)) {
    if (localEnv[key] === String(value)) continue;
    const line = `${key}=${JSON.stringify(String(value))}`;
    const expression = new RegExp(`^${key}=.*$`, 'm');
    content = expression.test(content) ? content.replace(expression, () => line) : content.trimEnd() + '\n' + line + '\n';
  }
  if (content !== readFileSync(envPath, 'utf8')) writeFileSync(envPath, content);
  localEnv = loadLocalEnv();
}

function redact(value) {
  let safe = String(value);
  for (const [name, secret] of Object.entries(localEnv)) {
    if (secret && /PASSWORD|SECRET|ACCESS_KEY|DATABASE.*URL|REDIS_URL/.test(name)) safe = safe.replaceAll(secret, '[redacted]');
  }
  return safe;
}

function run(executable, args, { input, quiet = false, timeout = 0 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { cwd: root, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = timeout ? setTimeout(() => child.kill(), timeout) : null;
    child.stdout.on('data', (chunk) => { stdout += chunk; if (!quiet) process.stdout.write(redact(chunk)); });
    child.stderr.on('data', (chunk) => { stderr += chunk; if (!quiet) process.stderr.write(redact(chunk)); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (timer) clearTimeout(timer);
      if (code === 0) resolve(stdout);
      else reject(new Error(redact(`${path.basename(executable)} exited ${code}: ${stderr || stdout}`)));
    });
    child.stdin.on('error', () => {});
    child.stdin.end(input);
  });
}

function linuxTool(tool, args, options) {
  return windows ? run('wsl.exe', ['-d', wslDistro(), '--exec', tool, ...args], options) : run(tool, args, options);
}

function compose(args, options) {
  return linuxTool('docker', ['compose', '--project-name', project, '--project-directory', linuxPath(root), '--env-file', linuxPath(envPath), '-f', linuxPath(path.join(root, 'compose.fouc.yaml')), ...args], options);
}

async function keepWslAlive() {
  if (!windows) return;
  // systemd/Docker services alone do not keep a WSL distribution alive. Hold
  // one hidden client session; flock makes repeated `up` calls single-instance.
  // No global WSL setting or existing service is changed.
  await linuxTool('/usr/bin/flock', ['--version'], { quiet: true });
  const keeper = spawn('wsl.exe', ['-d', wslDistro(), '--exec', '/usr/bin/flock', '-n', '/tmp/fouc-dev.keepalive.lock', '/usr/bin/sleep', 'infinity'], {
    cwd: root, detached: true, windowsHide: true, stdio: 'ignore',
  });
  await new Promise((resolve, reject) => {
    keeper.once('spawn', resolve);
    keeper.once('error', reject);
  });
  keeper.unref();
  console.log('WSL development keepalive requested (hidden session, single-instance lock).');
}

async function init() {
  if (existsSync(envPath)) {
    console.log('Using existing gitignored .env.fouc.local; credentials unchanged.');
    localEnv = loadLocalEnv();
    const redisPassword = localEnv.REDIS_URL ? decodeURIComponent(new URL(localEnv.REDIS_URL).password) : randomBytes(32).toString('hex');
    const host = new URL(localEnv.DATABASE_URL).hostname;
    updateLocalEnv({
      FOUC_REDIS_PASSWORD: redisPassword,
      REDIS_URL: localEnv.REDIS_URL ?? `redis://:${redisPassword}@${host}:56379`,
    });
    return;
  }
  await run('git', ['check-ignore', '.env.fouc.local'], { quiet: true });
  const password = () => randomBytes(32).toString('hex');
  const postgresPassword = password();
  const appPassword = password();
  const redisPassword = password();
  const host = await endpointHost();
  localEnv = {
    FOUC_WSL_DISTRO: wslDistro(),
    FOUC_POSTGRES_USER: 'fouc_admin',
    FOUC_POSTGRES_DB: 'fouc',
    FOUC_POSTGRES_PASSWORD: postgresPassword,
    FOUC_DATABASE_APP_PASSWORD: appPassword,
    DATABASE_URL: `postgresql://fouc_app:${appPassword}@${host}:55432/fouc`,
    DATABASE_ADMIN_URL: `postgresql://fouc_admin:${postgresPassword}@${host}:55432/fouc`,
    FOUC_REDIS_PASSWORD: redisPassword,
    REDIS_URL: `redis://:${redisPassword}@${host}:56379`,
    BETTER_AUTH_URL: 'http://127.0.0.1:8711',
    BETTER_AUTH_SECRET: password(),
    FOUC_AUTH_TRUSTED_ORIGINS: 'http://localhost:3000,http://127.0.0.1:3000',
    S3_ENDPOINT: `http://${host}:59000`,
    S3_REGION: 'us-east-1',
    S3_BUCKET: 'fouc-resources',
    S3_ACCESS_KEY_ID: `fouc${randomBytes(10).toString('hex')}`,
    S3_SECRET_ACCESS_KEY: password(),
  };
  writeFileSync(envPath, `# Generated local development credentials. Do not commit.\n${Object.entries(localEnv).map(([key, value]) => `${key}=${value}`).join('\n')}\n`, { flag: 'wx', mode: 0o600 });
  console.log('Created gitignored .env.fouc.local with unique credentials (values not displayed).');
}

async function pullImage(image) {
  try {
    await linuxTool('docker', ['image', 'inspect', image, '--format', '{{.Id}}'], { quiet: true, timeout: 30000 });
    console.log(`Using local image ${image}.`);
    return;
  } catch { /* This fixed image is not present yet. */ }
  console.log(`Fetching official image ${image}.`);
  try {
    await linuxTool('docker', ['pull', image]);
  } catch (error) {
    console.log(`Docker pull did not complete; using the existing Skopeo registry transport for ${image}.`);
    try {
      await linuxTool('skopeo', ['copy', '--retry-times', '3', '--override-os', 'linux', '--override-arch', 'amd64', `docker://${image}`, `docker-daemon:${image}`]);
    } catch (fallbackError) {
      throw new AggregateError([error, fallbackError], `Unable to fetch official image ${image}.`);
    }
  }
}

async function initializeDatabase() {
  const appPassword = localEnv.FOUC_DATABASE_APP_PASSWORD;
  if (!/^[a-f0-9]{64}$/.test(appPassword)) throw new Error('Local app credential has an unexpected format.');
  const sql = `DO $bootstrap$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'fouc_app') THEN
    CREATE ROLE fouc_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD '${appPassword}';
  END IF;
END $bootstrap$;
GRANT CONNECT ON DATABASE fouc TO fouc_app;
GRANT USAGE ON SCHEMA public TO fouc_app;
`;
  await linuxTool('docker', ['exec', '-i', serviceContainers.postgres.Id, 'psql', '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-U', localEnv.FOUC_POSTGRES_USER, '-d', localEnv.FOUC_POSTGRES_DB], { input: sql, quiet: true });
  console.log('Database and non-superuser runtime role are ready.');
}

async function readContainers() {
  const ids = (await linuxTool('docker', ['ps', '-aq'], { quiet: true })).trim().split(/\s+/).filter(Boolean);
  return ids.length ? JSON.parse(await linuxTool('docker', ['inspect', ...ids], { quiet: true })) : [];
}

function infrastructureServices() {
  return [
    { name: 'postgres', port: Number(new URL(localEnv.DATABASE_URL).port || 5432), containerPort: '5432/tcp', image: 'postgres:17-alpine' },
    { name: 'redis', port: Number(new URL(localEnv.REDIS_URL).port || 6379), containerPort: '6379/tcp', image: 'redis:7.4.8-alpine' },
    { name: 'minio', port: Number(new URL(localEnv.S3_ENDPOINT).port || 80), containerPort: '9000/tcp', image: 'fouc-minio:RELEASE.2025-10-15T17-29-55Z' },
  ];
}

async function prepareNetwork() {
  const ids = (await linuxTool('docker', ['network', 'ls', '-q'], { quiet: true })).trim().split(/\s+/).filter(Boolean);
  const networks = ids.length ? JSON.parse(await linuxTool('docker', ['network', 'inspect', ...ids], { quiet: true })) : [];
  const existing = networks.find((network) => network.Name === `${project}_default`);
  if (existing && existing.Labels?.['com.docker.compose.project'] !== project) throw new Error('Development network name belongs to another Docker project.');
  const occupied = networks.flatMap((network) => network.IPAM.Config ?? []).map((entry) => entry.Subnet).filter(Boolean);
  occupied.push(...Object.values(networkInterfaces()).flat().filter((entry) => entry?.family === 'IPv4').map((entry) => entry.cidr).filter(Boolean));
  const subnet = existing?.IPAM.Config.find((entry) => entry.Subnet && !entry.Subnet.includes(':'))?.Subnet
    ?? selectSubnet(occupied, process.env.FOUC_DEV_SUBNET ?? localEnv.FOUC_DEV_SUBNET);
  updateLocalEnv({ FOUC_DEV_SUBNET: subnet });
  console.log(`Development network: ${subnet}.`);
}

async function ensureContainers() {
  const services = infrastructureServices();
  const containers = await readContainers();
  serviceContainers = Object.fromEntries(services.map((service) => [service.name, findServiceContainer(containers, service, linuxPath(root))]));
  const missing = services.filter((service) => !serviceContainers[service.name]);
  for (const service of services.filter((service) => serviceContainers[service.name])) {
    const container = serviceContainers[service.name];
    if (!container.State.Running) await linuxTool('docker', ['start', container.Id], { quiet: true });
    console.log(`${service.name}: reusing ${container.Name.slice(1)} (existing data volume retained).`);
  }
  if (missing.length) {
    await prepareNetwork();
    updateLocalEnv({
      FOUC_POSTGRES_PORT: services[0].port,
      FOUC_REDIS_PORT: services[1].port,
      FOUC_MINIO_PORT: services[2].port,
    });
    await compose(['config', '--quiet'], { quiet: true });
    for (const service of missing) {
      if (service.name !== 'minio') { await pullImage(service.image); continue; }
      try {
        await linuxTool('docker', ['image', 'inspect', service.image], { quiet: true });
      } catch {
        for (const image of ['golang:1.24.8-alpine', 'alpine:3.21']) await pullImage(image);
        await compose(['build', '--provenance=false', 'minio']);
      }
    }
    await compose(['up', '-d', '--no-recreate', '--no-deps', '--no-build', '--pull', 'never', ...missing.map((service) => service.name)]);
  }
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    const current = await readContainers();
    serviceContainers = Object.fromEntries(services.map((service) => [service.name, findServiceContainer(current, service, linuxPath(root))]));
    if (services.every((service) => {
      const state = serviceContainers[service.name]?.State;
      return state?.Running && (!state.Health || state.Health.Status === 'healthy');
    })) return;
    await delay(1000);
  }
  throw new Error('Infrastructure did not become healthy within 120 seconds; inspect Docker container logs.');
}

async function verifyRedis() {
  const url = new URL(localEnv.REDIS_URL);
  if (url.protocol !== 'redis:') throw new Error('Local development Redis must use redis://.');
  const commands = [];
  if (url.password) commands.push(['AUTH', ...(url.username ? [decodeURIComponent(url.username)] : []), decodeURIComponent(url.password)]);
  if (url.pathname.slice(1)) commands.push(['SELECT', url.pathname.slice(1)]);
  commands.push(['PING']);
  const request = commands.map((parts) => `*${parts.length}\r\n${parts.map((part) => `$${Buffer.byteLength(part)}\r\n${part}\r\n`).join('')}`).join('');
  await new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: url.hostname, port: Number(url.port || 6379) });
    let response = '';
    const fail = () => { socket.destroy(); reject(new Error('Redis host authentication/PING failed.')); };
    socket.setTimeout(5000, fail);
    socket.on('error', fail);
    socket.on('end', () => { if (!response.endsWith('+PONG\r\n')) fail(); });
    socket.on('connect', () => socket.write(request));
    socket.on('data', (chunk) => {
      response += chunk;
      if (response.split('\r\n').some((line) => line.startsWith('-'))) fail();
      else if (response.endsWith('+PONG\r\n')) { socket.destroy(); resolve(); }
    });
  });
  console.log(`PASS Redis: authenticated host PING returned PONG at ${url.hostname}:${url.port || 6379}.`);
}

const hash = (value) => createHash('sha256').update(value).digest('hex');
const hmac = (key, value) => createHmac('sha256', key).update(value).digest();

async function s3(method, pathname, body = '') {
  const url = new URL(pathname, localEnv.S3_ENDPOINT);
  const date = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const day = date.slice(0, 8);
  const payloadHash = hash(body);
  const headers = { host: url.host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': date };
  const signedHeaders = Object.keys(headers).join(';');
  const canonicalHeaders = Object.entries(headers).map(([key, value]) => `${key}:${value}\n`).join('');
  const canonical = [method, url.pathname, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const scope = `${day}/${localEnv.S3_REGION}/s3/aws4_request`;
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${localEnv.S3_SECRET_ACCESS_KEY}`, day), localEnv.S3_REGION), 's3'), 'aws4_request');
  const signature = createHmac('sha256', signingKey).update(`AWS4-HMAC-SHA256\n${date}\n${scope}\n${hash(canonical)}`).digest('hex');
  return fetch(url, {
    method,
    headers: { ...headers, authorization: `AWS4-HMAC-SHA256 Credential=${localEnv.S3_ACCESS_KEY_ID}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}` },
    ...(method === 'HEAD' || method === 'GET' ? {} : { body }),
    signal: AbortSignal.timeout(10000),
  });
}

async function verifyS3() {
  const health = await fetch(new URL('/minio/health/ready', localEnv.S3_ENDPOINT), { signal: AbortSignal.timeout(10000) });
  if (!health.ok) throw new Error(`MinIO health returned ${health.status}.`);
  const bucketPath = `/${localEnv.S3_BUCKET}`;
  const bucket = await s3('HEAD', bucketPath);
  if (bucket.status === 404) {
    const created = await s3('PUT', bucketPath);
    if (!created.ok) throw new Error(`S3 bucket creation returned ${created.status}.`);
  } else if (!bucket.ok) throw new Error(`S3 bucket probe returned ${bucket.status}.`);
  const probePath = `${bucketPath}/infrastructure-check/${randomUUID()}.txt`;
  const content = 'Fouc infrastructure — signed S3 round trip.';
  const put = await s3('PUT', probePath, content);
  if (!put.ok) throw new Error(`S3 signed PUT returned ${put.status}.`);
  try {
    const get = await s3('GET', probePath);
    if (!get.ok || await get.text() !== content) throw new Error('S3 signed GET content did not match.');
  } finally {
    const removed = await s3('DELETE', probePath);
    if (!removed.ok) throw new Error(`S3 probe cleanup returned ${removed.status}.`);
  }
  console.log(`PASS S3: readiness, bucket access, signed PUT/GET/DELETE at ${localEnv.S3_ENDPOINT}.`);
}

async function verifyPostgres() {
  const pool = new Pool({ connectionString: localEnv.DATABASE_URL, max: 1, connectionTimeoutMillis: 5000 });
  pool.on('error', () => {});
  try {
    const { rows: [identity] } = await pool.query('SELECT current_database() AS database, current_user AS role, rolsuper, rolbypassrls FROM pg_roles WHERE rolname=current_user');
    if (identity?.database !== localEnv.FOUC_POSTGRES_DB || identity.role !== 'fouc_app' || identity.rolsuper || identity.rolbypassrls) throw new Error('Postgres runtime identity check failed.');
    console.log(`PASS Postgres: host SQL authenticated as ${identity.role}, NOSUPERUSER/NOBYPASSRLS.`);
  } catch {
    throw new Error('Postgres host authentication failed. Verify .env.fouc.local and the existing data volume credentials.');
  } finally {
    await pool.end();
  }
}

export async function ensureDevelopmentInfrastructure() {
  await init();
  await keepWslAlive();
  const endpointsChanged = windows ? syncEndpoints(await endpointHost()) : false;
  await ensureContainers();
  await initializeDatabase();
  await Promise.all([verifyPostgres(), verifyRedis(), verifyS3()]);
  return { endpointsChanged };
}

async function main() {
  const command = process.argv[2] ?? 'status';
  if (!['init', 'up', 'verify', 'status'].includes(command)) throw new Error('Usage: infra.mjs init|up|verify|status');
  if (command === 'init') return init();
  if (command === 'up') { await ensureDevelopmentInfrastructure(); return; }
  localEnv = loadLocalEnv();
  if (command === 'verify') {
    await Promise.all([verifyPostgres(), verifyRedis(), verifyS3()]);
    return;
  }
  const containers = await readContainers();
  for (const service of infrastructureServices()) {
    const container = findServiceContainer(containers, service, linuxPath(root));
    console.log(`${service.name}: ${container ? `${container.Name.slice(1)} ${container.State.Status} (${container.State.Health?.Status ?? 'no healthcheck'})` : 'not created'}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => {
  console.error(redact(error.message));
  if (error instanceof AggregateError) for (const cause of error.errors) console.error(redact(cause.message));
  process.exitCode = 1;
});
