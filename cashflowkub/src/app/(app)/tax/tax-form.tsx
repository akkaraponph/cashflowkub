'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useI18n } from '@/components/i18n-provider';
import { apiFetch } from '@/lib/api-client';
import type { TaxInput } from '@/server/tax/logic';
import { TAX_SECTIONS, toFormValues, toTaxInput, type TaxFormValues } from './form-model';

export function TaxForm({ year, input }: { year: number; input: TaxInput }) {
  const { ui } = useI18n();
  const router = useRouter();
  const [values, setValues] = useState<TaxFormValues>(() => toFormValues(input));
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      try {
        await apiFetch(`/tax?year=${year}`, { method: 'PUT', body: toTaxInput(values) });
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : String(err));
      }
    });

  return (
    <>
      {TAX_SECTIONS.map((section) => (
        <Card key={section.key} className="gap-3 p-5">
          <h2 className="font-bold">{ui.tax.section[section.key]}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {section.fields.map((key) => {
              const v = values[key];
              return typeof v === 'boolean' ? (
                <label key={key} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={v} onChange={(e) => setValues({ ...values, [key]: e.target.checked })} />
                  {ui.tax.field[key]}
                </label>
              ) : (
                <div key={key} className="grid gap-1.5">
                  <Label htmlFor={`tax-${key}`}>{ui.tax.field[key]}</Label>
                  <Input id={`tax-${key}`} type="text" inputMode="numeric" value={v} onChange={(e) => setValues({ ...values, [key]: e.target.value })} className="tabular-nums" />
                </div>
              );
            })}
          </div>
        </Card>
      ))}
      <Button className="w-full" disabled={pending} onClick={save}>{ui.tax.save}</Button>
    </>
  );
}
