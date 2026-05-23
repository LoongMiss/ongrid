// Agents page (Phase 1 inventory + Phase 3 user-defined CRUD).
//
// What's here:
//   - List every persona the chatruntime AgentRegistry has loaded —
//     `default` (virtual) + specialist personas (`incident-investigator`,
//     `specialist-sre`, `specialist-ops`, `specialist-network`,
//     `specialist-disk`) + `reviewer` from agents/*.md
//     (Source="disk", read-only), plus user-created ones
//     (Source="user", editable + deletable).
//   - Display order: default → specialists → reviewer → user-defined,
//     so the top of the page reads like a triage rail (start here →
//     specialists → SOP guard → custom).
//   - "新建助理" button → modal with form for name / description /
//     system_prompt / allowed_tools (multi-select from /v1/skills).
//   - Delete button on user-defined cards (confirm modal).
//   - "使用此助理" launches a new chat session pinned to this persona.
//
// The Side Panel will reuse the same /v1/agents data to populate its
// agent switcher dropdown so this stays the single source.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bot,
  MessageSquarePlus,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { Modal } from '@/components/Modal';
import { Button, Card, EmptyState, PageHeader } from '@/components/ui';
import {
  createUserAgent,
  deleteAgent,
  listAgents,
  localizedAgent,
  updateUserAgent,
  type AgentSource,
  type AgentSummary,
  type UserAgentInput,
} from '@/api/agents';
import { listSkills, type SkillSummary } from '@/api/skills';
import { createSession } from '@/api/chat';
import { ApiError } from '@/api/client';
import { tr as trInline, useI18n } from '@/i18n/locale';

export default function AgentsPage() {
  const { tr } = useI18n();
  const [items, setItems] = useState<AgentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<{ mode: 'create' } | { mode: 'edit'; agent: AgentSummary } | null>(null);
  const [deleting, setDeleting] = useState<AgentSummary | null>(null);

  const fetchAgents = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const r = await listAgents();
      setItems((r.items ?? []).map(localizedAgent));
      setErr(null);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = !q
      ? items
      : items.filter(
          (a) =>
            a.name.toLowerCase().includes(q) ||
            (a.description ?? '').toLowerCase().includes(q) ||
            (a.when_to_use ?? '').toLowerCase().includes(q),
        );
    // Built-ins in the curated order (default → specialists → reviewer),
    // then everything else alphabetically. Done client-side so the page
    // doesn't depend on the registry's iteration order.
    return [...matched].sort((a, b) => {
      const ra = builtinRank(a.name);
      const rb = builtinRank(b.name);
      if (ra !== rb) return ra - rb;
      return a.name.localeCompare(b.name);
    });
  }, [items, query]);

  return (
    <main className="anim-fade flex flex-1 flex-col overflow-hidden">
      <PageHeader
        title={tr('助理', 'Assistants')}
        subtitle={tr(`AI 助理库 · 共 ${items.length} 个，已匹配 ${filtered.length}`, `AI assistant library · ${items.length} total, ${filtered.length} matched`)}
        actions={
          <>
            <Button
              onClick={() => fetchAgents(true)}
              disabled={loading || refreshing}
              variant="ghost"
            >
              <RefreshCw size={12} className={cn(refreshing && 'animate-spin')} />
              {tr('刷新', 'Refresh')}
            </Button>
            <Button onClick={() => setEditing({ mode: 'create' })} variant="primary">
              <Plus size={12} /> {tr('新建助理', 'New assistant')}
            </Button>
          </>
        }
      />

      <div className="border-b border-zinc-800/60 px-6 py-2.5">
        <label className="relative block w-72">
          <span className="sr-only">{tr('搜索', 'Search')}</span>
          <Search size={12} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tr('搜索 name / description', 'Search name / description')}
            className="w-full rounded-md border border-zinc-800/60 bg-zinc-950/40 py-1.5 pl-8 pr-2 text-xs text-zinc-200 placeholder:text-zinc-500 focus:border-zinc-700 focus:outline-none"
          />
        </label>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        {err && (
          <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/5 px-4 py-3 text-sm text-red-300">
            {tr('加载失败：', 'Load failed: ')}{err}
          </div>
        )}
        {loading ? (
          <div className="flex h-40 items-center justify-center text-sm text-zinc-500">{tr('加载中…', 'Loading…')}</div>
        ) : filtered.length === 0 ? (
          <AgentsEmpty hasItems={items.length > 0} onCreate={() => setEditing({ mode: 'create' })} />
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((a) => (
              <AgentCard
                key={a.name}
                agent={a}
                onEdit={() => setEditing({ mode: 'edit', agent: a })}
                onDelete={() => setDeleting(a)}
              />
            ))}
          </div>
        )}
      </div>

      {editing && (
        <AgentEditor
          mode={editing.mode}
          existing={editing.mode === 'edit' ? editing.agent : null}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void fetchAgents(true);
          }}
        />
      )}
      {deleting && (
        <DeleteAgentDialog
          agent={deleting}
          onClose={() => setDeleting(null)}
          onDone={() => {
            setDeleting(null);
            void fetchAgents(true);
          }}
        />
      )}
    </main>
  );
}

