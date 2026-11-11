const normalize = (value) => value.replaceAll('\\', '/').replace(/\/$/, '').toLowerCase();

/** Reuse this checkout's service, independent of its Compose project name. */
export function findServiceContainer(containers, service, root) {
  const matches = containers.filter((container) => {
    const labels = container.Config.Labels ?? {};
    return labels['com.docker.compose.service'] === service.name
      && normalize(labels['com.docker.compose.project.working_dir'] ?? '') === normalize(root)
      && container.HostConfig.PortBindings?.[service.containerPort]?.some((binding) => Number(binding.HostPort) === service.port);
  });
  if (matches.length > 1) throw new Error(`${service.name}: multiple containers match this checkout and port ${service.port}.`);
  const match = matches[0];
  const occupied = containers.find((container) => container.State.Running && container.Id !== match?.Id
    && Object.values(container.HostConfig.PortBindings ?? {}).some((bindings) => bindings?.some((binding) => Number(binding.HostPort) === service.port)));
  if (occupied) throw new Error(`${service.name}: port ${service.port} belongs to another container (${occupied.Name}).`);
  return match;
}

function range(cidr) {
  const [address, prefix = '32'] = cidr.split('/');
  const bytes = address.split('.').map(Number);
  const bits = Number(prefix);
  if (bytes.length !== 4 || bytes.some((byte) => !Number.isInteger(byte) || byte < 0 || byte > 255)
    || !Number.isInteger(bits) || bits < 0 || bits > 32) throw new Error(`Invalid IPv4 subnet: ${cidr}`);
  const value = bytes.reduce((value, byte) => value * 256 + byte, 0);
  const size = 2 ** (32 - bits);
  const start = Math.floor(value / size) * size;
  return [start, start + size - 1];
}

export function selectSubnet(occupied, preferred) {
  const ranges = occupied.filter((cidr) => !cidr.includes(':')).map(range);
  const candidates = [...new Set([preferred, ...Array.from({ length: 256 }, (_, index) => `192.168.${(240 + index) % 256}.0/24`)].filter(Boolean))];
  for (const candidate of candidates) {
    const [start, end] = range(candidate);
    if (!ranges.some(([otherStart, otherEnd]) => start <= otherEnd && otherStart <= end)) return candidate;
  }
  throw new Error('No free development subnet; set FOUC_DEV_SUBNET to an unused IPv4 subnet.');
}
