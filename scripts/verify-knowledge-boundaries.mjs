import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sharedRoot = 'shared/src/knowledge/';
const backendRoot = 'backend/src/knowledge/';
const backendApiRoot = 'backend/src/api/knowledge/';
const backendRoots = [backendRoot, backendApiRoot, 'backend/src/identity/', 'backend/src/runtime/'];
const frontendRoot = 'src/features/knowledge/';
const frontendRoots = [frontendRoot, 'src/features/identity/'];
const gatewayRoot = `${backendRoot}ai/gateway/`;
const aiHelpers = new Set(['tool', 'jsonSchema', 'zodSchema', 'modelMessageSchema']);

function filesIn(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? filesIn(file) : /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file) ? [file] : [];
  });
}

export function checkKnowledgeImports(relativeFile, content) {
  const errors = [];
  const source = ts.createSourceFile(relativeFile, content, ts.ScriptTarget.Latest, true, relativeFile.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  function check(specifier, typeOnly = false, helperOnly = false) {
    if (!specifier || !ts.isStringLiteralLike(specifier)) return;
    const target = specifier.text;
    const resolved = target.startsWith('.') ? path.posix.normalize(path.posix.join(path.posix.dirname(relativeFile), target)) : target;
    const fail = (reason) => errors.push(`${relativeFile}: ${target} — ${reason}`);
    if (relativeFile.startsWith(sharedRoot)) {
      if (/^(node:|bun:|react(?:\/|$)|react-dom(?:\/|$)|next(?:\/|$)|hono(?:\/|$)|pg$|drizzle-orm(?:\/|$)|better-auth(?:\/|$)|graphile-worker$|@hocuspocus\/server|@aws-sdk\/)/.test(target) || /^(backend\/|src\/|@\/|@backend\/)/.test(resolved)) fail('共享领域不得依赖 UI、后端或平台运行时');
    }
    if (backendRoots.some((root) => relativeFile.startsWith(root)) && (/^src\//.test(resolved) || /^(@\/|react(?:\/|$)|react-dom(?:\/|$)|next(?:\/|$))/.test(target))) fail('后端不得依赖前端');
    if (backendRoots.some((root) => relativeFile.startsWith(root)) && !relativeFile.startsWith(gatewayRoot) && !typeOnly
      && (/^@ai-sdk\//.test(target) || (target === 'ai' && !helperOnly))) fail('模型调用与 Provider 只能位于统一 AI 网关；工具 schema 帮助函数和类型除外');
    if (frontendRoots.some((root) => relativeFile.startsWith(root)) && !typeOnly && (/^backend\//.test(resolved) || /^(@backend\/|bun:|node:)/.test(target))) fail('前端不得导入服务端运行时代码');
  }
  function visit(node) {
    if (ts.isImportDeclaration(node)) {
      const bindings = node.importClause?.namedBindings;
      const helperOnly = !node.importClause?.name && bindings && ts.isNamedImports(bindings)
        && bindings.elements.every((item) => item.isTypeOnly || aiHelpers.has((item.propertyName ?? item.name).text));
      check(node.moduleSpecifier, !!node.importClause?.isTypeOnly, !!helperOnly);
    }
    if (ts.isExportDeclaration(node)) {
      const bindings = node.exportClause;
      const helperOnly = bindings && ts.isNamedExports(bindings)
        && bindings.elements.every((item) => item.isTypeOnly || aiHelpers.has((item.propertyName ?? item.name).text));
      check(node.moduleSpecifier, node.isTypeOnly, !!helperOnly);
    }
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) check(node.arguments[0]);
    ts.forEachChild(node, visit);
  }
  visit(source);
  return errors;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const files = [sharedRoot, ...backendRoots, ...frontendRoots].flatMap((directory) => filesIn(path.join(root, directory)));
  const errors = files.flatMap((file) => checkKnowledgeImports(path.relative(root, file).replaceAll('\\', '/'), readFileSync(file, 'utf8')));
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(`Knowledge boundaries: ${files.length} source files checked; no inverted runtime dependencies.`);
}
