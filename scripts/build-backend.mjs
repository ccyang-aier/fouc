/**
 * 后端与桥 sidecar 构建，按 Tauri externalBin 约定命名 <name>-<target-triple>[.exe]，
 * 输出到 src-tauri/binaries/ 供打包随应用分发：
 *  - fouc-backend        bun build --compile 后端单文件可执行
 *  - fouc-bridge-claude  claude-agent-acp 适配器编译为单文件可执行（embed 形态）
 *  - fouc-bridge-codebuddy  CodeBuddy CLI 入口编译为单文件可执行
 *  - fouc-bridge-codex   codex-acp 原生二进制（npm 平台包内复制，不经编译）
 */

import { execSync } from "node:child_process"
import { copyFileSync, existsSync, mkdirSync, rmSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "src-tauri", "binaries");

// 目标三元组：优先 Tauri 注入的 TAURI_ENV_TARGET（CI 交叉编译），
// 否则取本机 rustc host
const target =
  process.env.TAURI_ENV_TARGET ??
  execSync("rustc -vV", { encoding: "utf-8" })
    .split("\n")
    .find((line) => line.startsWith("host: "))
    .trim()
    .slice("host: ".length);

const isWindows = target.includes("windows");
const ext = isWindows ? ".exe" : "";

mkdirSync(outDir, { recursive: true });

function compileSidecar(name, entry) {
  const outfile = path.join(outDir, `${name}-${target}${ext}`);
  if (existsSync(outfile)) rmSync(outfile);
  // --compile 将依赖全部内联进单文件
  execSync(`bun build --compile --minify "${entry}" --outfile "${outfile}"`, {
    cwd: root,
    stdio: "inherit",
  });
  console.log(`[build-backend] sidecar ready: ${outfile}`);
}

compileSidecar("fouc-backend", "backend/src/index.ts");
compileSidecar("fouc-bridge-claude", "backend/src/bridges/claude-acp.ts");
compileSidecar("fouc-bridge-codebuddy", "backend/src/bridges/codebuddy-acp.ts");

// codex 桥是 Rust 原生二进制：从对应平台的 npm 包直接复制
function codexPackageFor(triple) {
  const arch = triple.startsWith("aarch64") ? "arm64" : "x64";
  if (triple.includes("windows")) return `codex-acp-win32-${arch}`;
  if (triple.includes("darwin")) return `codex-acp-darwin-${arch}`;
  return `codex-acp-linux-${arch}`;
}
const codexPkg = codexPackageFor(target);
const codexSource = path.join(root, "backend/node_modules/@zed-industries", codexPkg, "bin", `codex-acp${ext}`);
if (!existsSync(codexSource)) {
  throw new Error(
    `[build-backend] codex bridge binary not found: ${codexSource} — install with pnpm --filter @fouc/backend add @zed-industries/${codexPkg}`
  );
}
const codexOutfile = path.join(outDir, `fouc-bridge-codex-${target}${ext}`);
if (existsSync(codexOutfile)) rmSync(codexOutfile);
copyFileSync(codexSource, codexOutfile);
console.log(`[build-backend] sidecar ready: ${codexOutfile}`);

// claude 桥的 SDK 以 "bun" 启动解压出的 CLI：随包分发构建用的 bun 运行时，
// 运行期由 prepareCleanEnv 将 sidecar 目录前置到子进程 PATH。
const bunSource = execSync('bun -e "process.stdout.write(process.execPath)"', { encoding: "utf8" }).trim();
if (!existsSync(bunSource)) {
  throw new Error(`[build-backend] bun runtime not found: ${bunSource}`);
}
const bunOutfile = path.join(outDir, `bun-${target}${ext}`);
if (existsSync(bunOutfile)) rmSync(bunOutfile);
copyFileSync(bunSource, bunOutfile);
console.log(`[build-backend] sidecar ready: ${bunOutfile}`);
