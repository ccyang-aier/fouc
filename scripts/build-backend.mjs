/**
 * 后端 sidecar 构建：`bun build --compile` 产出单文件可执行，
 * 按 Tauri externalBin 约定命名 fouc-backend-<target-triple>[.exe]，
 * 输出到 src-tauri/binaries/ 供打包随应用分发。
 *
 * 桥不单独出产物：claude 桥并入本二进制（--bridge argv 分发），
 * codex 桥在运行时按需从 npm 下载（agents/bridge-fetch.ts）。
 */

import { execSync } from "node:child_process"
import { existsSync, copyFileSync, mkdirSync, readdirSync, rmSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "src-tauri", "binaries");

// 目标三元组：优先 Tauri 注入的 TAURI_ENV_TARGET（CI 交叉编译），
// 否则取本机 rustc host
const target =
  process.env.TAURI_ENV_TARGET ??
  execSync("rustc -vV", { encoding: "utf8" })
    .split("\n")
    .find((line) => line.startsWith("host: "))
    .trim()
    .slice("host: ".length);

const isWindows = target.includes("windows");
const ext = isWindows ? ".exe" : "";

mkdirSync(outDir, { recursive: true });

const outfile = path.join(outDir, `fouc-backend-${target}${ext}`);
if (existsSync(outfile)) rmSync(outfile);

// --compile 将 hono/@agentclientprotocol/sdk/claude 桥适配器等全部内联进单文件
execSync(`bun build --compile --minify backend/src/index.ts --outfile "${outfile}"`, {
  cwd: root,
  stdio: "inherit",
});
console.log(`[build-backend] sidecar ready: ${outfile}`);

// 同步到 target/release/：Tauri 打包器不刷新裸 exe 旁的 sidecar 副本，
// 直接运行 target/release/fouc.exe 验证时会拿到陈旧后端（被占用时跳过）
const rawDir = path.join(root, "src-tauri", "target", "release");
const rawCopy = path.join(rawDir, `fouc-backend${ext}`);
if (existsSync(rawDir)) {
  try {
    copyFileSync(outfile, rawCopy);
    console.log(`[build-backend] synced raw-run copy: ${rawCopy}`);
  } catch (error) {
    console.warn(`[build-backend] raw-run copy skipped (file locked?): ${error.message}`);
  }
}

// 清掉历史阶段的桥 sidecar（externalBin 已不再引用）
for (const stale of ["fouc-bridge-claude", "fouc-bridge-codebuddy", "fouc-bridge-codex", "bun"]) {
  for (const name of readdirSync(outDir)) {
    if (name.startsWith(`${stale}-${target}`)) {
      rmSync(path.join(outDir, name));
      console.log(`[build-backend] removed stale sidecar: ${name}`);
    }
  }
}
