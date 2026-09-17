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
});
