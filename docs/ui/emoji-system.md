# Fouc 默认 Emoji

Fouc 移植 Fob 的 OpenMoji 17.0.0 原版彩色 SVG 精选集：表情心情、手势心意、自然动物、食物日常、工作学习、活动出行、物品科技、符号标记共 8 类，每类 56 个，共 448 个。系统操作图标仍遵循 [图标系统](icon-system.md)。

## 资源与呈现

`src/components/icons/openmoji-catalog.json` 是唯一精选数据源，保留 Unicode、上游 hexcode、中英文名称、关键词与类别；`emoji-catalog.ts` 负责检索映射和正文 UTF-16 分段。`public/icons/openmoji/sources.json` 固定上游版本、原始 URL 和 SHA-256，SVG 均为未修改的原版资源；`.gitattributes` 禁止 Git 对这些 SVG 转换换行，确保 Windows 检出后仍通过原始字节摘要验证。维护资源使用 `scripts/sync-openmoji.mjs`。

统一经 `@/components/icons` 的 `Emoji` 显示。聊天输入装饰、Markdown 正文、表情回应、任务评论及共享选择入口使用同一目录与本地路径，不请求远程素材。内容只保存 Unicode，不把资源路径写入业务数据；精选表情的 Unicode 展示变体映射到相同资源，未入选序列保留可读原文字，不替换成问号或错误图片。正文中的表情提供可访问名称，装饰性的选择器与回应图像由所属按钮提供名称。

## 选择与状态

`EmojiPalette` 是唯一选择面，使用八列网格、中文／英文名称与关键词搜索、八类浏览、选中及禁用态、方向键和 Home / End 导航。最近使用保留最新 32 项，经同一精选目录过滤后存入本机 `fouc.emoji.recent`；存储不可写时仍可选择。搜索跨分类，空结果与空最近记录均有明确反馈。

`EmojiPicker` 提供统一触发器与弹层，选择后关闭并返回 Unicode，Escape、外点关闭和回焦复用 `AnchoredPopover`；面板宽 296px，内容独立限高并限制在视口内。聊天输入与消息回应、任务评论共用该入口；不另维护聊天专用资源库或第二套选择器。

## 来源与许可

原始作品由 OpenMoji 及其贡献者创作，遵循 CC BY-SA 4.0；原始署名位于资源目录，完整许可在 `public/licenses/openmoji.txt`。`pnpm icons:verify` 核对 8 × 56 范围、448 个唯一资源、固定上游来源、文件摘要及许可，拒绝额外未登记素材。