// SHORT_LABELS — short Chinese display name per built-in persona id.
// Mirrors web/src/components/AgentBadge.tsx so card titles + sidebar
// chips stay aligned. Add new entries when shipping new personas.
const SHORT_LABELS_ZH: Record<string, string> = {
  default: '默认助理',
  'incident-investigator': '故障诊断',
  'specialist-sre': 'SRE 专家',
  'specialist-ops': '运维专家',
  'specialist-compute': '计算专家',
  'specialist-network': '网络专家',
  'specialist-disk': '磁盘专家',
  reviewer: '审核员',
};

const SHORT_LABELS_EN: Record<string, string> = {
  default: 'Default',
  'incident-investigator': 'Incident investigator',
  'specialist-sre': 'SRE specialist',
  'specialist-ops': 'Ops specialist',
  'specialist-compute': 'Compute specialist',
  'specialist-network': 'Network specialist',
  'specialist-disk': 'Disk specialist',
  reviewer: 'Reviewer',
};

// BUILTIN_ORDER drives the display order on /agents. The three
// resource-domain specialists (compute / network / disk) cluster
// together after the SRE / Ops "what's the situation" pair, so a
// scroll-pass reads like a triage rail: triage → ops decision →
// resource drilldown → SOP guard.
const BUILTIN_ORDER: string[] = [
  'default',
  'incident-investigator',
  'specialist-sre',
  'specialist-ops',
  'specialist-compute',
  'specialist-network',
  'specialist-disk',
  'reviewer',
];

function builtinRank(name: string): number {
  const idx = BUILTIN_ORDER.indexOf(name);
  return idx === -1 ? BUILTIN_ORDER.length : idx;
}

const SHORT_LABELS = new Proxy({} as Record<string, string>, {
  get: (_t, key: string) => {
    const zh = SHORT_LABELS_ZH[key];
    if (zh == null) return undefined;
    return trInline(zh, SHORT_LABELS_EN[key] ?? zh);
  },
});

