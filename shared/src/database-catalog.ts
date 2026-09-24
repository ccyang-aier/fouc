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
  if (typeof value !== "string" || !value.trim() || seen.has(value)) throw new Error(`数据库目录中存在无效或重复的${label}：${value}`)
  seen.add(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function isString(value: unknown): value is string { return typeof value === "string" && !!value.trim() }

function isPort(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 65_535
}

/** Validates the copied DBX catalog before any declared capability is exposed. */
export function assertDatabaseCatalog(value: unknown): asserts value is CatalogSource {
  if (!isRecord(value)) throw new Error("数据库目录无效")
  const catalog = value as Record<string, unknown>
  if (catalog.catalogSchemaVersion !== 1 || !isString(catalog.sourceRevision)
    || !Array.isArray(catalog.drivers) || !Array.isArray(catalog.profiles) || !Array.isArray(catalog.dialects)) {
    throw new Error("数据库目录版本或结构无效")
  }

  const driverIds = new Set<string>()
  const dialectNames = new Set<string>()
  const dialectIds = new Set<string>()
  const profileIds = new Set<string>()
  const capabilityKeys = new Set<string>(DATABASE_CAPABILITIES)

  for (const item of catalog.dialects as DatabaseDialectDescriptor[]) {
    if (!isRecord(item) || !isRecord(item.dialect) || !Array.isArray(item.types)) throw new Error("SQL 方言结构无效")
    requireUnique(item.id, dialectIds, "SQL 方言 ID")
    requireUnique(item.dialect?.name, dialectNames, "SQL 方言")
  }
  for (const item of catalog.drivers as DatabaseDriverDescriptor[]) {
    if (!isRecord(item) || !isString(item.label)
      || !["native", "file", "agent", "external"].includes(item.runtimeMode)
      || !["direct", "bridge", "unsupported"].includes(item.mcpMode)
      || !["connect", "browse", "understand", "operate"].includes(item.supportLevel)
      || (item.dialect != null && !isString(item.dialect))
      || (item.defaultPort != null && !isPort(item.defaultPort))
      || [item.singleConnectionPool, item.metadataConnectionScoped, item.skipTcpProbe].some((flag) => typeof flag !== "boolean")
      || (item.traits != null && (!isRecord(item.traits)
        || Object.values(item.traits).some((trait) => !["boolean", "number", "string"].includes(typeof trait))))) {
      throw new Error("驱动声明结构无效")
    }
    requireUnique(item.dbType, driverIds, "驱动")
    if (item.dialect && !dialectNames.has(item.dialect)) throw new Error(`驱动 ${item.dbType} 的 SQL 方言缺失`)
    if (!isRecord(item.capabilities)
      || Object.keys(item.capabilities).length !== capabilityKeys.size
      || Object.entries(item.capabilities).some(([key, enabled]) => !capabilityKeys.has(key) || typeof enabled !== "boolean")) {
      throw new Error(`驱动 ${item.dbType} 的能力声明无效`)
    }
  }
  for (const item of catalog.profiles as DatabaseConnectionProfile[]) {
    if (!isRecord(item) || !isString(item.label) || !isString(item.icon)
      || !isPort(item.port) || typeof item.user !== "string"
      || (item.category != null && typeof item.category !== "string")
      || (item.host != null && typeof item.host !== "string")
      || (item.urlParams != null && typeof item.urlParams !== "string")
      || (item.pickerLabel != null && typeof item.pickerLabel !== "string")
      || (item.pickerIcon != null && typeof item.pickerIcon !== "string")) {
      throw new Error("连接 Profile 结构无效")
    }
    requireUnique(item.id, profileIds, "连接 Profile")
    if (!driverIds.has(item.dbType)) throw new Error(`Profile ${item.id} 的驱动缺失`)
  }
}

assertDatabaseCatalog(source)

function freezeCatalogEntry<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) freezeCatalogEntry(child)
    Object.freeze(value)
  }
  return value
}

const drivers = new Map(source.drivers.map((item) => [item.dbType, freezeCatalogEntry({
  ...item,
  dialect: item.dialect ?? null,
  defaultPort: item.defaultPort ?? null,
  traits: item.traits ?? {},
} as DatabaseDriverDescriptor)]))
const profiles = new Map(source.profiles.map((item) => [item.id, freezeCatalogEntry({
  ...item,
  category: item.category ?? null,
} as DatabaseConnectionProfile)]))
const dialects = new Map(source.dialects.map((item) => [item.dialect.name, freezeCatalogEntry(item as DatabaseDialectDescriptor)]))

export const DATABASE_CATALOG_REVISION = source.sourceRevision
export function getDatabaseDriver(dbType: string): DatabaseDriverDescriptor | null { return drivers.get(dbType) ?? null }
export function getDatabaseProfile(id: string): DatabaseConnectionProfile | null { return profiles.get(id) ?? null }
export function getDatabaseDialect(name: string): DatabaseDialectDescriptor | null { return dialects.get(name) ?? null }
export function listDatabaseDrivers(): DatabaseDriverDescriptor[] { return [...drivers.values()] }
export function listDatabaseProfiles(): DatabaseConnectionProfile[] { return [...profiles.values()] }
