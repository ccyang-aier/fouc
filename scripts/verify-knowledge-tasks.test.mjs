import assert from 'node:assert/strict';
import { test } from 'node:test';
import { verifyPlan } from './verify-knowledge-tasks.mjs';

const task = (id, dependencies = []) => ({ id, dependencies, status: 'pending', sections: ['1'], deliverables: 'test', acceptance: 'check', evidence: [] });
const plan = (tasks) => ({ tasks, statusLegend: { pending: '待实施', accepted: '已验收' } });

test('independent branches are topologically ordered', () => {
  assert.deepEqual(verifyPlan(plan([task('C01', ['A01', 'B01']), task('B01'), task('A01')])).ordered.map((item) => item.id), ['A01', 'B01', 'C01']);
});
test('cycles and missing dependencies are rejected', () => {
  assert.throws(() => verifyPlan(plan([task('A01', ['B01']), task('B01', ['A01'])])), /依赖环/);
  assert.throws(() => verifyPlan(plan([task('A01', ['B01'])])), /未知依赖/);
});
test('acceptance requires evidence and accepted prerequisites', () => {
  const accepted = { ...task('B01', ['A01']), status: 'accepted' };
  assert.throws(() => verifyPlan(plan([task('A01'), accepted])), /前置 A01 尚未验收/);
  assert.throws(() => verifyPlan(plan([{ ...task('A01'), status: 'accepted' }])), /无证据/);
  assert.throws(() => verifyPlan(plan([{ ...task('A01'), status: 'accepted', evidence: [{}] }])), /证据不完整/);
});

test('final acceptance must transitively include every task', () => {
  assert.throws(() => verifyPlan({ ...plan([task('A01'), task('B01')]), finalTask: 'A01' }), /最终验收未依赖 B01/);
  assert.doesNotThrow(() => verifyPlan({ ...plan([task('A01'), task('B01', ['A01'])]), finalTask: 'B01' }));
});

test('implementation cannot start while a hard prerequisite is unaccepted', () => {
  const pending = plan([task('A01'), { ...task('B01', ['A01']), status: 'in_progress' }]);
  pending.statusLegend.in_progress = '进行中';
  assert.throws(() => verifyPlan(pending), /前置 A01 尚未验收/);
});
