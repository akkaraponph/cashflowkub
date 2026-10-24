// The six "file-type" accent tints: the only chromatic product chrome.
export const TINT_KEYS = ['folder', 'pdf', 'image', 'doc', 'xls', 'video'] as const;
export type TintKey = (typeof TINT_KEYS)[number];

const isTint = (v: string): v is TintKey => (TINT_KEYS as readonly string[]).includes(v);

// Literal class names so Tailwind can see them.
const CLASSES: Record<TintKey, string> = {
  folder: 'bg-type-folder-bg text-type-folder-fg',
  pdf: 'bg-type-pdf-bg text-type-pdf-fg',
  image: 'bg-type-image-bg text-type-image-fg',
  doc: 'bg-type-doc-bg text-type-doc-fg',
  xls: 'bg-type-xls-bg text-type-xls-fg',
  video: 'bg-type-video-bg text-type-video-fg',
};

export function tintClass(key: string | undefined): string {
  return CLASSES[key && isTint(key) ? key : 'doc'];
}

/** CSS color for SVG strokes/fills; follows light/dark automatically. */
export function tintFg(key: string | undefined): string {
  return `var(--type-${key && isTint(key) ? key : 'doc'}-fg)`;
}
