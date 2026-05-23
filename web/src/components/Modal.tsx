import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useI18n } from '@/i18n/locale';

type Props = {
  open: boolean;
  onClose(): void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
};

export function Modal({ open, onClose, title, children, footer, size = 'md' }: Props) {
  const { tr } = useI18n();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title ?? 'Dialog'}
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
    >
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      {/* Bound the panel to viewport: max-h-[90vh] keeps header / footer
          on screen, flex column lets the middle body absorb the
          remainder and scroll on overflow. Without this the panel grew
          taller than the viewport and (because body scroll is locked
          while the modal is open) the user had no way to reach lower
          content — affecting any modal whose form / content is long
          (rule editor, doc editor, plugin spec, etc.). */}
      <div
        className={cn(
          'anim-scale relative flex max-h-[90vh] w-full flex-col rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl',
          size === 'sm' && 'max-w-sm',
          size === 'md' && 'max-w-md',
          size === 'lg' && 'max-w-2xl',
          size === 'xl' && 'max-w-4xl'
        )}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-5 py-3.5">
          <h2 className="text-sm font-semibold text-zinc-100">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={tr('关闭', 'Close')}
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          >
            <X size={16} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-zinc-800 px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
