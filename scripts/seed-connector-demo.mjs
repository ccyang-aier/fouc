import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directory = path.join(root, '.runtime', 'connector-demo');
const credentialFile = path.join(directory, 'mysql-connection.json');
const sqlitePath = path.join(directory, 'commerce.sqlite');
const mysql = createRequire(new URL('../backend/device/package.json', import.meta.url))('mysql2');
const base = 'http://127.0.0.1:8710/api/database/relational';

// Explicit local fixtures: connection profiles use the device API, never the business database.
execFileSync('git', ['check-ignore', '.runtime/connector-demo/mysql-connection.json'], { cwd: root, stdio: 'pipe' });
execFileSync(process.execPath, [path.join(root, 'scripts/datastore-lab.mjs'), 'up'], { cwd: root, stdio: 'inherit', windowsHide: true });
mkdirSync(directory, { recursive: true });
const lab = JSON.parse(readFileSync(path.join(root, '.runtime/dbx-lab/mysql-connection.json'), 'utf8'));
const password = existsSync(credentialFile)
  ? JSON.parse(readFileSync(credentialFile, 'utf8')).password
  : randomBytes(32).toString('hex');
if (!/^[a-f0-9]{64}$/.test(password)) throw new Error('Demo credential has an unexpected format.');
const mysqlConfig = { provider: 'mysql', host: lab.host, port: lab.port, username: 'fouc_demo', database: 'fouc_connector_demo' };
writeFileSync(credentialFile, JSON.stringify({ ...mysqlConfig, password }, null, 2), { mode: 0o600 });

const schema = [
  `CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY, name VARCHAR(120) NOT NULL, email VARCHAR(160) NOT NULL UNIQUE,
    city VARCHAR(40) NOT NULL, tier VARCHAR(30) NOT NULL, created_at DATETIME NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY, sku VARCHAR(40) NOT NULL UNIQUE, name VARCHAR(120) NOT NULL,
    category VARCHAR(40) NOT NULL, price DECIMAL(10,2) NOT NULL, stock INTEGER NOT NULL,
    active INTEGER NOT NULL DEFAULT 1
  )`,
  `CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY, order_no VARCHAR(40) NOT NULL UNIQUE, customer_id INTEGER NOT NULL,
    status VARCHAR(30) NOT NULL, total_amount DECIMAL(10,2) NOT NULL, created_at DATETIME NOT NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  )`,
  `CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY, order_id INTEGER NOT NULL, product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL, unit_price DECIMAL(10,2) NOT NULL,
    subtotal DECIMAL(10,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
    FOREIGN KEY (order_id) REFERENCES orders(id), FOREIGN KEY (product_id) REFERENCES products(id)
  )`,
];
const customers = ['青禾工作室', '云杉科技', '海岸创意', '北辰设计', '拾光教育', '蓝鲸数据'].map((name, index) =>
  [index + 1, name, `customer${index + 1}@example.test`, ['杭州', '北京', '深圳', '上海', '成都', '武汉'][index], index % 2 ? '标准客户' : '重点客户', '2026-09-01 09:00:00']);
const products = [
  [1, 'DESK-001', '桌面收纳套装', '桌面办公', '179.00', 86, 1],
  [2, 'NOTE-002', '灵感记录本', '文具', '59.00', 240, 1],
  [3, 'LAMP-003', '阅读台灯', '桌面办公', '299.00', 42, 1],
  [4, 'CUP-004', '随行保温杯', '生活用品', '129.00', 118, 1],
  [5, 'BAG-005', '城市通勤包', '生活用品', '399.00', 35, 1],
  [6, 'PAD-006', '皮革桌垫', '桌面办公', '149.00', 67, 1],
  [7, 'PEN-007', '签字笔礼盒', '文具', '89.00', 156, 1],
  [8, 'STAND-008', '笔记本支架', '桌面办公', '229.00', 0, 0],
];
const orders = [], items = [];
for (let index = 0; index < 18; index++) {
  const id = index + 1;
  let total = 0;
  for (let line = 0; line < 2; line++) {
    const product = products[(index + line * 3) % products.length];
    const quantity = 1 + (index + line) % 3;
    const cents = Math.round(Number(product[4]) * 100);
    total += quantity * cents;
    items.push([items.length + 1, id, product[0], quantity, product[4]]);
  }
  const date = new Date(Date.UTC(2026, 8, 21 + index, 9, 30)).toISOString().slice(0, 19).replace('T', ' ');
  orders.push([id, `FOUC-2026-${String(id).padStart(4, '0')}`, 1 + index % customers.length,
    ['已完成', '已发货', '待发货', '待付款'][index % 4], (total / 100).toFixed(2), date]);
}
const tables = [
  ['customers', ['id', 'name', 'email', 'city', 'tier', 'created_at'], customers],
  ['products', ['id', 'sku', 'name', 'category', 'price', 'stock', 'active'], products],
  ['orders', ['id', 'order_no', 'customer_id', 'status', 'total_amount', 'created_at'], orders],
  ['order_items', ['id', 'order_id', 'product_id', 'quantity', 'unit_price'], items],
];
const overview = `SELECT o.id, o.order_no, c.name AS customer_name, c.city,
  o.status, o.total_amount, o.created_at FROM orders o JOIN customers c ON c.id = o.customer_id`;

