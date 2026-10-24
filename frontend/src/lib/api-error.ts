import { ApiError } from '@/lib/api-client';
import type { Dict } from '@/lib/i18n';

/** Toast text for a failed request: the translated message for a known error code, else the error's own text. */
export function errorText(err: unknown, ui: Dict): string {
  if (err instanceof ApiError && err.code !== undefined && err.code in ui.errors) return ui.errors[err.code as keyof Dict['errors']];
  return err instanceof Error ? err.message : String(err);
}