function AgentCard({
  agent,
  onEdit,
  onDelete,
}: {
  agent: AgentSummary;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { tr } = useI18n();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const toolCount = agent.tools?.length ?? 0;
  const isUser = agent.source === 'user';
  const canDelete = agent.source !== 'builtin' && agent.name !== 'default';
  // Short Chinese display name. Mirrors AgentBadge's mapping; falls
  // back to the ascii name for unknown personas (e.g. user-created).
  // Description was used as the title before but it's a full sentence
  // and made cards look noisy — we now show a short label and let the
  // description live in the card body as a 2-line teaser.
  const displayName = SHORT_LABELS[agent.name] ?? agent.name;

  const onUse = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const title = tr(`使用 ${agent.name} - 新会话`, `Using ${agent.name} - new session`).slice(0, 60);
      const session = await createSession({ title, agent_id: agent.name });
      navigate(`/chat/${session.id}`);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : (e as Error).message);
      setBusy(false);
    }
  }, [agent.name, busy, navigate]);

  return (
    <Card className="flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-indigo-500/20 text-indigo-300 ring-1 ring-inset ring-indigo-500/40">
            <Bot size={14} />
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-zinc-100" title={agent.name}>
              {displayName}
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-zinc-500">
              <span className="font-mono normal-case tracking-normal text-zinc-600">
                {agent.name}
              </span>
              <span>·</span>
              <SourceLabel source={agent.source} />
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {isUser && (
            <button
              type="button"
              onClick={onEdit}
              title={tr('编辑', 'Edit')}
              className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
            >
              <Pencil size={11} />
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={onDelete}
              title={isUser ? tr('删除', 'Delete') : tr('从助理列表中移除（重启后内置 persona 会自动加载回来）', 'Remove from the list (built-in personas reload automatically on restart)')}
              className="rounded p-1 text-zinc-500 hover:bg-red-900/30 hover:text-red-300"
            >
              <Trash2 size={11} />
            </button>
          )}
          <button
            type="button"
            onClick={() => void onUse()}
            disabled={busy}
            title={tr('用此助理开新会话', 'Start a new session with this assistant')}
            className="ml-1 inline-flex items-center gap-1 rounded-md border border-indigo-500/40 bg-indigo-500/10 px-2 py-1 text-[11px] text-indigo-200 hover:bg-indigo-500/20 disabled:opacity-50"
          >
            <MessageSquarePlus size={11} />
            {busy ? tr('创建中…', 'Creating…') : tr('使用此助理', 'Use this')}
          </button>
        </div>
      </div>
      {err && <div className="mt-2 text-[11px] text-red-300">{err}</div>}
      {agent.description && (
        <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-zinc-400">
          {agent.description}
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-500">
        <span>{toolCount > 0 ? tr(`${toolCount} 个工具`, `${toolCount} tool(s)`) : tr('继承全部工具', 'Inherits all tools')}</span>
        {agent.permission_mode === 'read-only' && (
          <>
            <span className="text-zinc-700">·</span>
            <span className="text-emerald-400">{tr('只读', 'Read-only')}</span>
          </>
        )}
      </div>
    </Card>
  );
}

function SourceLabel({ source }: { source?: AgentSource }) {
  const { tr } = useI18n();
  if (source === 'user') return <span className="text-violet-300">{tr('自定义', 'Custom')}</span>;
  if (source === 'builtin') return <span className="text-emerald-300">{tr('系统内置', 'Built-in')}</span>;
  if (source === 'disk') return <span>{tr('预置', 'Preset')}</span>;
  return <span>{tr('预置', 'Preset')}</span>;
}


function AgentsEmpty({ hasItems, onCreate }: { hasItems: boolean; onCreate: () => void }) {
  const { tr } = useI18n();
  return (
    <EmptyState
      icon={Users}
      title={hasItems ? tr('没有匹配的助理', 'No matching assistants') : tr('还没有助理注册', 'No assistants registered yet')}
      action={
        !hasItems && (
          <Button variant="primary" onClick={onCreate}>
            <Plus size={12} /> {tr('新建助理', 'New assistant')}
          </Button>
        )
      }
    />
  );
}

// AgentEditor is the create + edit form modal. Reused by both flows;
// `existing` is null for create, the row for edit (Name field then
// becomes read-only since name is the immutable identifier).
function AgentEditor({
  mode,
  existing,
  onClose,
  onSaved,
}: {
  mode: 'create' | 'edit';
  existing: AgentSummary | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { tr } = useI18n();
  const [name, setName] = useState(existing?.name ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [whenToUse, setWhenToUse] = useState(existing?.when_to_use ?? '');
  const [systemPrompt, setSystemPrompt] = useState(existing?.system_prompt ?? '');
  const [allowedTools, setAllowedTools] = useState<string[]>(existing?.tools ?? []);
  const [model, setModel] = useState(existing?.model ?? '');
  const [maxTurns, setMaxTurns] = useState<number>(existing?.max_turns ?? 0);
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void listSkills().then((r) => setSkills(r.items ?? [])).catch(() => setSkills([]));
  }, []);

  const submit = async () => {
    setErr(null);
    setSubmitting(true);
    try {
      const input: UserAgentInput = {
        name: mode === 'create' ? name.trim() : undefined,
        description: description.trim(),
        when_to_use: whenToUse.trim() || undefined,
        system_prompt: systemPrompt.trim(),
        allowed_tools: allowedTools.length > 0 ? allowedTools : undefined,
        model: model.trim() || undefined,
        max_turns: maxTurns > 0 ? maxTurns : undefined,
      };
      if (mode === 'create') {
        await createUserAgent(input);
      } else {
        await updateUserAgent(existing!.name, input);
      }
      onSaved();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleTool = (key: string) => {
    setAllowedTools((cur) =>
      cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key],
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={mode === 'create' ? tr('新建助理', 'New assistant') : tr(`编辑 ${existing?.name}`, `Edit ${existing?.name}`)}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
          >
            {tr('取消', 'Cancel')}
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={
              submitting ||
              (mode === 'create' && name.trim() === '') ||
              description.trim() === '' ||
              systemPrompt.trim() === ''
            }
            className="rounded-md bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-900 hover:bg-white disabled:opacity-50"
          >
            {submitting ? tr('保存中…', 'Saving…') : tr('保存', 'Save')}
          </button>
        </>
      }
    >
      <div className="space-y-4 text-xs text-zinc-300">
        {err && (
          <div className="rounded-md border border-red-500/40 bg-red-500/5 px-3 py-2 text-red-300">
            {err}
          </div>
        )}

        <Field label={tr('名称', 'Name')} required>
          <input
            type="text"
            value={name}
            disabled={mode === 'edit'}
            onChange={(e) => setName(e.target.value)}
            placeholder={tr('lower_snake 或 kebab-case，例如 my_db_assistant', 'lower_snake or kebab-case, e.g. my_db_assistant')}
            className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1.5 font-mono text-xs text-zinc-100 disabled:opacity-50 focus:border-zinc-600 focus:outline-none"
            maxLength={64}
          />
          <div className="mt-1 text-[11px] text-zinc-500">
            {tr('创建后不能改名。', 'Cannot rename after creation.')}
          </div>
        </Field>

        <Field label={tr('描述', 'Description')} required>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={tr('一句话说清这个助理擅长什么', 'One sentence on what this assistant is good at')}
            className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-100 focus:border-zinc-600 focus:outline-none"
            maxLength={512}
          />
        </Field>

        <Field label={tr('何时使用', 'When to use')}>
          <textarea
            value={whenToUse}
            onChange={(e) => setWhenToUse(e.target.value)}
            placeholder={tr('给 coordinator 的判断线索：什么场景把任务派给这个助理', 'Hint for the coordinator: when to delegate to this assistant')}
            className="h-20 w-full resize-y rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-100 focus:border-zinc-600 focus:outline-none"
          />
        </Field>

        <Field label={tr('系统提示', 'System prompt')} required>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder={tr('你是 X 专家，遇到 Y 类问题先做 Z...', 'You are an X expert; when seeing a Y problem, first do Z...')}
            className="h-32 w-full resize-y rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1.5 font-mono text-xs text-zinc-100 focus:border-zinc-600 focus:outline-none"
          />
        </Field>

        <Field label={tr('允许使用的工具', 'Allowed tools')}>
          <div className="text-[11px] text-zinc-500 mb-1">
            {tr('留空 = 继承 coordinator 的全部工具', 'Empty = inherit all coordinator tools')}
          </div>
          {skills.length === 0 ? (
            <div className="text-[11px] text-zinc-500">{tr('加载工具列表中…', 'Loading tool list…')}</div>
          ) : (
            <div className="max-h-48 overflow-y-auto rounded-md border border-zinc-800 bg-zinc-950/40 p-2">
              <div className="grid grid-cols-2 gap-1">
                {skills.map((s) => (
                  <label
                    key={s.key}
                    className="flex items-center gap-1.5 rounded px-1.5 py-1 text-[11px] hover:bg-zinc-900/60"
                  >
                    <input
                      type="checkbox"
                      checked={allowedTools.includes(s.key)}
                      onChange={() => toggleTool(s.key)}
                      className="h-3 w-3 accent-indigo-500"
                    />
                    <span className="font-mono">{s.key}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="mt-1 text-[11px] text-zinc-500">
            {tr(`已选 ${allowedTools.length} / ${skills.length}`, `Selected ${allowedTools.length} / ${skills.length}`)}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={tr('模型', 'Model')}>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder={tr('留空 = 继承', 'Empty = inherit')}
              className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-100 focus:border-zinc-600 focus:outline-none"
            />
          </Field>
          <Field label={tr('最大轮数', 'Max turns')}>
            <input
              type="number"
              value={maxTurns || ''}
              onChange={(e) => setMaxTurns(parseInt(e.target.value, 10) || 0)}
              placeholder={tr('留空 = 继承', 'Empty = inherit')}
              min={0}
              max={100}
              className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-100 focus:border-zinc-600 focus:outline-none"
            />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1 text-[11px] font-medium uppercase tracking-wider text-zinc-400">
        {label}
        {required && <span className="ml-0.5 text-red-400">*</span>}
      </div>
      {children}
    </label>
  );
}

function DeleteAgentDialog({
  agent,
  onClose,
  onDone,
}: {
  agent: AgentSummary;
  onClose: () => void;
  onDone: () => void;
}) {
  const { tr } = useI18n();
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setSubmitting(true);
    setErr(null);
    try {
      await deleteAgent(agent.name);
      onDone();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={tr(`删除助理 ${agent.name}`, `Delete assistant ${agent.name}`)}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
          >
            {tr('取消', 'Cancel')}
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={submitting}
            className="rounded-md bg-red-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600 disabled:opacity-50"
          >
            {submitting ? tr('删除中…', 'Deleting…') : tr('删除', 'Delete')}
          </button>
        </>
      }
    >
      <div className="text-xs text-zinc-300">
        {err && (
          <div className="mb-3 rounded-md border border-red-500/40 bg-red-500/5 px-3 py-2 text-red-300">
            {err}
          </div>
        )}
        <p>
          {tr('确定删除自定义助理 ', 'Delete custom assistant ')}<span className="font-mono text-zinc-100">{agent.name}</span>?
        </p>
        <p className="mt-2 text-zinc-500">
          {tr(
            '已经用此助理建过的会话不会被删除——它们会回退到默认 coordinator 继续运行。',
            "Sessions already created with this assistant are kept — they fall back to the default coordinator.",
          )}
        </p>
      </div>
    </Modal>
  );
}
