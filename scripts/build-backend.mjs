/**
 * 后端 sidecar 构建：`bun build --compile` 产出单文件可执行，
 * 按 Tauri externalBin 约定命名 fouc-backend-<target-triple>[.exe]，
 * 输出到 src-tauri/binaries/ 供打包随应用分发。
 */

import { execSync } from "node:child_process"
import { mkdirSync, existsSync, rmSync } from "node:fs"
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
const binaryName = `fouc-backend-${target}${isWindows ? ".exe" : ""}`;

mkdirSync(outDir, { recursive: true });
const outfile = path.join(outDir, binaryName);
if (existsSync(outfile)) rmSync(outfile);

// --compile 将 hono/@agentclientprotocol/sdk 等依赖全部内联进单文件
execSync(`bun build --compile --minify backend/src/index.ts --outfile "${outfile}"`, {
  cwd: root,
  stdio: "inherit",
});

console.log(`[build-backend] sidecar ready: ${outfile}`);
