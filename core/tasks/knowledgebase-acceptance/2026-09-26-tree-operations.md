# U03 · 页面树操作与乐观反馈

日期：2026-09-26。模块：`src/features/knowledge/navigation/`（tree-model 扩展 + tree-operations/move-controller/tree-actions/page-operations/page-menu/rename-inline/page-appearance-dialog/recycle-bin/tree-stage 新建 + page-tree/page-tree-sidebar 完整化）与 `src/features/knowledge/data/`（pages-api/pages-queries 新建、trpc-client 增加非类型化客户端工厂、bun-test.d.ts 扩充）；`knowledge-page.tsx` 仅换接 `KnowledgeTreeStage`（选择状态留在页面层）。设计参照 §3.3（数据库即页面的同一棵 Page 树）与 §5.4（页面树乐观更新、失败回滚并提示）。全部验证命令在本机真实执行。

## 独立验证

```bash
bun test src/features/knowledge          # 272 tests / 0 fail / 1318 assertions（30 文件，本任务新增 32 项）
pnpm typecheck                           # 0 错误（含并行代理文件）
pnpm exec eslint --max-warnings=0 src/features/knowledge/navigation src/features/knowledge/data   # 零输出
node scripts/verify-knowledge-boundaries.mjs   # 250 source files, no inverted runtime dependencies
```

新增 32 项测试 / 4 个文件：
- `move-controller.test.ts`（16 项）：分数索引镜像（`positionBetween(null,null)='i00000'` 精确值、规范形/严格区间/代码单元序不变式、40 次嵌套中点不碰撞、耗尽抛错）、`optimisticInsertPosition`（空集合中点、末尾追加、锚点越界报错）、`dropModeForRow` 分区、`resolveDropPlacement`（inside 归末子、after 直锚、before 锚前兄弟且排除拖拽页自身、首个子页前位置如实拒绝、自身/子孙/跨 teamspace 拒绝）、`keyboardMovePlacement`（上移/下移/缩进/升缩进含全部边界 no-op 语义）、`liveSiblingsUnder`/`subtreeIdsOf`。
- `tree-operations.test.ts`（10 项）：乐观投影（create/update/move/recycle/restore）全部幂等；**回滚状态机**——从更晚的缓存状态精确撤销单条操作（移动失败不动他人重命名）、create 回滚连子树删除、recycle/restore 互逆；权威落位/生命周期结算；**B06 事件收敛**——新鲜服务端快照保留他人变更并重投影未确认本地操作、已含该操作的重放为 no-op、真实 `QueryClient` 上完整走一遍（乐观写入 → 事件重取 → 重投影 → 服务端确认 → 纯服务端真值）。
- `tree-actions.test.ts`（6 项）：写权限门矩阵（owner/admin/member 过、guest 与缺 write 拒、undefined 拒）、键盘意图（F2/Enter 重命名、Delete 回收、Cmd/Ctrl+N、Alt+四方向；裸方向键为 null）、操作集合与危险标记、错误码→中文文案（含操作名/结构化码/回滚说明三要素）、成功文案。
- `data/pages-api.test.ts`（6 项）：真实 tRPC link 链路（U01 权威信封）——`page.list` GET 于 workspace 传输 URL、create/move/recycle/restore POST 契约形体逐字段断言、共享 zod 契约拒绝的响应归一 UNAVAILABLE（永不渲染）、**未装配路由的诚实 NOT_FOUND 归一（含 requestId）**、契约非法输入在任何请求发出前以 INVALID_REQUEST 快速失败。
- `tree-model.test.ts` 扩展（+2 项）：回收站根列表（直接回收的页面按时间倒序、嵌套回收归其根、断链不入站）与空标题回退。

## 浏览器验证（本机 3000 dev，Playwright CLI 真实浏览器 + 状态化路由拦截桩）

拦截桩为**有状态后端仿真**：内存页面集经 create/update/move/recycle/restore 变更后，后续 `page.list` 反映全部变化，乐观循环对一致的服务端真值结算；`GET /api/__u03flag?op=<proc>` 注入一次性失败（FORBIDDEN）。tRPC 桩信封按 U01 测试权威形态；含 CORS 预检。会话/工作区/团队空间/access 桩放行四道闸门至 ready。

