import { execFileSync } from 'node:child_process';
const name = 'fouc-datastore-lab-redis-json';
const image = 'redis:8.2.2';
const action = process.argv[2] ?? 'status';
if (!['up', 'status'].includes(action)) throw new Error('Usage: node scripts/redis-json-lab.mjs up|status');
const windows = process.platform === 'win32';
const distro = process.env.KNOWLEDGE_WSL_DISTRO ?? 'Ubuntu-22.04';
function docker(args) {
  return execFileSync(windows ? 'wsl.exe' : 'docker', windows ? ['-d', distro, '--exec', 'docker', ...args] : args, {
    windowsHide: true, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
}
function inspect() {
  try { return JSON.parse(docker(['inspect', name]))[0]; }
  catch (error) {
    if (/no such object/i.test(String(error.stderr))) return null;
    throw error;
  }
}
let container = inspect();
if (action === 'up') {
  if (!container) {
    docker(['run', '-d', '--name', name, '-p', '56381:6379', '--health-cmd', 'redis-cli -e JSON.GET fouc:dbx-json-lab:health',
      '--health-interval', '5s', '--health-timeout', '2s', '--health-retries', '3', image]);
    container = inspect();
  }
  if (container.Config.Image !== image || container.HostConfig.PortBindings['6379/tcp']?.[0]?.HostPort !== '56381')
    throw new Error('Existing JSON lab has unexpected image or port; inspect it before using this verifier.');
  if (!container.State.Running) docker(['start', name]);
  for (let attempt = 0; attempt < 30; attempt++) {
    container = inspect();
    if (container.State.Health?.Status === 'healthy') break;
    if (!container.State.Running || container.State.Health?.Status === 'unhealthy') throw new Error('Redis JSON lab is not healthy');
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  if (container.State.Health?.Status !== 'healthy') throw new Error('Timed out waiting for Redis JSON lab');
}
console.log(container ? `${name}: ${container.State.Status}, ${container.State.Health?.Status ?? 'health unknown'}, port 56381` : `${name}: not created; run up to start the dedicated lab.`);
