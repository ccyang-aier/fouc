export type DataRow = Record<string, string | number>

export type ColumnDefinition = {
  key: string
  label: string
  type: string
  width: number
}

export type WorkbenchTab = {
  id: string
  kind: "table" | "sql"
  title: string
  table?: string
}

export const TABLE_NAMES = [
  "customers", "orders", "order_items", "products", "inventory", "shipments",
  "payments", "refunds", "audit_logs", "warehouses", "coupons", "addresses",
]

export const SCHEMAS = ["orders", "analytics", "mysql", "information_schema", "performance_schema", "sys"]

export const CUSTOMER_COLUMNS: ColumnDefinition[] = [
  { key: "id", label: "id", type: "int", width: 60 },
  { key: "name", label: "name", type: "varchar(50)", width: 94 },
  { key: "customer_type", label: "customer_type", type: "varchar(20)", width: 118 },
  { key: "city", label: "city", type: "varchar(50)", width: 103 },
  { key: "contact", label: "contact", type: "varchar(50)", width: 106 },
  { key: "phone", label: "phone", type: "varchar(20)", width: 125 },
  { key: "created_at", label: "created_at", type: "datetime", width: 178 },
  { key: "status", label: "status", type: "varchar(10)", width: 120 },
]

export const ORDER_COLUMNS: ColumnDefinition[] = [
  { key: "id", label: "id", type: "int", width: 70 },
  { key: "order_no", label: "order_no", type: "varchar(32)", width: 138 },
  { key: "customer_id", label: "customer_id", type: "int", width: 112 },
  { key: "total_amount", label: "total_amount", type: "decimal(12,2)", width: 130 },
  { key: "status", label: "status", type: "varchar(20)", width: 102 },
  { key: "created_at", label: "created_at", type: "datetime", width: 160 },
]

export const GENERIC_COLUMNS: ColumnDefinition[] = [
  { key: "id", label: "id", type: "int", width: 90 },
  { key: "name", label: "name", type: "varchar(64)", width: 180 },
  { key: "code", label: "code", type: "varchar(32)", width: 160 },
  { key: "status", label: "status", type: "varchar(20)", width: 140 },
  { key: "created_at", label: "created_at", type: "datetime", width: 180 },
]

const CUSTOMER_NAMES = ["张三", "李四", "王五", "赵六", "孙七", "周八", "吴九", "郑十", "刘一", "陈二", "杨三", "黄四", "何五", "罗六", "高七", "梁八", "宋九", "唐十", "韩一", "冯二"]
const CUSTOMER_CITIES = ["北京", "上海", "广州", "深圳", "杭州", "南京", "苏州", "成都", "武汉", "西安", "重庆", "天津", "长沙", "青岛", "宁波", "厦门", "福州", "合肥", "济南", "大连"]
const FIRST_CUSTOMER_TYPES = ["个人", "个人", "企业", "企业", "个人", "个人", "个人", "个人", "企业", "个人", "企业", "个人", "个人", "企业", "个人", "企业", "个人", "企业", "个人", "企业"]
const FIRST_CUSTOMER_PHONES = ["13800138000", "13900139000", "13600136000", "13700137000"]
const FIRST_CUSTOMER_TIMES = ["2024-12-01 10:23:11", "2024-12-02 14:18:32", "2024-12-03 09:45:21", "2024-12-04 16:22:08"]

export const INITIAL_CUSTOMERS: DataRow[] = Array.from({ length: 1245 }, (_, index) => {
  const local = index % CUSTOMER_NAMES.length
  return {
    id: 1001 + index,
    name: CUSTOMER_NAMES[local],
    customer_type: index < 20 ? FIRST_CUSTOMER_TYPES[index] : index % 3 === 2 || index % 7 === 0 ? "企业" : "个人",
    city: CUSTOMER_CITIES[local],
    contact: CUSTOMER_NAMES[local],
    phone: FIRST_CUSTOMER_PHONES[index] ?? String(13800138000 + index * 127),
    created_at: FIRST_CUSTOMER_TIMES[index] ?? `2024-12-${String(1 + index % 28).padStart(2, "0")} ${String(10 + index % 10).padStart(2, "0")}:23:11`,
    status: index % 19 === 12 ? "停用" : "正常",
  }
})

export const INITIAL_ORDERS: DataRow[] = Array.from({ length: 286 }, (_, index) => ({
  id: 10001 + index,
  order_no: `SO20260923${String(index + 1).padStart(4, "0")}`,
  customer_id: 1001 + index % 20,
  total_amount: Number((1280 + index * 93.6).toFixed(2)),
  status: ["待发货", "处理中", "已完成", "已取消"][index % 4],
  created_at: `2026-09-${String(1 + index % 23).padStart(2, "0")} 14:30:00`,
}))

export function getColumns(table: string): ColumnDefinition[] {
  if (table === "customers") return CUSTOMER_COLUMNS
  if (table === "orders") return ORDER_COLUMNS
  return GENERIC_COLUMNS
}

export function getInitialRows(table: string): DataRow[] {
  if (table === "customers") return INITIAL_CUSTOMERS
  if (table === "orders") return INITIAL_ORDERS
  return Array.from({ length: 85 }, (_, index) => ({
    id: index + 1,
    name: `${table}_${index + 1}`,
    code: `${table.slice(0, 3).toUpperCase()}-${String(index + 1).padStart(4, "0")}`,
    status: index % 9 === 0 ? "停用" : "正常",
    created_at: `2026-09-${String(1 + index % 23).padStart(2, "0")} 09:30:00`,
  }))
}

export const DEFAULT_SQL = `SELECT c.id, c.name, c.customer_type, c.city,
       c.contact, c.phone, c.created_at, c.status
FROM orders.customers AS c
WHERE c.status = '正常'
ORDER BY c.id ASC
LIMIT 1000;`
