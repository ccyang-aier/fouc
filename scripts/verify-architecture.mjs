import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packages = { frontend: '', device: 'backend/device/', server: 'backend/server/', shared: 'shared/' };
const manifest = Object.fromEntries(Object.entries(packages).map(([name, directory]) => [name, JSON.parse(readFileSync(path.join(root, directory, 'package.json'), 'utf8'))]));
const builtins = /^(node:|bun:)/;
function owner(file) {
  return Object.entries(packages).find(([name, prefix]) => name !== 'frontend' && file.startsWith(prefix))?.[0]
    ?? (file.startsWith('src/') ? 'frontend' : undefined);
}
function filesIn(directory) {
  return readdirSync(path.join(root, directory), { withFileTypes: true }).flatMap((entry) => {
    const file = path.posix.join(directory, entry.name);
    return entry.isDirectory() ? filesIn(file) : /\.(ts|tsx|mjs)$/.test(file) ? [file] : [];
  });
}

export function checkArchitectureImports(file, content) {
  const sourceOwner = owner(file);
  const testing = /(?:\.test\.|\/testing\/|test-fixture|test-server|test-provider|tenant-test-database|oauth-node-smoke)/.test(file);
  const source = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const errors = [];
  function check(specifier, typeOnly = false) {
    if (!specifier || !ts.isStringLiteralLike(specifier)) return;
    const target = specifier.text;
    const resolved = target.startsWith('.') ? path.posix.normalize(path.posix.join(path.posix.dirname(file), target)) : target;
    const fail = (reason) => errors.push(`${file}: ${target} — ${reason}`);
    const targetOwner = owner(resolved);
    if (target.startsWith('@shared/') || target.startsWith('@backend/')) fail('使用 workspace 包的公开导出，禁止源码别名');
    if (target.startsWith('.') && targetOwner && targetOwner !== sourceOwner) fail('禁止通过相对路径导入另一工程的内部代码');
    if (target.startsWith('.') && resolved.startsWith('qa/') && !testing) fail('测试夹具不能进入运行时代码');
    if (sourceOwner === 'frontend' && builtins.test(target) && !testing) fail('前端不得依赖后端运行时');
    if (sourceOwner === 'device' && /^(pg|drizzle-orm|better-auth|graphile-worker)(\/|$)/.test(target)) fail('设备运行时不得加载共享业务数据库与账户基础设施');
    if (sourceOwner === 'shared' && !testing && /^(node:|bun:|react(?:\/|$)|react-dom(?:\/|$)|next(?:\/|$)|@tauri-apps\/|pg$|mysql2|drizzle-orm|hono|better-auth|@fouc\/(device|server))/.test(target)) fail('共享代码必须可在各宿主使用，不得依赖具体 UI 或服务运行时');
    if (target.startsWith('@fouc/server') && !(sourceOwner === 'frontend' && target === '@fouc/server/knowledge-api' && typeOnly)) fail('业务服务只向前端公开类型契约，禁止运行时或跨后端导入');
    if (target.startsWith('@fouc/device')) fail('设备实现不向其他工程导出');
    if (target.startsWith('@fouc/shared')) {
      const subpath = target === '@fouc/shared' ? '.' : './' + target.slice('@fouc/shared/'.length);
      if (subpath.includes('..') || !Object.keys(manifest.shared.exports).some((key) => key === subpath || (key.endsWith('*') && subpath.startsWith(key.slice(0, -1))))) fail('共享包子路径必须有明确公开导出');
    }
    if (!target.startsWith('.') && !builtins.test(target) && !target.startsWith('@/')) {
      const name = target.startsWith('@') ? target.split('/').slice(0, 2).join('/') : target.split('/')[0];
      const declared = { ...manifest[sourceOwner]?.dependencies, ...manifest[sourceOwner]?.devDependencies };
      const typesPackage = name.startsWith('@') ? '@types/' + name.slice(1).replace('/', '__') : '@types/' + name;
      if (sourceOwner && !declared[name] && !(typeOnly && declared[typesPackage])) fail(`依赖 ${name} 未在所属工程声明`);
      if (!testing && !typeOnly && sourceOwner !== 'frontend' && manifest[sourceOwner]?.devDependencies?.[name] && !file.includes('/scripts/')) fail('运行时依赖不能只声明为开发依赖');
    }
  }
  function visit(node) {
    if (ts.isImportDeclaration(node)) {
      const bindings = node.importClause?.namedBindings;
      check(node.moduleSpecifier, !!node.importClause?.isTypeOnly || (!node.importClause?.name && bindings && ts.isNamedImports(bindings) && bindings.elements.every((item) => item.isTypeOnly)));
    }
    if (ts.isExportDeclaration(node)) check(node.moduleSpecifier, node.isTypeOnly);
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) check(node.argument.literal, true);
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) check(node.arguments[0]);
    ts.forEachChild(node, visit);
  }
  visit(source);
  return errors;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (existsSync(path.join(root, 'backend/package.json')) || existsSync(path.join(root, 'backend/src'))) throw new Error('backend/ 只能是组织目录，禁止恢复混合运行包。');
  const files = ['src', 'shared/src', 'backend/device/src', 'backend/device/scripts', 'backend/server/src', 'backend/server/scripts'].flatMap(filesIn);
  const errors = files.flatMap((file) => checkArchitectureImports(file, readFileSync(path.join(root, file), 'utf8')));
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(`Architecture boundaries: ${files.length} files checked; independent device/server packages and public contract imports verified.`);
}