- **树就绪与嵌套**：产品文档区展开 → 📄欢迎页/产品路线图（子：Q4 里程碑）/发布计划；treeitem 带 level/expanded/selected 与「…」菜单可访问名（截图 01）。
- **右键/「…」菜单**：9 项操作集（新建子页面/重命名/更改图标…/设置封面…/上移/下移/缩进一级/升缩进一级/移入回收站），结构不可表达的移动项按纯控制器结论禁用（截图 02）。
- **新建 + 行内重命名**：菜单「新建子页面」→ 行内输入即时出现（乐观行先渲染）→ 输入「竞品分析」Enter 提交；空态引导「暂无页面 · 新建第一个页面」点击同样进入该闭环。
- **键盘**：F2/Enter 行内重命名（发布计划→发布检查单场景实测）；**Delete 回收**；**Ctrl+N 新建子页**（本 Chromium 实测可达；浏览器保留键场景见边界）；**Alt+↑↓** 兄弟移动（欢迎页移至产品路线图之后，服务端确认后序稳定）；↑↓←→ roving/展开收起保持 U02 行为。
- **图标/封面**：图标对话框单选 🚀 → 应用 → 行内即时显示 🚀；封面对话框 URL 输入 + 实时预览（img src 跟随）+ 取消。
- **拖拽**：拖「欢迎页」悬停「产品路线图」中部 → **inside 高亮实测**（ring-1 + accent-soft 类名在拖拽悬停时出现）；释放后成为其子页（收起状态隐藏，展开确认）。
- **回收站**：Delete 后树中消失、回收站区出现（计数徽章 + 日期 + 条目）；**恢复**按钮 → 「已恢复到原位置。」toast + 行回到原父级下 + 站点清空后回收站隐藏；**彻底删除按钮渲染为禁用**并带「待回收站服务(Z01)提供」说明（截图 03）。
- **失败回滚**：注入 FORBIDDEN 后 Alt+↓ → 乐观先动 → toast 实测文案「移动页面失败（FORBIDDEN）：没有执行该操作的权限。已恢复到操作前的页面树。」→ 树逐字回到操作前（before===after 程序断言）；recycle 注入失败同样回滚（截图 05）。
- **诚实错误态**：page.list 注入 FORBIDDEN → 树区显示「页面目录加载失败/没有读取页面目录的权限。（错误码 FORBIDDEN）」+ 重试；重试后恢复完整目录（截图 06/07）。
- 截图：`.playwright-cli/u03-01-tree-ready.png` ~ `u03-07-final-tree.png`（gitignored 工件目录，同 U02 惯例）。
- 控制台无 React 错误；仅剩 `page.access`（P03 画布授权查询，本任务范围外）与 shell agents 端点对桩的 404 噪声。

## 通过的实际流程（逐条对应验收标准）

1. **新建、重命名、图标/封面、嵌套移动/排序、删除恢复**：树右键与「…」菜单操作集（权限门 tree-actions）；移动支持拖拽（drop 目标高亮：上/下插入线、inside 环形高亮、结构非法目标无任何 affordance）与键盘（Alt+方向，分数排序语义、`afterPageId` 表达）；回收站视图恢复可用，彻底删除入口按 Z01 语义保留（禁用 + 说明）。
2. **键盘导航**：U02 roving 之上扩展 Enter/F2 重命名、Delete 回收、Cmd/Ctrl+N 新建子页（分区行=该空间根页）、上下左右遍历与展开收起不变。
3. **失败恢复且提示明确**：乐观更新（本地树先变）→ 失败精确回滚（`undoTreeOperation` 从任意更晚状态逆操作）+ 结构化错误 toast（KnowledgeErrorCode→中文，含操作名与回滚说明）；并发冲突（B06 page.* 事件到达引发重取）经 `reapplyTreeOperations` 幂等收敛——单测在真实 QueryClient 上验证了完整链路。
4. **操作进行中状态与空态引导**：行内 spinner（aria-label「正在同步」，pending 行降透明度、禁拖拽与二次操作）；空团队空间显示「暂无页面 · 新建第一个页面」引导；只读角色显示权限说明 note。

## 实现要点与关键设计决策