const sqlite = new DatabaseSync(sqlitePath);
try {
  sqlite.exec('PRAGMA foreign_keys=ON; BEGIN');
  for (const statement of schema) sqlite.exec(statement);
  for (const [table, columns, rows] of tables) {
    const insert = sqlite.prepare(`INSERT OR IGNORE INTO ${table} (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`);
    for (const row of rows) insert.run(...row);
  }
  sqlite.exec(`CREATE VIEW IF NOT EXISTS order_overview AS ${overview}; COMMIT`);
} finally { sqlite.close(); }

const mysqlStatements = [
  'CREATE DATABASE IF NOT EXISTS fouc_connector_demo CHARACTER SET utf8mb4',
  `CREATE USER IF NOT EXISTS 'fouc_demo'@'%' IDENTIFIED BY '${password}'`,
  "GRANT SELECT, SHOW VIEW ON fouc_connector_demo.* TO 'fouc_demo'@'%'",
  'USE fouc_connector_demo', ...schema,
  ...tables.map(([table, columns, rows]) => `INSERT IGNORE INTO ${table} (${columns.join(',')}) VALUES ${rows.map(row => `(${row.map(value => mysql.escape(value)).join(',')})`).join(',')}`),
  `CREATE OR REPLACE VIEW order_overview AS ${overview}`,
];
const dockerArgs = ['exec', '-i', 'fouc-datastore-lab-mysql-1', '/bin/sh', '-ec', 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot --default-character-set=utf8mb4'];
try {
  execFileSync(process.platform === 'win32' ? 'wsl.exe' : 'docker', process.platform === 'win32'
    ? ['-d', process.env.KNOWLEDGE_WSL_DISTRO ?? 'Ubuntu-22.04', '--exec', 'docker', ...dockerArgs] : dockerArgs,
  { input: mysqlStatements.join(';\n') + ';\n', encoding: 'utf8', windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
} catch { throw new Error('Could not initialize the dedicated MySQL demo database.'); }

async function request(route, body, method = body ? 'POST' : 'GET') {
  const response = await fetch(base + route, { method, headers: { 'content-type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30000) });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(`${route}: ${result.error?.message ?? response.status}`);
  return result.data;
}
const existing = await request('/connections');
for (const config of [{ provider: 'sqlite', path: sqlitePath }, mysqlConfig]) {
  const name = `${config.provider === 'sqlite' ? 'SQLite' : 'MySQL'} · 电商运营示例`;
  const previous = existing.find(connection => connection.name === name && connection.config.provider === config.provider);
  const saved = await request(`/connections${previous ? `/${previous.id}` : ''}`, {
    name, config, directory: { favorite: true, tags: ['示例', '电商运营'] },
  }, previous ? 'PUT' : 'POST');
  const session = await request(`/connections/${saved.id}/connect`, { password: config.provider === 'mysql' ? password : '' });
  try {
    const schemaName = config.provider === 'sqlite' ? 'main' : config.database;
    const result = await request(`/sessions/${session.id}/query`, { schema: schemaName, sql: 'SELECT COUNT(*) AS order_count FROM order_overview', maxRows: 1 });
    if (Number(result.rows[0][0]) !== orders.length) throw new Error(`${config.provider}: demo order count mismatch.`);
    console.log(`${name}: configured and tested; 4 tables, 1 view, ${orders.length} orders.`);
  } finally { await request(`/sessions/${session.id}`, null, 'DELETE'); }
}
console.log('MySQL demo credentials are available only in .runtime/connector-demo/mysql-connection.json.');
