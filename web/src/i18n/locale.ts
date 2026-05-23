// locale.ts — UI language. Adopts the liaison-cloud pattern: bilingual
// strings live inline at the call site via `tr('中文', 'English')` and
// `setLocale()` dispatches a window event so `useI18n()` consumers
// re-render. Storage is localStorage; no zustand needed for this.
//
// Why inline (instead of a key-based dictionary):
//   - 0 maintenance — the strings ARE the translation pair
//   - obvious from a glance whether a string is bilingual
//   - greppable: `tr\('` for total, `tr\('[^']+', *''\)` for missing-en
//   - zero bundle cost beyond the strings themselves
//
// API mirrors liaison-cloud/web/src/i18n/index.ts so patterns transfer
// between repos.

import { useCallback, useEffect, useMemo, useState } from 'react';

export type Locale = 'zh-CN' | 'en-US';

const LOCALE_STORAGE_KEY = 'ongrid-locale';
const LOCALE_CHANGE_EVENT = 'ongrid-locale-change';

export const getLocale = (): Locale => {
  if (typeof localStorage === 'undefined') return 'zh-CN';
  const v = localStorage.getItem(LOCALE_STORAGE_KEY);
  return v === 'en-US' ? 'en-US' : 'zh-CN';
};

export const setLocale = (locale: Locale): void => {
  localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  window.dispatchEvent(new CustomEvent<Locale>(LOCALE_CHANGE_EVENT, { detail: locale }));
  // Reflect on <html lang> too for screen readers + browser hyphenation.
  document.documentElement.lang = locale;
};

// tr is the standalone translator. Use for non-React paths (e.g. module-
// level constants); components should prefer useI18n() so they re-render
// on locale change.
export const tr = (zh: string, en: string): string => (getLocale() === 'en-US' ? en : zh);

export const useI18n = () => {
  const [locale, setLocaleState] = useState<Locale>(getLocale());

  useEffect(() => {
    const listener = (e: Event) => {
      const ce = e as CustomEvent<Locale>;
      setLocaleState(ce.detail || getLocale());
    };
    window.addEventListener(LOCALE_CHANGE_EVENT, listener as EventListener);
    return () => window.removeEventListener(LOCALE_CHANGE_EVENT, listener as EventListener);
  }, []);

  const toggleLocale = useCallback(() => {
    setLocale(locale === 'zh-CN' ? 'en-US' : 'zh-CN');
  }, [locale]);

  const translator = useMemo(
    () => (zh: string, en: string) => (locale === 'en-US' ? en : zh),
    [locale],
  );

  return { locale, tr: translator, toggleLocale, setLocale };
};
