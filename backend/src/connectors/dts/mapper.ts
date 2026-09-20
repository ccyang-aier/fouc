import type { DtsFieldValue, DtsFlowNodeSummary, DtsSeverity, DtsTicketDetail, DtsTicketSummary, ExternalObjectRef } from '@shared/index';

const DTS_ORIGIN = 'https://clouddragon.xfusion.com';
const FIELD_LABELS: Record<string, string> = {
  creator: '创建人', sSubsystemNo: '子系统', iRealityLocateNum: '实际定位人数',
  uDefectOriginDescribe: '问题的原始记录来源说明', uActionNo: '功能', sSuggestion: '处理建议',
  bIsCWorkDept: '问题是否属于合作方', ticketRemark: '备注', sDefectOriginNo: '初始问题单出处和编号',
  sTeamNo: '责任项目组', uRecurrence: '重现类型', sDetailSuggest: '具体意见', sModuleNo: '模块',
  sDeptOneNo: '提出方', bPartFailure: '是否造成器件失效或隐患', uQbiPhaseFoundNo: '问题发现阶段',
  sFeatureNo: '特性', bIsAffectDoc: '是否影响资料', uCommonProblem: '是否共性问题',
};

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function text(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return null;
}

function displayText(value: unknown): string | null {
  const direct = text(value);
  if (direct != null) return direct;
  if (Array.isArray(value)) {
    const values = value.map(displayText).filter((item): item is string => item != null);
    return values.length ? values.join('、') : null;
  }
  const source = object(value);
  for (const key of ['name', 'nodeName', 'nameCn', 'valueName', 'label']) {
    const nested = text(source[key]);
    if (nested != null) return nested;
  }
  return null;
}

function pick(source: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) { const value = displayText(source[key]); if (value != null) return value; }
  return null;
}

function count(source: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const raw = source[key];
    if (raw == null || raw === '') continue;
    const parsed = Number(raw);
    if (Number.isInteger(parsed) && parsed >= 0) return parsed;
  }
  return null;
}

function firstArray(value: unknown, keys: string[]): unknown[] {
  if (Array.isArray(value)) return value;
  const source = object(value);
  for (const key of keys) if (Array.isArray(source[key])) return source[key] as unknown[];
  for (const nested of Object.values(source)) {
    if (nested && typeof nested === 'object') {
      const found = firstArray(nested, keys);
      if (found.length) return found;
    }
  }
  return [];
}

export function mapTicketSummary(raw: unknown, instanceId: string): DtsTicketSummary | null {
  const source = object(raw);
  const id = pick(source, ['dtsBizNo', 'dtsNo', 'ticketNo', 'id']);
  if (!id) return null;
  const productPath = ['sProdLineNo', 'sProdFamilyNo', 'sProdNo', 'sProdVNo', 'sProdRNo', 'sProdCNo', 'sProdLNo', 'sProdBNo']
    .map((key) => text(source[key])).filter((value): value is string => value != null);
  return {
    id,
    title: pick(source, ['sBriefDescription', 'briefDescription', 'title']) ?? id,
    status: pick(source, ['status', 'dtsStatus', 'flowState']) ?? '未知',
    severity: severityLabel(pick(source, ['sSeverityNo', 'severity'])),
    currentHandler: pick(source, ['sCurrentHandler', 'currentHandler', 'last_dts009_handler']),
    creator: pick(source, ['creator', 'submitUser']),
    createdAt: pick(source, ['createAt', 'createTime', 'createdAt']),
    productType: pick(source, ['productType', 'itProduct']),
    productPath,
    remark: pick(source, ['ticketRemark', 'remark']),
    relatedCount: count(source, ['relationCount', 'relatedCount', 'relationNum', 'relationDtsCount']),
    commentCount: count(source, ['commentCount', 'commentNum', 'replyCount', 'discussCount']),
    source: reference(instanceId, id),
  };
}

export function listRows(result: unknown): unknown[] {
  return firstArray(result, ['list', 'rows', 'records', 'data', 'resultList', 'items']);
}

export function listTotal(result: unknown, fallback: number): number {
  const source = object(result);
  const direct = source.total ?? source.totalCount ?? source.count;
  const parsed = Number(direct);
  if (Number.isFinite(parsed)) return parsed;
  for (const nested of Object.values(source)) {
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      const candidate = listTotal(nested, Number.NaN);
      if (Number.isFinite(candidate)) return candidate;
    }
  }
  return fallback;
}

