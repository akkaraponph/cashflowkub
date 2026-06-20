import { usePrefs } from './store';
import { PALETTE } from './theme';

/** Current theme palette as concrete hexes — for charts/SVG where className can't reach. */
export function useColors() {
  const mode = usePrefs((s) => s.theme);
  return { ...PALETTE[mode], mode };
}
