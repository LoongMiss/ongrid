// Provider brand logos for the chat input model dropdown. Each component
// renders the brand's official logomark (sourced from simple-icons,
// CC0-licensed) inside a circular brand-coloured badge — same shape as
// the OpenRouter / Poe model lists. Sized via `size` (default 16).

import type { CSSProperties } from 'react';

type ProviderIconProps = {
  size?: number;
  className?: string;
  style?: CSSProperties;
};

// OpenAI — black circle with the official "blossom" knot mark.
// Path data from simple-icons/openai (CC0).
export function OpenAIIcon({ size = 16, className, style }: ProviderIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={className}
      style={style}
      aria-hidden
    >
      <circle cx="16" cy="16" r="16" fill="#000000" />
      <g transform="translate(4 4) scale(1)">
        <path
          fill="#ffffff"
          d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z"
        />
      </g>
    </svg>
  );
}

// Anthropic — peach circle (#D97757, the brand colour) with the official
// stylised "A" mark. Path from simple-icons/anthropic (CC0).
export function AnthropicIcon({ size = 16, className, style }: ProviderIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={className}
      style={style}
      aria-hidden
    >
      <circle cx="16" cy="16" r="16" fill="#d97757" />
      <g transform="translate(4 4) scale(1)">
        <path
          fill="#ffffff"
          d="M17.3041 3.541h-3.6718l6.696 16.918H24Zm-10.6082 0L0 20.459h3.7442l1.3693-3.5527h7.0052l1.3693 3.5528h3.7442L10.5363 3.5409Zm-.3712 10.2232 2.2914-5.9456 2.2914 5.9456Z"
        />
      </g>
    </svg>
  );
}

// Zhipu (智谱 GLM) — black circle with a white "Z" lightning glyph.
// Zhipu's brand mark is heavily Chinese-text driven; simple-icons has no
// entry, so we draw a clean Z stroke that matches their GLM-5 mark.
export function ZhipuIcon({ size = 16, className, style }: ProviderIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={className}
      style={style}
      aria-hidden
    >
      <circle cx="16" cy="16" r="16" fill="#0b0b0b" />
      <path
        d="M10 10h12l-9 12h9"
        fill="none"
        stroke="#ffffff"
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Google Gemini — blue→purple gradient circle with the official 4-point
// sparkle. Path data from simple-icons/googlegemini (CC0). Gradient
// approximates the brand's #4285F4 → #9168C0 transition.
export function GeminiIcon({ size = 16, className, style }: ProviderIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={className}
      style={style}
      aria-hidden
    >
      <defs>
        <linearGradient id="ongrid-gemini-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4285f4" />
          <stop offset="100%" stopColor="#9168c0" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="16" fill="url(#ongrid-gemini-bg)" />
      <g transform="translate(4 4) scale(1)">
        <path
          fill="#ffffff"
          d="M11.04 19.32Q12 21.51 12 24q0-2.49.93-4.68.96-2.19 2.58-3.81t3.81-2.55Q21.51 12 24 12q-2.49 0-4.68-.93a12.3 12.3 0 0 1-3.81-2.58 12.3 12.3 0 0 1-2.58-3.81Q12 2.49 12 0q0 2.49-.96 4.68-.93 2.19-2.55 3.81a12.3 12.3 0 0 1-3.81 2.58Q2.49 12 0 12q2.49 0 4.68.96 2.19.93 3.81 2.55t2.55 3.81"
        />
      </g>
    </svg>
  );
}

// Generic fallback for an unknown provider id — zinc circle, white dot.
export function GenericProviderIcon({ size = 16, className, style }: ProviderIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={className}
      style={style}
      aria-hidden
    >
      <circle cx="16" cy="16" r="16" fill="#52525b" />
      <circle cx="16" cy="16" r="4" fill="#ffffff" />
    </svg>
  );
}

// resolveBrand picks the right brand badge using the model name first
// (so a glm-* model routed through an OpenAI-compatible provider still
// shows the Zhipu badge), falling back to the provider id, then the
// generic dot. Knowing the actual model is more reliable than the
// provider config — many shops bridge non-OpenAI models through an
// OpenAI-compatible gateway.
type Brand = 'openai' | 'anthropic' | 'zhipu' | 'gemini' | 'generic';

function brandFromModel(modelName: string): Brand | null {
  const n = (modelName || '').toLowerCase();
  if (n.startsWith('gpt-') || n.startsWith('o1') || n.startsWith('o3') || n.includes('davinci')) return 'openai';
  if (n.startsWith('claude') || n.startsWith('anthropic')) return 'anthropic';
  if (n.startsWith('glm') || n.startsWith('chatglm') || n.includes('cogview')) return 'zhipu';
  if (n.startsWith('gemini') || n.startsWith('palm') || n.startsWith('bison')) return 'gemini';
  return null;
}

function brandFromProvider(provider: string): Brand {
  switch ((provider || '').toLowerCase()) {
    case 'openai':
      return 'openai';
    case 'anthropic':
    case 'claude':
      return 'anthropic';
    case 'zhipu':
    case 'glm':
    case 'bigmodel':
      return 'zhipu';
    case 'gemini':
    case 'google':
      return 'gemini';
    default:
      return 'generic';
  }
}

function renderBrand(brand: Brand, props: ProviderIconProps) {
  switch (brand) {
    case 'openai':
      return <OpenAIIcon {...props} />;
    case 'anthropic':
      return <AnthropicIcon {...props} />;
    case 'zhipu':
      return <ZhipuIcon {...props} />;
    case 'gemini':
      return <GeminiIcon {...props} />;
    default:
      return <GenericProviderIcon {...props} />;
  }
}

// ProviderIcon dispatches by provider id to the correct badge. Useful
// when only a provider id is in scope (e.g. a settings card header).
export function ProviderIcon({
  provider,
  size = 16,
  className,
  style,
}: {
  provider: string;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return renderBrand(brandFromProvider(provider), { size, className, style });
}

// ModelIcon picks the badge by model name first (handles cases where a
// non-OpenAI model is routed through an OpenAI-compatible gateway), with
// the provider id as a fallback when the model name is generic.
export function ModelIcon({
  model,
  provider,
  size = 16,
  className,
  style,
}: {
  model: string;
  provider?: string;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const brand = brandFromModel(model) ?? brandFromProvider(provider ?? '');
  return renderBrand(brand, { size, className, style });
}
