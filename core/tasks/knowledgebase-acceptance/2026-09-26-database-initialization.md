# D03 · 真实数据库初始化验收

日期：2026-09-26。当前开发主库首次初始化完成；不含示例身份或业务数据。

## 主代理复核与实际结果

复核初始化、配置/角色检查、目录核验与 CLI；重新运行：

```powershell
bun test backend/src/database/knowledge
bun backend/scripts/database.ts check
pnpm backend:typecheck
```

- **46 tests / 1307 assertions / 0 failures**。
- 主库检查 **ready**，28 张表、24 张强制租户 RLS 表；ltree/pg_search/vector 扩展存在，`issues=[]`。
- 初始化代理实查 28 张表总共 0 行，未 seed；一次性测试库清理后不存在。
- 真实测试覆盖初始化后拒绝重复执行、危险角色拒绝、禁止应用建表/改 RLS/TRUNCATE、策略替换检查，以及初始化任一步失败后的完整事务回滚。
- 两个租户所有业务表上的恶意读写隔离仍通过；跨租户 FK、仅 database 类型可承载 row、vector 维度与双模型暂存约束均在 PostgreSQL 验证。
- 真实 Y.Doc 编码 bytea 保存、检查点恢复、并发更新收敛和正文/Outbox 同事务回滚通过。

## 工程边界

初始化唯一当前 schema，不提供旧开发 schema 迁移或隐式重置。两处超出 PostgreSQL 63 字节的自动 FK 名改为显式短名，并增加所有声明标识符长度守卫；生成 SQL 已同步并通过 drift 检查。

`check` 核对表/列、已验证约束、索引名与方法、完整 RLS 策略及有效最小权限，不是所有数据库对象的通用语义 diff，也不证明 H02/H03 后续检索能力。

Bun 1.4.0/Windows 曾在同测试进程反复创建/关闭 pg Pool 后崩溃；CLI 用例改为真实独立进程执行 init/status/check。崩溃遗留的自有临时库已逐一核对并清理；主库未重置。新的完整测试稳定通过。

邮箱登录、业务成员资格和 API 授权尚待 A01/A02/P 系列；RLS 不替代上层身份认证。
