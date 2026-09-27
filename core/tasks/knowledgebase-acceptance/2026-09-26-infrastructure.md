# I01 · 知识库开发基础设施验收

日期：2026-09-26。范围：独立的 ParadeDB、Redis 与 S3/MinIO 开发服务；知识库业务表、RLS 策略、多节点协作、Backend/Media Worker 完整部署由后续任务验收。

状态：I01 实现完成，真实基础设施探针全部通过。验收时间为 2026-09-26 12:34–12:44（Asia/Shanghai）。三个服务保留运行，未构建 Tauri，未提交 Git。

## 产物

- `compose.knowledge.yaml`：固定镜像版本、独立项目 `fouc-knowledge-dev`、独立持久卷、三个健康检查、loopback 端口。
- `backend/server/scripts/knowledge-infra.mjs`：`init / up / verify / status`，Windows 使用 WSL Docker，其他平台使用本机 Docker。
- `backend/server/scripts/knowledge-infra-check.sql`：真实扩展、jieba/ICU、中文/英文全文查询、HNSW 与 ltree 探针。测试表和索引在事务结束时回滚。
- `backend/server/scripts/knowledge-infra-minio.Dockerfile`：从 MinIO 官方固定源码发布构建安全修复版本，以非 root 用户运行。
- `backend/server/scripts/knowledge-infra-minio.Dockerfile.dockerignore`：构建不需要任何工作区数据，禁止把脚本、配置或凭据发送到构建上下文。
- `.env.example`：仅变量定义和占位值；实际 `.env.fouc.local` 由脚本随机生成且被现有 `.gitignore` 忽略。

## 可复现命令

在仓库根目录运行：

```powershell
node --check backend/server/scripts/knowledge-infra.mjs
node backend/server/scripts/knowledge-infra.mjs init
node backend/server/scripts/knowledge-infra.mjs up
node backend/server/scripts/knowledge-infra.mjs verify
bun backend/server/scripts/knowledge-infra.mjs verify
node backend/server/scripts/knowledge-infra.mjs status
git check-ignore .env.fouc.local
```

`init` 仅首次生成新凭据，已有文件不会被覆盖。`up` 只管理 `fouc-knowledge-dev`，不停止或修改其他项目。正常镜像拉取失败时，可使用当前 WSL 已安装的 Skopeo 从同一官方 registry 导入 Docker；没有使用不明镜像站，也没有修改系统 Docker daemon 配置。

