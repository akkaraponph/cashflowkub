'use client';

import { ToneBadge, type Tone } from '@/components/cfk/tone-badge';
import { useI18n } from '@/components/i18n-provider';
import { fill } from '@/lib/i18n';
import type { DueState, DueStatus } from '@/server/debt/cycle';

const TONE: Record<DueState, Tone> = { closed: 'neutral', paid: 'success', upcoming: 'neutral', dueSoon: 'warning', dueToday: 'warning', overdue: 'danger' };

export function DueBadge({ due }: { due: DueStatus }) {
  const { ui } = useI18n();
  const label =
    due.state === 'overdue' ? fill(ui.daysLateN, { n: due.daysLate })
    : due.state === 'upcoming' || due.state === 'dueSoon' ? fill(ui.daysUntil, { n: due.daysUntil })
    : ui.dueState[due.state];
  return <ToneBadge label={label} tone={TONE[due.state]} />;
}
