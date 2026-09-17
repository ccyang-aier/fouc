import { describe, expect, test } from 'bun:test';
import { listRows, listTotal, mapPermissions, mapRelations, mapTicketDetail, mapTicketSummary } from './mapper';

describe('DTS response mapping', () => {
  const raw = {
    dtsBizNo: 'DTS2026091400331', sBriefDescription: '灰度发布重构', status: '开发人员实施修改',
    sSeverityNo: '严重', sCurrentHandler: 'yanghao 00013075', creator: 'yanyalun W0017722',
    createAt: '2026-09-14 18:11:09', ticketRemark: '0915：已修复', sProdLineNo: '算力事业部', sProdRNo: 'FusionOne AI',
  };

  test('maps only the summary contract', () => {
    const summary = mapTicketSummary(raw, 'dts-personal');
    expect(summary).toMatchObject({ id: raw.dtsBizNo, title: raw.sBriefDescription, severity: '严重', productPath: ['算力事业部', 'FusionOne AI'] });
    expect(summary?.source.providerId).toBe('dts');
  });

  test('maps object-valued list columns returned by DTS', () => {
    const summary = mapTicketSummary({
      ...raw,
      status: { name: '开发人员实施修改', value: 'DTS009' },
      sSeverityNo: { name: '严重', value: 'Major' },
      sProdLineNo: '算力事业部',
      sProdFamilyNo: 'AI软件及解决方案领域',
    }, 'dts-personal');
    expect(summary).toMatchObject({ status: '开发人员实施修改', severity: '严重' });
    expect(summary?.productPath.slice(0, 2)).toEqual(['算力事业部', 'AI软件及解决方案领域']);
  });

  test('finds rows and totals in nested envelopes', () => {
    const result = { page: { rows: [raw], totalCount: 7 } };
    expect(listRows(result)).toHaveLength(1);
    expect(listTotal(result, 0)).toBe(7);
  });

  test('maps detail, relations and permissions without raw payload leakage', () => {
    const summary = mapTicketSummary(raw, 'dts-personal')!;
    const detail = mapTicketDetail({ ...raw, dtsStatus: '关闭', nodeDatas: [{ nodeId: 'n1', nodeName: '问题提交人填写', status: 'done' }], bizFieldInfos: [{ fieldCode: 'stage', fieldLabel: '发现阶段', fieldValue: 'SIT' }] }, summary, 'dts-personal');
    expect(detail.flowNodes[0]?.name).toBe('问题提交人填写');
    expect(detail.fields).toEqual([{ key: 'stage', label: '发现阶段', value: 'SIT' }]);
    expect(mapRelations({ resultList: [{ dtsNo: 'DTS20260000001' }] }, 'dts-personal')).toHaveLength(1);
    expect(mapPermissions([{ permitInfoList: ['READ', { permitCode: 'COMMENT' }] }])).toEqual(['READ', 'COMMENT']);
  });

  test('uses flow history labels and values for the real detail response shape', () => {
    const summary = mapTicketSummary(raw, 'dts-personal')!;
    const detail = mapTicketDetail({
      dtsStatus: { nodeNo: 'DTS009', nodeName: '开发人员实施修改' },
      currentHandler: 'yanghao 00013075',
      nodeDatas: [{
        nodeName: '问题提交人填写', nodeNo: 'DTS001',
        datas: [{ handler: 'yanyalun W0017722', lastHandleTime: 1_789_380_669_210, data: [
          { fieldId: 'sBriefDescription', name: '简要描述', value: '真实标题' },
          { fieldId: 'sSeverityNo', name: '严重程度', value: 'Major' },
          { fieldId: 'uQbiPhaseFoundNo', name: '问题发现阶段', value: { key: 'sit', name: '系统集成测试(SIT)' } },
        ] }],
      }],
      bizFieldInfos: [{ fieldId: 'uQbiPhaseFoundNo', value: { key: 'sit', name: '系统集成测试(SIT)' } }],
    }, summary, 'dts-personal');
    expect(detail).toMatchObject({ title: '真实标题', status: '开发人员实施修改', severity: '严重' });
    expect(detail.flowNodes[0]).toMatchObject({ id: 'DTS001', handler: 'yanyalun W0017722' });
    expect(detail.fields).toEqual([{ key: 'uQbiPhaseFoundNo', label: '问题发现阶段', value: '系统集成测试(SIT)' }]);
  });
});
