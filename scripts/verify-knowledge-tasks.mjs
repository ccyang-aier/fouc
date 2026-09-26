import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const planPath = path.join(root, 'core/tasks/knowledgebase-tasks.json');
const outputPath = path.join(root, 'core/tasks/fouc-knowledgebase-tasks.md');

export function verifyPlan(plan, source, fileExists = (name) => existsSync(path.join(root, name))) {
  const errors = [];
  const byId = new Map();
  for (const task of plan.tasks) {
    if (byId.has(task.id)) errors.push(`重复任务 ${task.id}`);
    byId.set(task.id, task);
    if (!/^[A-Z]+\d{2}$/.test(task.id)) errors.push(`无效 ID ${task.id}`);
    if (!Object.hasOwn(plan.statusLegend, task.status)) errors.push(`${task.id} 状态无效`);
    if (!task.acceptance || !task.deliverables || !task.sections.length) errors.push(`${task.id} 缺少验收、交付物或章节`);
    if (new Set(task.dependencies).size !== task.dependencies.length) errors.push(`${task.id} 重复依赖`);
  }
  const visiting = new Set();
  const visited = new Set();
  const ordered = [];
  function visit(id, trail = []) {
    if (visiting.has(id)) { errors.push(`依赖环 ${[...trail, id].join(' → ')}`); return; }
    if (visited.has(id)) return;
    const task = byId.get(id);
    if (!task) { errors.push(`未知依赖 ${id}`); return; }
    visiting.add(id);
    for (const dep of task.dependencies) visit(dep, [...trail, id]);
    visiting.delete(id);
    visited.add(id);
    ordered.push(task);
  }
  for (const task of plan.tasks) visit(task.id);
  if (plan.finalTask) {
    const included = new Set();
    const collect = (id) => {
      if (included.has(id)) return;
      included.add(id);
      for (const dep of byId.get(id)?.dependencies ?? []) collect(dep);
    };
    collect(plan.finalTask);
    for (const task of plan.tasks) if (!included.has(task.id)) errors.push(`最终验收未依赖 ${task.id}`);
  }
  const sections = [...source.matchAll(/^#{2,3}\s+(\d+(?:\.\d+)?)\.?\s+(.+)$/gm)].map((match) => ({ id: match[1], title: match[2].trim() }));
  const sectionIds = new Set(sections.map((section) => section.id));
  for (const section of sections) {
    if (!plan.tasks.some((task) => task.sections.includes(section.id))) errors.push(`设计章节未覆盖 §${section.id} ${section.title}`);
  }
  for (const task of plan.tasks) {
    for (const section of task.sections) if (!sectionIds.has(section)) errors.push(`${task.id} 引用了不存在的章节 ${section}`);
    if (task.status !== 'pending') {
      for (const dep of task.dependencies) if (byId.get(dep)?.status !== 'accepted') errors.push(`${task.id} 前置 ${dep} 尚未验收`);
    }
    if (task.status === 'accepted') {
      if (!task.evidence.length) errors.push(`${task.id} 已验收但无证据`);
      for (const item of task.evidence) {
        if (!item.summary || !item.command || !item.verifiedAt || !item.path || !fileExists(item.path)) errors.push(`${task.id} 证据不完整或路径不存在`);
      }
    }
  }
  if (errors.length) throw new Error(errors.join('\n'));
  return { ordered, sections };
}

const escapeCell = (value) => String(value).replaceAll('|', '\\|').replaceAll('\n', '<br>');
export function renderPlan(plan, { ordered, sections }) {
  const accepted = ordered.filter((task) => task.status === 'accepted');
  const ready = ordered.filter((task) => task.status === 'pending' && task.dependencies.every((dep) => accepted.some((done) => done.id === dep)));
  const lines = [
    `# ${plan.title}`, '',
    '> 本表由 `knowledgebase-tasks.json` 生成。修改任务和证据后运行 `node scripts/verify-knowledge-tasks.mjs --write`。', '',
    `设计依据：[原始设计文档](../../${plan.source})。共 ${ordered.length} 项，已验收 ${accepted.length} 项。`, '',
    '## 实施约束', '', ...plan.rules.map((rule) => `- ${rule}`), '',
    '## 当前基线', '', ...Object.entries(plan.baseline).map(([key, value]) => `- ${key}：${Array.isArray(value) ? value.join('；') : value}`), '',
    '## 可开始的任务', '', ready.length ? ready.map((task) => `- ${task.id} ${task.title}`).join('\n') : '检查进行中和待验收任务。', '',
    '## 拓扑排序任务表', '',
    '| 验收 | ID | 任务 / 交付物 | 设计章节 | 硬前置 | 独立验收标准 | 证据 |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...ordered.map((task) => `| ${task.status === 'accepted' ? '[x]' : '[ ]'} ${plan.statusLegend[task.status]} | ${task.id} | ${escapeCell(task.title)}<br>${escapeCell(task.deliverables)} | ${task.sections.map((section) => `§${section}`).join(' / ')} | ${task.dependencies.join(', ') || '—'} | ${escapeCell(task.acceptance)} | ${task.evidence.map((item) => `[${escapeCell(item.summary)}](../../${item.path})`).join('<br>') || '—'} |`), '',
    '## 完整任务 DAG', '', '箭头从前置任务指向使用它的后续任务；此图与任务表来自同一份依赖数据。', '', '```mermaid', 'flowchart TD',
    ...ordered.map((task) => `  ${task.id}["${task.id} ${task.title}"]`),
    ...ordered.flatMap((task) => task.dependencies.map((dep) => `  ${dep} --> ${task.id}`)),
    ...accepted.map((task) => `  style ${task.id} fill:#e4f4e9,stroke:#42845c`), '```', '',
    '## 设计覆盖矩阵', '', '| 章节 | 设计内容 | 实施 / 验收任务 |', '| --- | --- | --- |',
    ...sections.map((section) => `| §${section.id} | ${escapeCell(section.title)} | ${ordered.filter((task) => task.sections.includes(section.id)).map((task) => task.id).join(', ')} |`), '',
    '## 验收纪律', '',
    '“已实现待验收”不会勾选。类型检查不能替代真实多客户端协同、RLS、多节点广播、模型调用或媒体解析。每次验收记录具体命令、观察、覆盖边界；最终 Z09 必须逐项复核当前代码和运行证据。', '',
    '任务表验证器只证明追踪结构完整，不能证明功能已实现；功能完成以各任务列出的独立验收和最终端到端审计为准。', ''
  ];
  return lines.join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const plan = JSON.parse(readFileSync(planPath, 'utf8'));
  const result = verifyPlan(plan, readFileSync(path.join(root, plan.source), 'utf8'));
  const markdown = renderPlan(plan, result);
  if (process.argv.includes('--write')) writeFileSync(outputPath, markdown);
  else if (!existsSync(outputPath) || readFileSync(outputPath, 'utf8') !== markdown) throw new Error('任务表未同步；运行 --write');
  console.log(`Knowledge DAG: ${result.ordered.length} tasks, ${result.sections.length} sections, ${plan.tasks.filter((task) => task.status === 'accepted').length} accepted; no cycles, missing dependencies or uncovered sections.`);
}
