import source from "../catalog/dbx-catalog.json"
import { DATABASE_CAPABILITIES, type DatabaseConnectionProfile, type DatabaseDriverDescriptor } from "./database"

export type DatabaseDialectDescriptor = {
  id: string
  dialect: { name: string; display_name?: string }
  [section: string]: unknown
}

type CatalogSource = {
  sourceRevision: string
  catalogSchemaVersion: number
  drivers: DatabaseDriverDescriptor[]
  profiles: DatabaseConnectionProfile[]
  dialects: DatabaseDialectDescriptor[]
}

function requireUnique(value: string, seen: Set<string>, label: string) {
  if (!value || seen.has(value)) throw new Error(`数据库目录中存在无效或重复的${label}：${value}`)
  seen.add(value)
}

/** Validates the copied DBX catalog before any declared capability is exposed. */
export function assertDatabaseCatalog(value: unknown): asserts value is CatalogSource {
  if (!value || typeof value !== "object") throw new Error("数据库目录无效")
  const catalog = value as Record<string, unknown>
  if (catalog.catalogSchemaVersion !== 1 || typeof catalog.sourceRevision !== "string"
    || !Array.isArray(catalog.drivers) || !Array.isArray(catalog.profiles) || !Array.isArray(catalog.dialects)) {
    throw new Error("数据库目录版本或结构无效")
  }

  const driverIds = new Set<string>()
  const dialectNames = new Set<string>()
  const profileIds = new Set<string>()
  const capabilityKeys = new Set<string>(DATABASE_CAPABILITIES)

  for (const item of catalog.dialects as DatabaseDialectDescriptor[]) {
    requireUnique(item.dialect?.name, dialectNames, "SQL 方言")
  }
  for (const item of catalog.drivers as DatabaseDriverDescriptor[]) {
    requireUnique(item.dbType, driverIds, "驱动")
    if (item.dialect && !dialectNames.has(item.dialect)) throw new Error(`驱动 ${item.dbType} 的 SQL 方言缺失`)
    if (!item.capabilities || typeof item.capabilities !== "object"
      || Object.keys(item.capabilities).length !== capabilityKeys.size
      || Object.entries(item.capabilities).some(([key, enabled]) => !capabilityKeys.has(key) || typeof enabled !== "boolean")) {
      throw new Error(`驱动 ${item.dbType} 的能力声明无效`)
    }
  }
  for (const item of catalog.profiles as DatabaseConnectionProfile[]) {
    requireUnique(item.id, profileIds, "连接 Profile")
    if (!driverIds.has(item.dbType)) throw new Error(`Profile ${item.id} 的驱动缺失`)
  }
}

assertDatabaseCatalog(source)

const drivers = new Map(source.drivers.map((item) => [item.dbType, {
  ...item,
  dialect: item.dialect ?? null,
  defaultPort: item.defaultPort ?? null,
  traits: item.traits ?? {},
} as DatabaseDriverDescriptor]))
const profiles = new Map(source.profiles.map((item) => [item.id, {
  ...item,
  category: item.category ?? null,
} as DatabaseConnectionProfile]))
const dialects = new Map(source.dialects.map((item) => [item.dialect.name, item as DatabaseDialectDescriptor]))

export const DATABASE_CATALOG_REVISION = source.sourceRevision
export function getDatabaseDriver(dbType: string): DatabaseDriverDescriptor | null { return drivers.get(dbType) ?? null }
export function getDatabaseProfile(id: string): DatabaseConnectionProfile | null { return profiles.get(id) ?? null }
export function getDatabaseDialect(name: string): DatabaseDialectDescriptor | null { return dialects.get(name) ?? null }
export function listDatabaseDrivers(): DatabaseDriverDescriptor[] { return [...drivers.values()] }
export function listDatabaseProfiles(): DatabaseConnectionProfile[] { return [...profiles.values()] }
