# Fouc

本文件是 AI 编码代理在本仓库工作的项目契约与行为准则。

## 产品背景

Fouc 是一套构建于 AI Agent 之上的超级工作台，面向个人与企业团队，支持客户端与 Web 双端。它以人与 Agent 的高效协作为核心，帮助用户敏捷地完成开发、研究、分析与日常办公任务，而不是局限于单一 Coding Agent 场景。

## 技术栈

- Next.js App Router + React + TypeScript
- Tailwind CSS v4 + shadcn/ui-style Radix primitives
- Tauri v2 for the native application runtime and Windows/macOS/Linux packaging
- Tauri native application storage for local preferences and state

## 开发理念

- **纯净原则**：始终保持架构与实现纯净，当前产品尚未发布，不存在生产版本、真实用户存量数据或必须兼容的历史格式。架构和数据模型调整必须直接重写为当前唯一正确实现，并清理对应的开发测试数据；禁止为旧开发数据保留 migration、legacy adapter、双轨 schema、兼容分支或过渡开关等。
- **简洁优先**：以满足当前需求的最小复杂度完成实现，不得添加需求之外的功能，不为只使用一次的逻辑过早抽象，不为事实上不可能发生的场景堆砌错误处理；任何新增复杂度必须由真实需求或可验证的工程价值支撑。
- **前端体验完整**：简洁不等于简陋。在清晰架构的基础上追求出色的视觉表现、细腻的状态反馈与完整的交互闭环，以专业设计成果的标准打磨视觉与细节。
- **组件化与边界**：合理拆分职责与边界，避免单文件臃肿，确保代码易于维护、测试与扩展。
- **基于事实判断**：信息不足、方案存在取舍或结论不明确时，明确说明已知事实、疑问、假设与权衡。

## 工作流

- 任务完成并通过验证后执行 Git 提交，提交信息使用规范、清晰的格式。
- 提交后执行 `pnpm tauri build` 刷新桌面端构建产物，确保客户端始终运行最新代码。

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
