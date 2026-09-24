# DBX 目录源接入记录（2026-09-24）

关联任务：F04（进行中）。目录源位于 `shared/catalog/dbx-catalog.json`，复制并转换自固定 DBX 修订版的驱动清单、连接 Profile 与 SQL 方言 YAML。运行时代码不读取 `opensource/dbx`。

| 检查 | 结果 |
| --- | --- |
| 驱动、Profile、方言数量 | 81、104、35 |
| 来源一致性 | `scripts/verify-dbx-migration-tracker.mjs` 对原始清单和全部方言文件核对 SHA-256 |
| 映射校验 | 启动时校验唯一 ID、Profile→驱动、驱动→方言与完整能力键；缺失或未知能力声明会失败关闭 |
| 运行时使用 | MySQL 会话从本地目录读取声明能力，再与实际探测能力取交集 |
| API 边界 | 目录端点受 Bearer 鉴权；响应标记为静态声明，不代替连接能力快照 |
| 自动化 | 目录与 API 用例通过；后端类型检查通过 |

剩余验收：各驱动的动态能力、全部 Profile 表单、桌面/Web/CLI/MCP 入口及方言实际执行路径尚未逐项接入与验证。F04 不能据此标为已完成。
