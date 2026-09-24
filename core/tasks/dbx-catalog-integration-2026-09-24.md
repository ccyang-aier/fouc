# DBX 目录源接入记录（2026-09-24）

关联任务：F04（进行中）。目录源位于 `shared/catalog/dbx-catalog.json`，复制并转换自固定 DBX 修订版的驱动清单、连接 Profile 与 SQL 方言 YAML。运行时代码不读取 `opensource/dbx`。

| 检查 | 结果 |
| --- | --- |
| 驱动、Profile、方言数量 | 81、104、35 |
| 来源一致性 | `scripts/verify-dbx-migration-tracker.mjs` 对原始清单和全部方言文件核对 SHA-256 |
| 转换内容一致性 | `pnpm verify:dbx-catalog` 解析 DBX 原始清单/YAML，逐项比较 Fouc 目录中 81 个驱动、104 个 Profile 和 35 个方言的全部字段；无差异 |
| 映射校验 | 启动时校验唯一 ID、Profile→驱动、驱动→方言、声明字段类型与完整能力键；缺失或未知能力声明会失败关闭；运行时目录项冻结，调用方不能改写能力位 |
| 运行时使用 | MySQL 会话从本地目录读取声明能力，再与实际探测能力取交集 |
| MySQL Profile 默认字段 | 连接表单经鉴权 Profile API 加载默认端口和用户；浏览器显示 `3306`、`root`，关闭后弹窗消失且无脚本错误 |
| API 边界 | 目录端点受 Bearer 鉴权；响应标记为静态声明，不代替连接能力快照 |
| 自动化 | 目录与 API 用例通过；前后端类型检查、lint、33 项后端测试通过 |

剩余验收：各驱动的动态能力、其余 Profile 表单、桌面/Web/CLI/MCP 入口及方言实际执行路径尚未逐项接入与验证。F04、C01 仍保持进行中；目录转换、启动校验和 MySQL 默认字段这一部分已经验证。
