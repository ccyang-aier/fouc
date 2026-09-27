import { describe, expect, test } from 'bun:test';
import catalog from '@fouc/shared/catalog/dbx-catalog.json';
import {
  assertDatabaseCatalog, getDatabaseDialect, getDatabaseDriver,
  getDatabaseProfile, listDatabaseDrivers, listDatabaseProfiles,
} from '@fouc/shared/database-catalog';

describe('copied DBX database catalog', () => {
  test('maps every Profile to a driver and every declared SQL dialect to a descriptor', () => {
    expect(listDatabaseDrivers()).toHaveLength(81);
    expect(listDatabaseProfiles()).toHaveLength(104);
    expect(getDatabaseProfile('mysql')?.dbType).toBe('mysql');
    expect(getDatabaseDriver('mysql')?.dialect).toBe('MySQL');
    expect(getDatabaseDialect('MySQL')?.id).toBe('mysql');
    expect(getDatabaseDriver('mongodb')?.dialect).toBeNull();
    expect(getDatabaseDriver('unknown')).toBeNull();
  });

  test('fails closed on a missing driver, dialect or capability declaration', () => {
    const missingDriver = structuredClone(catalog);
    missingDriver.profiles[0]!.dbType = 'unavailable';
    expect(() => assertDatabaseCatalog(missingDriver)).toThrow('驱动缺失');

    const missingDialect = structuredClone(catalog);
    missingDialect.drivers[0]!.dialect = 'unavailable';
    expect(() => assertDatabaseCatalog(missingDialect)).toThrow('SQL 方言缺失');

    const missingCapability = structuredClone(catalog);
    delete (missingCapability.drivers[0]!.capabilities as Record<string, boolean>).queryExecution;
    expect(() => assertDatabaseCatalog(missingCapability)).toThrow('能力声明无效');

    const unknownCapability = structuredClone(catalog);
    (unknownCapability.drivers[0]!.capabilities as Record<string, boolean>).unverifiedFeature = true;
    expect(() => assertDatabaseCatalog(unknownCapability)).toThrow('能力声明无效');

    const invalidProfile = structuredClone(catalog);
    invalidProfile.profiles[0]!.port = -1;
    expect(() => assertDatabaseCatalog(invalidProfile)).toThrow('Profile 结构无效');

    const duplicateDialect = structuredClone(catalog);
    duplicateDialect.dialects[1]!.id = duplicateDialect.dialects[0]!.id;
    expect(() => assertDatabaseCatalog(duplicateDialect)).toThrow('SQL 方言 ID');
  });

  test('does not permit callers to mutate catalog capability declarations', () => {
    const driver = getDatabaseDriver('mysql')!;
    expect(Object.isFrozen(driver)).toBe(true);
    expect(Object.isFrozen(driver.capabilities)).toBe(true);
    expect(Object.isFrozen(getDatabaseDialect('MySQL')?.types)).toBe(true);
  });
});
