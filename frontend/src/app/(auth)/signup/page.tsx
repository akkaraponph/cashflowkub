import { getI18n } from '@/lib/prefs-server';
import { AuthForm } from '../auth-form';

export async function generateMetadata() {
  const { ui } = await getI18n();
  return { title: `${ui.auth.signupTitle} · CashflowKub` };
}

export default function SignupPage() {
  return <AuthForm mode="signup" />;
}
