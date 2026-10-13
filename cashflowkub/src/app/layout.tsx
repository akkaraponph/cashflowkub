import type { Metadata } from 'next';
import { IBM_Plex_Sans_Thai } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import { getPrefs } from '@/lib/prefs-server';
import './globals.css';

const plexThai = IBM_Plex_Sans_Thai({ subsets: ['latin', 'thai'], weight: ['400', '500', '600', '700'], variable: '--font-plex-thai' });

export const metadata: Metadata = { title: 'CashflowKub', description: 'Personal cashflow — กระแสเงินสดส่วนตัว' };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { lang } = await getPrefs();
  return (
    <html lang={lang} suppressHydrationWarning>
      <body className={plexThai.variable}>
        <ThemeProvider>
          {children}
          <Toaster richColors position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
