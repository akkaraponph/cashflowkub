import type { Metadata } from 'next';
import { I18nProvider } from '@/components/i18n-provider';
import { LandingHome } from '@/components/landing/landing-home';
import { getI18n } from '@/lib/prefs-server';

export async function generateMetadata(): Promise<Metadata> {
  const { ui } = await getI18n();
  return { title: `${ui.tagline} · CashflowKub`, description: ui.landing.body };
}

export default async function LandingPage() {
  const { lang } = await getI18n();
  return <I18nProvider lang={lang}><LandingHome /></I18nProvider>;
}
