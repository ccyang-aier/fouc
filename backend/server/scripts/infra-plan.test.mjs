import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findServiceContainer, selectSubnet } from './infra-plan.mjs';

const root = '/mnt/c/AIWorks/26Coding/fouc';
const postgres = { name: 'postgres', port: 55432, containerPort: '5432/tcp' };
const fixture = (overrides = {}) => ({
  Id: 'existing-data', Name: '/fouc-existing-postgres',
  Config: { Labels: { 'com.docker.compose.service': 'postgres', 'com.docker.compose.project.working_dir': root } },
  HostConfig: { PortBindings: { '5432/tcp': [{ HostPort: '55432' }] } },
  State: { Running: false },
  ...overrides,
});

test('a stopped container from this checkout is reused without depending on its project name or replacing its data', () => {
  const container = fixture();
  assert.equal(findServiceContainer([container], postgres, root), container);
  assert.equal(findServiceContainer([container], postgres, root.toUpperCase() + '/'), container);
});

test('a different checkout cannot be reused or silently displaced on the configured port', () => {
  const other = fixture({ Id: 'other', Name: '/other-postgres', Config: { Labels: {
    'com.docker.compose.service': 'postgres', 'com.docker.compose.project.working_dir': root + '-other',
  } } });
  assert.equal(findServiceContainer([other], postgres, root), undefined);
  assert.throws(() => findServiceContainer([{ ...other, State: { Running: true } }], postgres, root), /another container/);
});

test('ambiguous containers fail instead of choosing a different data volume', () => {
  assert.throws(() => findServiceContainer([fixture(), fixture({ Id: 'another-volume' })], postgres, root), /multiple containers/);
});

test('occupied Docker subnets and the WSL interface cannot overlap the selected subnet', () => {
  assert.equal(selectSubnet(['192.168.240.0/24', '192.168.241.0/24', '192.168.242.0/24', '172.17.144.0/20']), '192.168.243.0/24');
  assert.equal(selectSubnet(['192.168.240.1/32']), '192.168.241.0/24');
  assert.equal(selectSubnet(['192.168.240.0/20']), '192.168.0.0/24');
  assert.equal(selectSubnet(['192.168.0.0/16'], '10.240.0.0/24'), '10.240.0.0/24');
});

test('reallocation avoids an occupied preference; invalid or exhausted subnets fail clearly', () => {
  assert.equal(selectSubnet(['10.240.0.0/16'], '10.240.7.0/24'), '192.168.240.0/24');
  assert.throws(() => selectSubnet([], '192.168.999.0/24'), /Invalid IPv4/);
  assert.throws(() => selectSubnet(['192.168.0.0/16']), /No free development subnet/);
});
