import { createElement, type ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { I18nProvider, useOptionalI18n } from '@/components/i18n-provider';
import { DICT } from '@/lib/i18n';

const ALLOWED = ['appName', 'settingsEmail', 'tax.field.easyEReceipt', 'tax.field.rmf', 'tax.field.ssf', 'tax.field.thaiEsg'];

function englishOnly(node: unknown, path: string, out: string[]): string[] {
  if (typeof node === 'string') {
    if (/[A-Za-z]{3,}/.test(node) && !/[฀-๿]/.test(node)) out.push(path);
  } else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) englishOnly(v, path ? `${path}.${k}` : k, out);
  }
  return out;
}

describe('Thai dictionary', () => {
  it('has no English-only strings beyond proper nouns', () => {
    expect(englishOnly(DICT.th, '', []).sort()).toEqual(ALLOWED);
  });
  it('has a Thai close label', () => {
    expect(DICT.th.close).toBe('ปิด');
  });
});

describe('useOptionalI18n', () => {
  const Probe = () => createElement('span', null, useOptionalI18n()?.ui.close ?? 'Close');
  it('falls back outside the provider', () => {
    expect(renderToStaticMarkup(createElement(Probe))).toBe('<span>Close</span>');
  });
  it('reads Thai inside the provider', () => {
    expect(renderToStaticMarkup(createElement(I18nProvider, { lang: 'th' } as ComponentProps<typeof I18nProvider>, createElement(Probe)))).toBe('<span>ปิด</span>');
  });
});
