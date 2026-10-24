'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useI18n } from '@/components/i18n-provider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authClient } from '@/lib/auth-client';
import type { Dict } from '@/lib/i18n';
import { PRIVACY_VERSION } from '@/lib/privacy';

type AuthErrors = Dict['auth']['errors'];
type AuthFailure = { code?: string; status?: number } | null;

/** Maps a Better Auth failure to one of our own strings; server text is never shown. */
export function errorMessage(error: AuthFailure, errors: AuthErrors): string {
  const code = error?.code ?? '';
  if (error?.status === 429) return errors.rateLimited;
  if (code === 'INVALID_EMAIL_OR_PASSWORD') return errors.invalidCredentials;
  if (code.startsWith('USER_ALREADY_EXISTS')) return errors.emailTaken;
  if (code === 'PASSWORD_TOO_SHORT') return errors.passwordTooShort;
  if (code === 'INVALID_EMAIL') return errors.invalidEmail;
  return errors.generic;
}

export function AuthForm({ mode }: { mode: 'login' | 'signup' }) {
  const { ui } = useI18n();
  const t = ui.auth;
  const signup = mode === 'signup';
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get('email') ?? '').trim();
    const password = String(form.get('password') ?? '');
    const name = String(form.get('name') ?? '').trim();
    setError(null);
    if (signup && !name) return setError(t.errors.nameRequired);
    if (signup && password.length < 10) return setError(t.errors.passwordTooShort);
    setBusy(true);
    try {
      const { error: failure } = signup
        ? await authClient.signUp.email({ email, password, name, privacyVersion: PRIVACY_VERSION } as Parameters<typeof authClient.signUp.email>[0])
        : await authClient.signIn.email({ email, password });
      if (failure) {
        setError(errorMessage(failure, t.errors));
        setBusy(false);
        return;
      }
      // A full navigation, so the server renders with the new session cookie.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a hard navigation on purpose
      window.location.assign('/dashboard');
    } catch {
      setError(t.errors.generic);
      setBusy(false);
    }
  }

  return (
    <Card className="gap-5 p-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{signup ? t.signupTitle : t.loginTitle}</h1>
        <p className="text-sm text-muted-foreground">{signup ? t.signupSubtitle : t.loginSubtitle}</p>
      </div>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {signup ? (
          <div className="space-y-1.5">
            <Label htmlFor="name">{t.name}</Label>
            <Input id="name" name="name" autoComplete="name" required />
          </div>
        ) : null}
        <div className="space-y-1.5">
          <Label htmlFor="email">{t.email}</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">{t.password}</Label>
          <Input id="password" name="password" type="password" autoComplete={signup ? 'new-password' : 'current-password'} minLength={signup ? 10 : undefined} required />
          {signup ? <p className="text-xs text-muted-foreground">{t.passwordHint}</p> : null}
        </div>
        {signup ? (
          <div className="flex items-start gap-2.5">
            <input id="acknowledge" type="checkbox" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-primary" />
            <div className="text-sm leading-snug">
              <label htmlFor="acknowledge">{t.acknowledge}</label>{' '}
              <Link href="/privacy" target="_blank" className="text-primary underline-offset-4 hover:underline">{t.acknowledgeLink}</Link>
            </div>
          </div>
        ) : null}
        {error ? <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
        <Button type="submit" size="lg" className="w-full" disabled={busy || (signup && !acknowledged)}>
          {busy ? t.working : signup ? t.submitSignup : t.submitLogin}
        </Button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        {signup ? t.haveAccount : t.noAccount}{' '}
        <Link href={signup ? '/login' : '/signup'} className="font-medium text-primary underline-offset-4 hover:underline">{signup ? t.goLogin : t.goSignup}</Link>
      </p>
      <p className="text-center text-xs text-muted-foreground">
        <Link href="/privacy" className="underline-offset-4 hover:underline">{t.privacyLink}</Link>
      </p>
    </Card>
  );
}
