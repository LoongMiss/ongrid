import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { KeyRound, Check, Loader2 } from 'lucide-react';
import type { InstalledPack, CredentialSlotRecord } from '@/api/marketplace';
import { setPackBindings } from '@/api/marketplace';
import { listSecrets, type SecretView } from '@/api/secrets';
import { Button } from '@/components/ui';
import { useI18n } from '@/i18n/locale';

// CredentialBindings — HLD-017 design-time credential binding. Renders one
// "pick a credential" row per slot the pack's skills declare
// (capabilities.summary.credential_slots) and persists the operator's
// slot→credential-name choices via PUT /marketplace/installed/{id}/bindings.
// At exec time the manager resolves the bound credential's TYPE inject rule.
// Additive: returns null when the pack declares no credential slots, so the
// rest of the marketplace UI is untouched.
export function CredentialBindings({
  pack,
  isAdmin,
  onSaved,
}: {
  pack: InstalledPack;
  isAdmin: boolean;
  onSaved?: () => void;
}) {
  const { tr } = useI18n();
  const slots: CredentialSlotRecord[] = pack.capabilities?.summary?.credential_slots ?? [];
  const [secrets, setSecrets] = useState<SecretView[]>([]);
  const [sel, setSel] = useState<Record<string, string>>({ ...pack.bindings });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    listSecrets()
      .then((r) => {
        if (alive) setSecrets(r.items ?? []);
      })
      .catch(() => {
        /* empty / unauthorized — the "no credentials" hint covers it */
      });
    return () => {
      alive = false;
    };
  }, []);

  // Re-sync local selection when the pack's persisted bindings change (e.g.
  // after a parent reload following a save).
  const bindingsKey = JSON.stringify(pack.bindings);
  useEffect(() => {
    setSel({ ...pack.bindings });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pack.pack_id, bindingsKey]);

  if (slots.length === 0) return null;

  const dirty = JSON.stringify(sel) !== bindingsKey;

  const save = async () => {
    setSaving(true);
    setErr(null);
    try {
      const clean: Record<string, string> = {};
      for (const [k, v] of Object.entries(sel)) {
        if (v) clean[k] = v;
      }
      await setPackBindings(pack.pack_id, clean);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      onSaved?.();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3 rounded-md border border-zinc-800/80 bg-zinc-950/40 p-3">
      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
        <KeyRound size={12} className="text-amber-400" />
        {tr('凭证绑定', 'Credential bindings')}
      </div>
      <p className="mb-2.5 text-[11px] text-zinc-500">
        {tr(
          '为该技能声明的每个凭证槽位选择凭证库里的凭证；执行时按绑定自动注入环境变量。',
          'Pick a stored credential for each slot this skill declares; it is injected as env vars at exec time.',
        )}
      </p>
      {secrets.length === 0 ? (
        <div className="text-[11px] text-zinc-500">
          {tr('凭证库还是空的，先去', 'No credentials yet — ')}
          <Link to="/settings/secrets" className="mx-1 text-blue-400 hover:underline">
            {tr('创建凭证', 'create one')}
          </Link>
          {tr('再回来绑定。', 'first, then bind here.')}
        </div>
      ) : (
        <div className="space-y-2">
          {slots.map((s) => (
            <div key={s.slot} className="flex flex-wrap items-center gap-2">
              <div className="min-w-[140px]">
                <div className="text-xs text-zinc-200">{s.label || s.slot}</div>
                {s.fields && s.fields.length > 0 && (
                  <div className="font-mono text-[10px] text-zinc-500">{s.fields.join(', ')}</div>
                )}
              </div>
              <select
                value={sel[s.slot] ?? ''}
                disabled={!isAdmin}
                onChange={(e) => setSel((m) => ({ ...m, [s.slot]: e.target.value }))}
                className="min-w-[200px] rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 disabled:opacity-50"
              >
                <option value="">{tr('（未绑定）', '(unbound)')}</option>
                {secrets.map((sec) => (
                  <option key={sec.id} value={sec.name}>
                    {sec.name} · {sec.type}
                  </option>
                ))}
              </select>
            </div>
          ))}
          {err && <div className="text-[11px] text-red-400">{err}</div>}
          <div className="flex items-center gap-2 pt-1">
            <Button onClick={() => void save()} disabled={!isAdmin || saving || !dirty} variant="primary">
              {saving ? (
                <Loader2 size={12} className="animate-spin" />
              ) : saved ? (
                <Check size={12} />
              ) : null}
              {saved ? tr('已保存', 'Saved') : tr('保存绑定', 'Save bindings')}
            </Button>
            {!isAdmin && <span className="text-[11px] text-zinc-500">{tr('需要 admin 权限', 'Admin only')}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
