import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sharedRoot = 'shared/src/knowledge/';
const backendRoot = 'backend/src/knowledge/';
const frontendRoot = 'src/features/knowledge/';

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
  function check(specifier, typeOnly = false) {
    if (!specifier || !ts.isStringLiteralLike(specifier)) return;
    const target = specifier.text;
    const resolved = target.startsWith('.') ? path.posix.normalize(path.posix.join(path.posix.dirname(relativeFile), target)) : target;
    const fail = (reason) => errors.push(`${relativeFile}: ${target} — ${reason}`);
    if (relativeFile.startsWith(sharedRoot)) {
      if (/^(node:|bun:|react(?:\/|$)|react-dom(?:\/|$)|next(?:\/|$)|hono(?:\/|$)|pg$|drizzle-orm(?:\/|$)|better-auth(?:\/|$)|graphile-worker$|@hocuspocus\/server|@aws-sdk\/)/.test(target) || /^(backend\/|src\/|@\/|@backend\/)/.test(resolved)) fail('共享领域不得依赖 UI、后端或平台运行时');
    }
    if (relativeFile.startsWith(backendRoot) && (/^src\//.test(resolved) || /^(@\/|react(?:\/|$)|react-dom(?:\/|$)|next(?:\/|$))/.test(target))) fail('后端不得依赖前端');
    if (relativeFile.startsWith(frontendRoot) && !typeOnly && (/^backend\//.test(resolved) || /^(@backend\/|bun:|node:)/.test(target))) fail('前端不得导入服务端运行时代码');
  }
  function visit(node) {
    if (ts.isImportDeclaration(node)) check(node.moduleSpecifier, !!node.importClause?.isTypeOnly);
    if (ts.isExportDeclaration(node)) check(node.moduleSpecifier, node.isTypeOnly);
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) check(node.arguments[0]);
    ts.forEachChild(node, visit);
  }
  visit(source);
  return errors;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const files = [sharedRoot, backendRoot, frontendRoot].flatMap((directory) => filesIn(path.join(root, directory)));
  const errors = files.flatMap((file) => checkKnowledgeImports(path.relative(root, file).replaceAll('\\', '/'), readFileSync(file, 'utf8')));
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(`Knowledge boundaries: ${files.length} source files checked; no inverted runtime dependencies.`);
}
