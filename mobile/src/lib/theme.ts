// JS-side theme values for cases NativeWind classes can't cover: the hero/brand
// gradients (expo-linear-gradient needs concrete color arrays) and the file-type
// tint hexes (for chart fills / SVG where we can't use a className).

export type TintKey = 'folder' | 'pdf' | 'image' | 'doc' | 'xls' | 'video';
export type Mode = 'light' | 'dark';

interface Tint {
  bg: string;
  fg: string;
}

export const TINTS: Record<Mode, Record<TintKey, Tint>> = {
  light: {
    folder: { bg: '#fef9c3', fg: '#ca8a04' },
    pdf: { bg: '#fee2e2', fg: '#dc2626' },
    image: { bg: '#f3e8ff', fg: '#9333ea' },
    doc: { bg: '#dbeafe', fg: '#2563eb' },
    xls: { bg: '#dcfce7', fg: '#16a34a' },
    video: { bg: '#fce7f3', fg: '#db2777' },
  },
  dark: {
    folder: { bg: '#3a3416', fg: '#facc15' },
    pdf: { bg: '#3a1c1c', fg: '#f87171' },
    image: { bg: '#2e1f3e', fg: '#c084fc' },
    doc: { bg: '#1c2a44', fg: '#60a5fa' },
    xls: { bg: '#14321f', fg: '#4ade80' },
    video: { bg: '#3a1f30', fg: '#f472b6' },
  },
};

export function tint(key: string, mode: Mode): Tint {
  return TINTS[mode][(key as TintKey)] ?? TINTS[mode].doc;
}

// Hero (large emerald panels) + brand (logo mark) gradients per mode.
export const HERO: Record<Mode, { from: string; to: string; fg: string; solid: string }> = {
  light: { from: '#12835d', to: '#094f3b', fg: '#f1faf5', solid: '#0a523c' },
  dark: { from: '#10805b', to: '#0a5640', fg: '#eefaf4', solid: '#0a5640' },
};

export const BRAND: Record<Mode, { from: string; to: string }> = {
  light: { from: '#1a9c6a', to: '#0b5c43' },
  dark: { from: '#1fae77', to: '#0c6b4e' },
};

// Semantic colors as hex for chart fills (mirror global.css tokens).
export interface Palette {
  primary: string;
  background: string;
  foreground: string;
  mutedForeground: string;
  destructive: string;
  border: string;
  secondary: string;
  card: string;
  xlsFg: string;
}

export const PALETTE: Record<Mode, Palette> = {
  light: {
    primary: '#15835d',
    background: '#f5faf7',
    foreground: '#243430',
    mutedForeground: '#677873',
    destructive: '#dc4d3f',
    border: '#dde6e1',
    secondary: '#eef3f0',
    card: '#ffffff',
    xlsFg: '#16a34a',
  },
  dark: {
    primary: '#3cba88',
    background: '#161e1a',
    foreground: '#ecf2ef',
    mutedForeground: '#93a39d',
    destructive: '#e06a5c',
    border: '#2d3833',
    secondary: '#212b27',
    card: '#1c2622',
    xlsFg: '#4ade80',
  },
};