Windows 下 `up` 会保留一个隐藏 WSL 会话，以 `/tmp/fouc-knowledge-dev.keepalive.lock` 的 `flock` 排他锁确保单实例。原因是 [WSL 的 systemd 服务本身不会维持发行版存活](https://learn.microsoft.com/en-us/windows/wsl/systemd)。本次实测未保活时会在命令结束后空闲关闭，随后重新启动容器；加保活后连续运行且重复 `up` 没有新增 keeper。没有修改 `.wslconfig`、`wsl.conf` 或注册新的系统服务。Windows 重启或主动终止该 WSL 发行版后，重新运行 `up` 即可恢复。

本地 MinIO 缓存构建禁用时间戳 provenance，以保证无源码变化的重复 `up` 保持镜像身份不变，不无故替换容器；不影响固定源码版本或运行权限。

## Windows / Bun 连接

| 服务 | Windows 与 WSL 开发地址 | Compose 内部地址 |
| --- | --- | --- |
| ParadeDB | `127.0.0.1:55432` | `postgres:5432` |
| Redis | `127.0.0.1:56379` | `redis:6379` |
| S3 | `http://127.0.0.1:59000` | `http://minio:9000` |
| MinIO Console | `http://127.0.0.1:59001` | `http://minio:9001` |

后端配置使用 `DATABASE_URL / REDIS_URL / S3_ENDPOINT / S3_REGION / S3_BUCKET / S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY`。Bun 可用 `--env-file=.env.fouc.local` 注入配置，知识库 API 装配仍由后续任务实现。

`DATABASE_URL` 使用 `fouc_app`，明确为 `NOSUPERUSER NOBYPASSRLS`；`DATABASE_ADMIN_URL` 仅供 schema/扩展初始化使用。当前尚无知识库业务表，因此不能把本记录视为 D02/D03 的租户隔离验收。

## 运行证据

执行环境：Windows 上 Node 24.16.0 / Bun 1.4.0；WSL Ubuntu 22.04.5；Docker client/server 29.4.1，Compose 5.1.3，`flock` 2.37.2。

| 服务 | 真实版本 | 容器 ID（短） | 验收结果 |
| --- | --- | --- | --- |
| `fouc-knowledge-dev-postgres-1` | PostgreSQL 17.11；pg_search 0.25.10；vector 0.8.4；ltree 1.3 | `24f4cfff5a0b` | healthy，restart count 0 |
| `fouc-knowledge-dev-redis-1` | Redis 7.4.8，64-bit，jemalloc 5.3.0 | `7825c617232c` | healthy，restart count 0 |
| `fouc-knowledge-dev-minio-1` | RELEASE.2025-10-15T17-29-55Z；Go 1.24.8 linux/amd64 | `aeeffe00a2cf` | healthy，restart count 0 |

最终运行镜像身份（Docker inspect `.Image`）：

- ParadeDB：`sha256:0a9b9b51f0db3b915d456113404229d0470dce1e670a0fe567b9ca738b9f2933`。
- Redis：`sha256:594ab43ac8cdde0b9c015ac0ccc2e26f1428c06e5712792b82322e266157ee45`。
- MinIO 本地构建：`sha256:84e3fa53bb50525e41f4da40f33aab06eeed28c44cfaebcd587439bd132a530c`。

`node ... up`、`bun ... up`、`bun ... verify` 均退出 0。最后一次重复 `node ... up` 的三个容器均显示 `Running`，没有 `Creating` 或 `Recreate`；MinIO 构建步骤命中缓存。WSL 中仅一个 `flock` keeper，PID 为 `1558`（瞬时运行证据，不应硬编码复用）。

PostgreSQL 的实际 JSON 输出：

```json
{
  "extensions": { "vector": "0.8.4", "pg_search": "0.25.10", "ltree": "1.3" },
  "tokenizers": {
    "jieba": ["知识", "知识库", "协同", "编辑"],
    "icu": ["knowledge", "collaboration", "你好"]
  },
  "query": { "chineseMatch": [1], "englishMatch": [1], "vectorNearest": 1, "ltreeMatch": 1 }
}
```

- 中文/英文探针在真实 ParadeDB 索引上执行 `@@@` 查询；向量探针创建 HNSW 索引并执行余弦距离排序；ltree 祖先范围返回 1 条。测试表和索引随事务回滚，无业务测试数据残留。
- Windows/Bun 通过 `127.0.0.1:55432` 的真实 PostgreSQL 协议认证为 `fouc_app`，查询确认 `rolsuper=false`、`rolbypassrls=false`，并成功执行 jieba tokenizer。Bun 内置 SQL 仅用于这个开发探针，不引入后端业务运行时耦合。
- Windows 的 Redis TCP 探针实际执行 `AUTH → PING → SET EX 30 → GET → DEL → QUIT`，逐字匹配 RESP 结果；随机测试 key 被删除。
- Windows 的 S3 HTTP 探针完成 readiness、bucket access，以及 AWS SigV4 签名 `PUT → GET → DELETE`，UTF-8 内容逐字一致。`fouc-knowledge` bucket 保留供后续开发使用，随机测试对象已删除。
- 所有发布端口经 Docker 元数据确认仅绑定 `127.0.0.1`；MinIO 运行用户为 `10001:10001`。凭据从未输出或写入验收报告；`.env.fouc.local` 命中现有 Git ignore 规则。
- 原有 `kernelon-api-1` (`7348a005346c`) 与 `kernelon-postgres-1` (`e677b2deaa29`) 保持 `Exited (0) 2 months ago`；原生 PostgreSQL `16/main:5432` online、原生 Redis active，未被本任务配置或操作。
- 现有 Web 开发服务 `http://localhost:3000/` 返回 HTTP 200；本任务未停止、重启或替换 Web 服务。

安全复核命令（不输出环境值）：

```powershell
wsl.exe -d Ubuntu-22.04 --exec docker ps -a --format '{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}|{{.Ports}}'
wsl.exe -d Ubuntu-22.04 --exec docker inspect --format '{{.Name}}|{{.Image}}|{{.State.StartedAt}}|{{.State.Health.Status}}|restart={{.RestartCount}}' fouc-knowledge-dev-postgres-1 fouc-knowledge-dev-redis-1 fouc-knowledge-dev-minio-1
wsl.exe -d Ubuntu-22.04 --exec pgrep -a -f fouc-knowledge-dev.keepalive.lock
```

## 来源与边界

- ParadeDB 使用官方 `paradedb/paradedb:0.25.10-pg17`。其 [Jieba 定义](https://raw.githubusercontent.com/paradedb/paradedb/v0.25.10/docs/documentation/tokenizers/available-tokenizers/jieba.mdx) 与 [ICU 定义](https://raw.githubusercontent.com/paradedb/paradedb/v0.25.10/docs/documentation/tokenizers/available-tokenizers/icu.mdx) 是探针配置依据。
- MinIO 固定 [RELEASE.2025-10-15T17-29-55Z](https://github.com/minio/minio/releases/tag/RELEASE.2025-10-15T17-29-55Z)，按官方源码安装方式构建；Go 模块解析到提交 `9e49d5e7a648`。不依赖停止维护的旧二进制镜像。
- 构建时使用 host 网络以访问本机 WSL loopback 代理；运行容器仍处于独立 Compose 网络，发布端口仅 `127.0.0.1`。
- 原有原生 PostgreSQL `16/main`、原生 Redis、已停止 `kernelon-*` 容器均不属于本项目。
- SQL/BM25/HNSW 探针证明基础设施真实可用，不代表完整知识库检索管线、权限过滤、媒体任务或 S3 预签名业务已经实现。
