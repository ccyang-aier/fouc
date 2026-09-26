import assert from 'node:assert/strict';
import { test } from 'node:test';
import { verifyPlan } from './verify-knowledge-tasks.mjs';

const task = (id, dependencies = []) => ({ id, dependencies, status: 'pending', sections: ['1'], deliverables: 'test', acceptance: 'check', evidence: [] });
const plan = (tasks) => ({ tasks, statusLegend: { pending: '待实施', accepted: '已验收' } });
const source = '## 1. Requirements';

test('independent branches are topologically ordered', () => {
  assert.deepEqual(verifyPlan(plan([task('C01', ['A01', 'B01']), task('B01'), task('A01')]), source).ordered.map((item) => item.id), ['A01', 'B01', 'C01']);
});
test('cycles and missing dependencies are rejected', () => {
  assert.throws(() => verifyPlan(plan([task('A01', ['B01']), task('B01', ['A01'])]), source), /依赖环/);
  assert.throws(() => verifyPlan(plan([task('A01', ['B01'])]), source), /未知依赖/);
});
test('uncovered design sections cannot silently pass', () => {
  assert.throws(() => verifyPlan(plan([task('A01')]), `${source}\n### 1.1 Hidden requirement`), /未覆盖/);
});
test('acceptance requires evidence and accepted prerequisites', () => {
  const accepted = { ...task('B01', ['A01']), status: 'accepted' };
  assert.throws(() => verifyPlan(plan([task('A01'), accepted]), source), /前置 A01 尚未验收/);
  assert.throws(() => verifyPlan(plan([{ ...task('A01'), status: 'accepted' }]), source), /无证据/);
});
