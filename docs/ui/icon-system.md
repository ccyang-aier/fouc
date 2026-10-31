# Fouc 图标系统

Fouc 与 Fob 使用同一图标来源、渲染器和尺寸规则。本规范是系统导航、系统菜单、设置、页签、业务工具栏和操作菜单的统一依据。

## 来源与入口

- 默认使用 Font Awesome 7 Solid，固定 `@fortawesome/free-solid-svg-icons`、`@fortawesome/fontawesome-svg-core` 7.3.1 和官方 React 渲染器 3.5.0；按单个官方定义导入，不加载整套图标，不依赖运行时 CDN。许可保留在 `public/licenses/fontawesome.txt`。
- 所有调用从 `@/components/icons` 选择语义组件；映射集中在 `src/components/icons/index.ts`，布局由 `solid-icon.tsx`、`metrics.ts` 管理。CodeMirror 的非 React DOM 使用同目录 `dom-icon.ts` 的官方 FA 定义，保留原有 SQL 类型颜色。
- Lucide 仅用于明确需要轻量轮廓的控制：前进后退、折叠与树节点箭头、更多、加减、关闭、勾选、刷新、缩放、展开收起、移动和排序方向、加载、窗口边框、侧栏收纳、断网状态，以及星标未选中与低优先级旗标。默认导航实体、设置、搜索、通知和操作语义使用 FA7 Solid；不按激活状态改变导航图标造型。
- `SelectionCheck` 是菜单选中标记：18px、2px 线宽；普通动作反馈用 `Check`。星标选中使用 Solid、未选中使用 `StarOutline`，评分保留实心、半星和空心；任务低优先级使用 `FlagOutline`，其余优先级保留既定语义色。
- 不引入 Phosphor 或第三套图标包，不手绘 UI SVG、不复制旧图标路径、不通过 CSS 强制填充轮廓。数据图表、关系图、任务进度、产品品牌和布局裁切属于各自领域的图形，使用 `data-visualization` 明确其用途，不能借此添加操作图标。用户上传与第三方品牌内容继续使用实际资源。
- 默认 Emoji 使用同目录 `Emoji` 渲染，详见 [Emoji 系统](emoji-system.md)。shadcn 生成控件仍选择 Lucide，但生成后必须把导入改到统一目录并按语义选型。

## 尺寸与反馈

沿用 Fob 的三档请求尺寸：普通控制 `16`、菜单与紧凑项 `14`、辅助指示 `12`，渲染为 14 / 12 / 10px；18–20px 的普通请求归常规档，13–15px 归紧凑档。大于 20px 的数字预览尺寸减 2px。明确的光学尺寸以字符串传入，菜单选中标记固定为 `18px`。Emoji 使用同一解析，不在调用方重复缩放；按钮点击区独立控制。

图标继承 `currentColor` 与既定语义、品牌和功能颜色；导航继续使用 `--sidebar-icon`，深浅模式随主题适配。普通按钮反馈复用全局交互令牌，不因图标库统一去掉已有功能识别色。

页签与 Fob 保持相同的透明未选中面、`--panel` 选中面和柔和单层描边，32px 高、128px 宽、8px 圆角，置顶后增加 16px；单页签也受容器宽度约束。共享弹簧选择面、新建关闭淡入缩放、拖动排序与溢出滚动保持一套实现。行为与项目作用域见 [项目体验](../product/V1/design/projects/fouc-project-space-product-ux-design.md)。

## 验证

`pnpm icons:verify` 检查全局导入边界、禁用库、UI SVG 和 OpenMoji 来源摘要，并纳入 lint。新增语义先从已选库寻找简单、圆润、小尺寸清晰的官方候选，再登记到目录；显式轮廓例外同步修改本规范。类型检查、必要组件回归和真实浅深色流程共同验证视觉与语义。