- **传输对齐**：T01 尚无 HTTP 路由（Z03 装配），`data/pages-api.ts` 以 `createTRPCUntypedClient`（@trpc/client 公共 API，与 U01 同一 httpBatchLink 配置：批 ≤10、URL ≤8KiB、credentials include）调用 `page.list/create/update/move/recycle/restore`，入参先过共享 zod 契约镜像（非法输入零请求快速失败），响应逐个过 `pageSchema/pagePlacementSchema/pageLifecycleStateSchema` 校验——契约不符归一 UNAVAILABLE，未装配路由归一 NOT_FOUND，后端不可达如实呈现、绝不伪造。类型安全来自共享契约而非对 wire 的信任；Z03 挂载真实路由后零改动对齐。
- **分数索引镜像**：`move-controller.ts` 逐行镜像 T01 `ordering.ts`（6 位 base-36 定宽整数 + 去尾零小数 + BigInt 精确中点；ES2017 target 下以 `BigInt()` 调用替代字面量）。共享契约规定客户端**永不发送** position（只以 afterPageId 表达落点），镜像仅用于乐观本地排序；服务端权威 position 结算后覆盖。排序键耗尽时跳过乐观投影、仍发起服务端调用（服务端局部重排）。
- **诚实契约缺口——「首个子页之前」不可表达**：T01 `allocatePosition` 中 `afterPageId=null` 语义为「追加为末子」，无「插到最前」编码。拖拽/键盘对该位置一律拒绝（`first-position`），绝不静默落到其它位置；菜单「上移」对前两位禁用并说明。建议 Z03 扩展表达（如 beforePageId 或首槽哨兵）。
- **乐观状态机**：`tree-operations.ts` 纯代数——操作记录「变了什么 + 原来是什么」，同一 union 回答 §5.4 三问：投影（apply）、精确回滚（undo，create 回滚连乐观子树）、事件收敛（reapply，全部幂等，服务端已应用同操作时重放为 no-op）。React 侧 `page-operations.ts`：QueryCache 订阅在 pending 非空时把每次**服务端**fetch 结果（B06 事件失效/焦点/重连）立即重投影 pending 操作（manual 写入跳过），单页串行门（同页 pending 期间拒新操作）。
- **权限门**：`canEditTree`（角色非 guest 且 scopes 含 write）门住全部写路径（菜单禁用 + 键盘 no-op + 控制器三重防线）；页面级 ACL 界面归 U05。
- **无新增依赖**：右键菜单为自绘轻量组件（overlay 根挂载、指针锚定 + 视口钳制、Escape/外点关闭、菜单项方向键漫游），未引入 Radix ContextMenu。

## 明确边界（诚实记录）

- **无真实后端往返**：8710 未挂载 page.* 路由（Z03 装配），浏览器验证以有状态拦截桩驱动真实 tRPC link 链路 + 诚实错误态；tRPC 桩信封与 U01 单测同构。`page.update` 的服务端实现尚不存在（T01 无 update 服务），客户端按共享 `updatePageInputSchema` 契约对齐，Z03/T02+ 落地后即通。
- **B06 事件流**：ws 对未装配后端必然握手失败；「事件到达 → 重取 → 重投影」收敛链路以真实 QueryClient 单测验证，真实事件闭环归 Z03 后验证。
- **Cmd/Ctrl+N 浏览器保留键**：本 Chromium（CLI 驱动）实测可达；部分浏览器（如 Chrome Ctrl+N）保留该组合无法拦截——菜单「新建子页面」与头部「新建页面」按钮为等效可达出口，桌面 Tauri 壳内可拦截。
- **cover 为 URL 直填 + 预览**：上传/裁剪随附件任务（U08/U09）接入；icon 为精选 emoji 集，自定义图片图标同前。
- **彻底删除**：入口按任务说明留给 Z01 语义（禁用 + tooltip），未实现调用。
- 验证期间并行代理持续触发 Fast Refresh，个别交互需在稳定窗口内原子重试；树组件状态（展开/焦点）在热替换时重置属 dev 行为，非产品缺陷。修复了一处实测发现的竞态：`revealPage` 的 rAF 行聚焦会在重命名输入挂载聚焦后抢占焦点导致输入空提交，已改为仅非重命名路径聚焦行（浏览器复验通过）。
