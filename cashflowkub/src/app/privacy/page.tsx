import Link from 'next/link';
import { LogoMark } from '@/components/cfk/logo';
import { fill } from '@/lib/i18n';
import { PRIVACY_VERSION } from '@/lib/privacy';
import { getI18n } from '@/lib/prefs-server';

// TODO(legal): this notice is a DRAFT written by the developers, not reviewed by a lawyer. The owner (the data
// controller) must have it reviewed and finalised against the PDPA, and bump PRIVACY_VERSION in src/lib/privacy.ts
// whenever the text changes. Do not treat it as final legal text.

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set (see .env.example)`);
  return value;
}

export async function generateMetadata() {
  const { ui } = await getI18n();
  return { title: `${ui.privacy.title} · CashflowKub` };
}

export default async function PrivacyPage() {
  const { ui } = await getI18n();
  const name = requireEnv('PRIVACY_CONTROLLER_NAME');
  const email = requireEnv('PRIVACY_CONTACT_EMAIL');
  const p = ui.privacy;
  const vars = { name, email };
  const sections: [string, string][] = [
    [p.controllerTitle, fill(p.controllerBody, vars)],
    [p.collectTitle, p.collectBody],
    [p.whyTitle, p.whyBody],
    [p.retentionTitle, p.retentionBody],
    [p.securityTitle, p.securityBody],
    [p.rightsTitle, fill(p.rightsBody, vars)],
    [p.cookiesTitle, p.cookiesBody],
  ];
  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 px-4 py-8">
      <div className="flex items-center gap-2">
        <LogoMark size={28} />
        <span className="flex-1 font-bold">CashflowKub</span>
        <Link href="/" className="text-sm text-primary underline-offset-4 hover:underline">{p.backToApp}</Link>
      </div>
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">{p.title}</h1>
        <p className="text-sm text-muted-foreground">{fill(p.draftNote, { version: PRIVACY_VERSION })}</p>
      </div>
      {sections.map(([title, body]) => (
        <section key={title} className="space-y-1.5">
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
        </section>
      ))}
      <p className="border-t pt-4 text-xs text-muted-foreground">{p.versionLabel}: {PRIVACY_VERSION} · {email}</p>
    </main>
  );
}