export function mapTicketDetail(raw: unknown, summary: DtsTicketSummary, instanceId: string): DtsTicketDetail {
  const source = object(raw);
  const historicalFields = collectHistoricalFields(source.nodeDatas);
  const historicalValues = Object.fromEntries(historicalFields.map((field) => [pick(field, ['fieldId']) ?? '', field.value]));
  const labels = new Map<string, string | null>(historicalFields.flatMap((field) => {
    const key = pick(field, ['fieldId']);
    return key ? [[key, pick(field, ['name'])] as const] : [];
  }));
  const fields = mapFields(source.bizFieldInfos, labels);
  const flowNodes = firstArray(source.nodeDatas ?? source.activeNodeList, ['nodeDatas', 'activeNodeList']).map(mapFlowNode).filter(Boolean) as DtsFlowNodeSummary[];
  const currentNode = mapFlowNode(source.currentNodeData);
  const currentHandler = pick(source, ['currentHandler']) ?? summary.currentHandler;
  return {
    ...summary,
    title: pick(historicalValues, ['sBriefDescription']) ?? summary.title,
    status: pick(source, ['dtsStatus', 'status']) ?? summary.status,
    severity: severityLabel(pick(historicalValues, ['sSeverityNo'])) ?? summary.severity,
    currentHandler,
    creator: pick(source, ['submitUser']) ?? summary.creator,
    createdAt: pick(source, ['createTime']) ?? summary.createdAt,
    remark: pick(Object.fromEntries(firstArray(source.bizFieldInfos, ['bizFieldInfos']).map((entry) => {
      const field = object(entry);
      return [pick(field, ['fieldId']) ?? '', field.value];
    })), ['ticketRemark']) ?? summary.remark,
    currentNode,
    flowState: pick(source, ['flowState']),
    handlers: currentHandler ? [currentHandler] : [],
    fields,
    flowNodes,
    relations: [],
    permissions: [],
    source: reference(instanceId, summary.id),
  };
}

export function mapRelations(raw: unknown, instanceId: string): ExternalObjectRef[] {
  return firstArray(raw, ['resultList', 'list', 'rows']).map((entry) => {
    const source = object(entry);
    const id = pick(source, ['dtsBizNo', 'dtsNo', 'relationDtsNo', 'ticketNo']);
    return id ? reference(instanceId, id) : null;
  }).filter((value): value is ExternalObjectRef => value != null);
}

export function mapPermissions(raw: unknown): string[] {
  const outer = Array.isArray(raw) ? raw : firstArray(raw, ['resultList', 'list', 'rows']);
  const values = outer.flatMap((value) => {
    const nested = object(value).permitInfoList ?? object(value).permissions;
    return Array.isArray(nested) ? nested : [value];
  });
  return values.map((value) => text(value) ?? pick(object(value), ['permitCode', 'code', 'name', 'permitName']))
    .filter((value): value is string => value != null).slice(0, 100);
}

function mapFields(raw: unknown, labels = new Map<string, string | null>()): DtsFieldValue[] {
  return firstArray(raw, ['bizFieldInfos', 'list']).flatMap((entry, index) => {
    const source = object(entry);
    const key = pick(source, ['fieldId', 'fieldCode', 'fieldName', 'key', 'name']) ?? `field-${index}`;
    const label = pick(source, ['fieldLabel', 'label', 'displayName', 'fieldName']) ?? labels.get(key) ?? FIELD_LABELS[key] ?? key;
    const rawValue = source.fieldValue ?? source.value ?? source.displayValue ?? null;
    const value = typeof rawValue === 'number' || typeof rawValue === 'boolean' ? rawValue : displayText(rawValue);
    if (value == null || value === '') return [];
    return [{ key, label, value }];
  }).slice(0, 80);
}

function mapFlowNode(raw: unknown): DtsFlowNodeSummary | null {
  const source = object(raw);
  const firstData = object(firstArray(source.datas, ['datas'])[0]);
  const name = pick(source, ['nodeName', 'activityName', 'name', 'flowNodeName']);
  if (!name) return null;
  return {
    id: pick(source, ['nodeNo', 'nodeId', 'activityId', 'id']) ?? name,
    name,
    status: pick(source, ['status', 'nodeStatus', 'state']),
    handler: pick(source, ['handler', 'currentHandler', 'lastHandler']) ?? pick(firstData, ['handler']),
    handledAt: formatTimestamp(source.handleTime ?? source.handledAt ?? source.updateTime ?? firstData.lastHandleTime),
  };
}

function collectHistoricalFields(raw: unknown): Record<string, unknown>[] {
  return firstArray(raw, ['nodeDatas']).flatMap((node) => firstArray(object(node).datas, ['datas'])
    .flatMap((entry) => firstArray(object(entry).data, ['data']).map(object)));
}

function formatTimestamp(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return new Date(value).toISOString();
  return text(value);
}

function severityLabel(value: string | null): DtsSeverity | null {
  if (!value) return null;
  return ({ Fatal: '致命', Critical: '严重', Major: '严重', Minor: '一般', Suggestion: '提示',
    致命: '致命', 严重: '严重', 高: '严重', 一般: '一般', 提示: '提示',
    1: '致命', 2: '严重', 3: '一般', 4: '提示' } as Record<string, DtsSeverity>)[value] ?? null;
}

function reference(instanceId: string, id: string): ExternalObjectRef {
  return { connectorInstanceId: instanceId, providerId: 'dts', objectType: 'ticket', externalId: id,
    url: `${DTS_ORIGIN}/dts/DTSPortal/ticket/${encodeURIComponent(id)}` };
}
