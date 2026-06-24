// toolSkill — the single source of truth for grouping tools into skills.
//
// A "skill" here is the organising layer above atomic tools (the node /
// execution model is unchanged): it just answers "which group does this tool
// belong to". Both the workflow tool palette (FlowEditor) and the Skills page
// group by this one function — there is no separate "category" / CATEGORY_ORDER
// concept anymore.
//
// MCP tools group by their server (each server is its own bundle, e.g. the
// k8s server = the k8s tools). Built-in tools map by name into 6 curated
// skills; anything unmatched falls to "other".

export const SKILL_ORDER = ['observe', 'device', 'fleet', 'incident', 'knowledge', 'cloud'] as const;

const SKILL_LABEL: Record<string, { zh: string; en: string }> = {
  observe: { zh: '观测', en: 'Observability' },
  device: { zh: '设备管理', en: 'Devices' },
  fleet: { zh: '集群与拓扑', en: 'Fleet & topology' },
  incident: { zh: '告警与事件', en: 'Incidents & alerts' },
  knowledge: { zh: '知识', en: 'Knowledge' },
  cloud: { zh: '云端管理', en: 'Cloud' },
  other: { zh: '其他', en: 'Other' },
};

// toolSkill returns the skill group key for a tool name.
export function toolSkill(name: string): string {
  if (name.startsWith('mcp__')) return 'mcp:' + (name.split('__')[1] || 'mcp');
  if (/^(get_)?host_/.test(name) || name.includes('restart_service')) return 'device';
  if (/^query_(promql|logql|traceql)$/.test(name) || name === 'list_metric_catalog' || name === 'list_database_sources' || name === 'analyze_database_status') return 'observe';
  if (name.includes('topology') || name === 'query_devices' || name === 'query_edges' || name === 'rank_edges' || name === 'find_outlier_edges' || name === 'get_edge_summary') return 'fleet';
  if (name.includes('incident') || name.includes('alert') || name === 'query_change_events') return 'incident';
  if (name === 'query_knowledge' || name.includes('source')) return 'knowledge';
  if (name === 'cloud_bash' || name.includes('config_change')) return 'cloud';
  return 'other';
}

// skillLabel resolves a skill key to a display label. MCP server groups are
// dynamic ("MCP · <server>"); the curated skills use the fixed map.
export function skillLabel(key: string, zh: boolean): string {
  if (key.startsWith('mcp:')) return 'MCP · ' + key.slice(4);
  const l = SKILL_LABEL[key];
  return l ? (zh ? l.zh : l.en) : key;
}

// orderedSkillKeys returns the present skill keys in display order: the 6
// curated skills first (fixed order), then MCP server groups (alphabetical),
// then any remaining (e.g. "other") — so nothing is ever dropped.
export function orderedSkillKeys(present: Iterable<string>): string[] {
  const set = new Set(present);
  const curated = SKILL_ORDER.filter((k) => set.has(k));
  const mcp = [...set].filter((k) => k.startsWith('mcp:')).sort();
  const rest = [...set].filter((k) => !curated.includes(k as (typeof SKILL_ORDER)[number]) && !k.startsWith('mcp:')).sort();
  return [...curated, ...mcp, ...rest];
}
