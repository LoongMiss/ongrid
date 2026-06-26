// Pages — operations view for hosted "artifacts": the HTML pages the agent /
// workflows generate via serve_page. Card grid with a live thumbnail of each
// page, plus open / preview / delete. Page content is served publicly by token
// at /api/pages/<id>; thumbnails + previews render in a sandboxed iframe
// (scripts disabled, opaque origin) so an LLM-generated page can never touch the
// SPA's session.
import { useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink, Eye, Loader2, Search, Trash2 } from 'lucide-react';

import { deletePage, listPages, type HostedPage } from '@/api/pages';
import { useI18n } from '@/i18n/locale';
import { useAuth } from '@/store/auth';
import { PageHeader, Button, EmptyState } from '@/components/ui';
import { Modal } from '@/components/Modal';

// THUMB_W is the logical desktop width we render each page at before scaling it
// down — so the thumbnail shows the desktop layout, not a mobile reflow.
const THUMB_W = 1100;

// PageThumb renders a hosted page as a scaled-down live thumbnail. We measure the
// card width and scale a desktop-width iframe to fit; the iframe is sandboxed +
// pointer-events-none so it's a static picture, not an interactive surface.
function PageThumb({ url }: { url: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.3);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      if (el.clientWidth > 0) setScale(el.clientWidth / THUMB_W);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className="relative h-40 w-full overflow-hidden bg-white">
      <iframe
        title="thumbnail"
        src={url}
        sandbox=""
        tabIndex={-1}
        scrolling="no"
        loading="lazy"
        className="pointer-events-none absolute left-0 top-0 origin-top-left border-0"
        style={{ width: THUMB_W, height: 900, transform: `scale(${scale})` }}
      />
    </div>
  );
}

export default function PagesPage() {
  const { tr } = useI18n();
  const role = useAuth((s) => s.role);
  const canWrite = role !== 'viewer';

  const [items, setItems] = useState<HostedPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [preview, setPreview] = useState<HostedPage | null>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await listPages();
      setItems(r.items ?? []);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onDelete = async (p: HostedPage) => {
    if (!window.confirm(tr(`删除页面「${p.title || p.id}」？链接将立即失效。`, `Delete page "${p.title || p.id}"? Its link dies immediately.`))) return;
    setBusyId(p.id);
    try {
      await deletePage(p.id);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  };

  const relTime = (iso: string) => {
    if (!iso) return '—';
    const sec = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (sec < 60) return tr('刚刚', 'just now');
    const m = Math.floor(sec / 60);
    if (m < 60) return tr(`${m} 分钟前`, `${m}m ago`);
    const h = Math.floor(m / 60);
    if (h < 24) return tr(`${h} 小时前`, `${h}h ago`);
    const d = Math.floor(h / 24);
    if (d < 30) return tr(`${d} 天前`, `${d}d ago`);
    return new Date(iso).toLocaleDateString();
  };

  const shown = items.filter((p) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (p.title ?? '').toLowerCase().includes(q) || p.id.includes(q);
  });

  return (
    <main className="anim-fade flex flex-1 flex-col overflow-hidden">
      <PageHeader
        title={tr('产物', 'Artifacts')}
        subtitle={tr(
          `Agent 与工作流通过 serve_page 生成的网页 · 共 ${items.length} 个`,
          `Web pages the agent & workflows generate via serve_page · ${items.length} total`,
        )}
      />
      {items.length > 0 && (
        <div className="border-b border-zinc-800 px-6 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <label className="relative block w-64">
              <span className="sr-only">{tr('搜索', 'Search')}</span>
              <Search size={12} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={tr('搜索页面…', 'Search pages…')}
                className="w-full rounded-md border border-zinc-800 bg-zinc-950/40 py-1.5 pl-8 pr-2 text-xs text-zinc-200 placeholder:text-zinc-500 focus:border-zinc-600 focus:outline-none"
              />
            </label>
            <span className="ml-auto text-xs text-zinc-500">
              {tr(`${items.length} 个 · 匹配 ${shown.length}`, `${items.length} total · ${shown.length} matched`)}
            </span>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {error && (
          <div className="mb-4 rounded-md border border-red-900/50 bg-red-950/30 px-3 py-2 text-xs text-red-400">{error}</div>
        )}
        {loading ? (
          <div className="py-16 text-center text-xs text-zinc-500">{tr('加载中…', 'Loading…')}</div>
        ) : items.length === 0 ? (
          <EmptyState
            title={tr('还没有生成的页面', 'No generated pages yet')}
            hint={tr('让工作流或助理用 serve_page 生成一个网页报告，它会出现在这里。', 'Have a workflow or the assistant generate a web report via serve_page — it shows up here.')}
            className="flex flex-col items-center gap-2 py-20 text-center"
          />
        ) : shown.length === 0 ? (
          <div className="py-16 text-center text-xs text-zinc-500">{tr('无匹配的页面', 'No matching pages')}</div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {shown.map((p) => (
              <div
                key={p.id}
                className="group flex flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40 transition-colors hover:border-zinc-700"
              >
                <button
                  type="button"
                  onClick={() => setPreview(p)}
                  className="relative block w-full border-b border-zinc-800 text-left"
                  title={tr('预览', 'Preview')}
                >
                  <PageThumb url={p.url} />
                  <span className="absolute inset-0 flex items-center justify-center bg-zinc-950/0 opacity-0 transition-opacity group-hover:bg-zinc-950/30 group-hover:opacity-100">
                    <span className="inline-flex items-center gap-1 rounded-md bg-zinc-900/90 px-2.5 py-1 text-xs font-medium text-zinc-100 ring-1 ring-inset ring-zinc-700">
                      <Eye size={13} /> {tr('预览', 'Preview')}
                    </span>
                  </span>
                </button>
                <div className="flex flex-1 flex-col gap-2 p-3">
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-medium text-zinc-200" title={p.title}>
                      {p.title || tr('（未命名页面）', '(untitled page)')}
                    </div>
                    <div className="mt-0.5 text-[11px] text-zinc-500">{relTime(p.created_at)}</div>
                  </div>
                  <div className="mt-auto flex items-center gap-1.5">
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
                    >
                      <ExternalLink size={13} /> {tr('打开', 'Open')}
                    </a>
                    {canWrite && (
                      <Button
                        variant="danger"
                        onClick={() => void onDelete(p)}
                        disabled={busyId === p.id}
                        className="ml-auto whitespace-nowrap"
                      >
                        {busyId === p.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {preview && (
        <Modal open onClose={() => setPreview(null)} size="lg" title={preview.title || tr('页面预览', 'Page preview')}>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[11px] text-zinc-500">
              <span className="truncate font-mono">{preview.url}</span>
              <a href={preview.url} target="_blank" rel="noreferrer" className="ml-auto inline-flex shrink-0 items-center gap-1 text-indigo-400 hover:text-indigo-300">
                <ExternalLink size={11} /> {tr('新标签打开', 'Open in new tab')}
              </a>
            </div>
            <iframe
              title={preview.title || 'page'}
              src={preview.url}
              sandbox=""
              className="h-[60vh] w-full rounded-md border border-zinc-800 bg-white"
            />
          </div>
        </Modal>
      )}
    </main>
  );
}
