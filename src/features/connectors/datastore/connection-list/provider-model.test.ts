import { expect, test } from 'bun:test'
import { defaultConnectionOptions } from '@fouc/shared/connection-options'
import { connectionListRow, directoryProviders, type SavedDatastoreConnection } from './provider-model'

const metadata = { id: 'connection', workspaceId: 'workspace', name: 'Test', updatedAt: 1 }
const row = (config: SavedDatastoreConnection['config']) => connectionListRow({ ...metadata, config } as SavedDatastoreConnection, false)

test('SQLite preserves the complete file target and exposes no invented database account', () => {
  const item = row({ provider: 'sqlite', path: 'C:\\data\\local.sqlite' })
  expect(item.target).toBe('local.sqlite')
  expect(item.targetTitle).toBe('C:\\data\\local.sqlite')
  expect(item.account).toBeUndefined()
  expect(directoryProviders.sqlite.accountLabel).toBeUndefined()
})

test('network account columns describe the configured native user, including Redis default', () => {
  for (const provider of ['mysql', 'postgres'] as const) {
    const item = row({ provider, host: 'localhost', port: 1234, username: 'reader', database: 'app', connectionOptions: defaultConnectionOptions(provider) })
    expect(item.account).toBe('reader')
    expect(directoryProviders[provider].accountLabel).toBe('登录账户')
  }
  expect(row({ provider: 'redis', host: 'localhost', port: 6379, username: '', database: 0, connectionOptions: defaultConnectionOptions('redis') }).account).toBe('default')
  expect(row({ provider: 'redis', host: 'localhost', port: 6379, username: 'cache-reader', database: 0, connectionOptions: defaultConnectionOptions('redis') }).account).toBe('cache-reader')
})

test('MongoDB keeps the authentication database distinct from the target database', () => {
  const item = row({ provider: 'mongodb', host: 'localhost', port: 27017, username: 'operator', database: 'app', authSource: 'admin', connectionOptions: defaultConnectionOptions('mongodb') })
  expect(item.target).toBe('localhost:27017 / app')
  expect(item.account).toBe('operator')
  expect(item.authSource).toBe('admin')
  expect(directoryProviders.mongodb.authSourceLabel).toBe('认证库')
})
