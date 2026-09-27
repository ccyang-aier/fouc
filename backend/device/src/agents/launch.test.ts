import { describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import type { AgentInstallation } from '@fouc/shared';
import { PROVIDER_CATALOG } from './catalog';
import { buildLaunchSpec } from './launch';

const installation = { executablePath: 'C:/agent/claude.exe' } as AgentInstallation;

describe('device package Agent bridge resolution', () => {
  test('Claude resolves the declared workspace artifact and retains its executable environment', async () => {
    const provider = PROVIDER_CATALOG.find((item) => item.id === 'claude-code')!;
    const launch = await buildLaunchSpec(provider, installation, process.cwd());
    expect(launch.command).toBe('bun');
    expect(launch.args[0]).toBe('run');
    expect(existsSync(launch.args[1])).toBe(true);
    expect(launch.env).toEqual({ CLAUDE_CODE_EXECUTABLE: installation.executablePath });
  });

  test.skipIf(process.platform !== 'win32')('Codex resolves its native binary without launching a run', async () => {
    const provider = PROVIDER_CATALOG.find((item) => item.id === 'codex')!;
    const launch = await buildLaunchSpec(provider, installation, process.cwd());
    expect(launch.command.endsWith('codex-acp.exe')).toBe(true);
    expect(existsSync(launch.command)).toBe(true);
    expect(launch.args).toEqual([]);
  });

  test('missing artifacts retain the existing explicit failure', async () => {
    const provider = structuredClone(PROVIDER_CATALOG.find((item) => item.id === 'claude-code')!);
    if (provider.acpLaunch.kind !== 'bridge') throw new Error('Expected bridge provider');
    provider.acpLaunch.devEntry = '@fouc/missing-bridge/artifact.js';
    await expect(buildLaunchSpec(provider, installation, process.cwd())).rejects.toThrow('bridge artifact missing in dev');
  });
});
