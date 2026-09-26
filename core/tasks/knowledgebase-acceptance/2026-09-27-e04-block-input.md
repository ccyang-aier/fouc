# E04 验收 — 基础块快捷输入与键盘编辑

日期:2026-09-27 · 验收人:主会话 · 实现代理:E04 子代理(两任接续)· 装配:主会话

## 验收命令与结果

```
bun test src/features/knowledge/editor                                # 104 pass / 0 fail / 601 断言(装配后全树)
bunx eslint --no-ignore src/features/knowledge/editor/extensions ...  # 0 错误 0 警告
bunx tsc --noEmit                                                     # E04 文件 0 错误;草稿 scratch-e04* 已清零删除
```

## 交付内容(src/features/knowledge/editor/extensions/ + components/block-format-menu.tsx)

- **输入规则**(按块类型拆文件,类型从共享 E01 schema 动态解析):`#`~`######` 标题(保留 blockId)、`-`/`*`/`+` 无序列表、`1.`~`9.` 有序(数字续接才 join)、`[]`/`[ ]`/`[x]` 待办、`>` 引用、``` 代码块(捕获语言)、`---`/`***`/`___` 分割线(整段替换/段中插上)、`**b**`/`__b__`/`*i*`/`_i_`/`` `c` `` 行内标记(代码块内不触发)。
- **键盘**:Enter(空标题→段落、空列表首块提升、非空列表项拆分延续);Backspace(先 undoInputRule、标题逐级降级、列表项块首提升、引用解包、回落核心链);Tab/Shift+Tab 列表缩进(始终消费);Mod-Shift-↑/↓ 块移动(列表内移 item,blockId 随迁)。
- **IME**:`view.composing` 守卫 keydown/handleTextInput,合成期不打断,compositionend 后补跑。
- **格式命令层**:setBlockFormat/currentBlockFormat/insertMathBlock(Notion 级 toggle:同级再按退出、异类列表整树改写、邻居续接),`BlockFormatMenu` 驱动。
- 装配(主会话):editor-surface 挂 `createBlockEditingExtensions()`;工具栏占位按钮换 `BlockFormatMenu`。

## 验收标准核对(基础块快捷输入与键盘编辑)

全部输入规则与键盘行为有 48 项测试(输入规则 12、键盘 21、格式命令+菜单 15),happy-dom 真实按键事件;IME 合成守卫有专项断言。

## 说明

前任 4 个 scratch 草稿均为 happy-dom 探针(结论已入实现注释与测试断言),无可抢救代码,已全部删除。
