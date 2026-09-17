import { describe, expect, test } from 'bun:test';
import { openDatabase } from '../store/db';
import { ConnectorRepository } from './repository';
import { ConnectorService } from './service';

describe('connector lifecycle', () => {
  test('keeps login single-flight and restores transient state after restart', () => {
    const db = openDatabase(':memory:');
    try {
      const repository = new ConnectorRepository(db);
      const service = new ConnectorService(repository);
      const first = service.beginConnect('dts-personal');
      const second = service.beginConnect('dts-personal');
      expect(second.interactionId).toBe(first.interactionId);
      expect(repository.byId('dts-personal')?.authState).toBe('connecting');

      const restarted = new ConnectorService(repository);
      expect(restarted.detail('dts-personal').instance.authState).toBe('needs_user_action');
    } finally {
      db.close();
    }
  });

  test('records an actionable reason when a native login window is cancelled', () => {
    const db = openDatabase(':memory:');
    try {
      const repository = new ConnectorRepository(db);
      const service = new ConnectorService(repository);
      const interaction = service.beginConnect('dts-personal');
      service.cancelConnect(interaction.interactionId, 'page_load_timeout', 'DTS 登录页加载超时');

      const instance = repository.byId('dts-personal');
      expect(instance?.authState).toBe('needs_user_action');
      expect(instance?.healthState).toBe('unknown');
      expect(instance?.lastErrorCode).toBe('page_load_timeout');
      expect(instance?.lastErrorMessage).toBe('DTS 登录页加载超时');
    } finally {
      db.close();
    }
  });
});
