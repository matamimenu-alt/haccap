import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { toggleLocale } from '@/i18n';

type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    fullNameAr: string;
    fullNameEn: string;
    preferredLocale: 'ar' | 'en';
    avatarUrl: string | null;
    companyId: string;
    branchIds: string[];
  };
  roles: string[];
};

export function LoginPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const [email, setEmail] = useState('owner@rcos.demo');
  const [password, setPassword] = useState('Admin@2026');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await api.post<LoginResponse>('/auth/login', { email, password });
      setSession({
        accessToken: res.accessToken,
        refreshToken: res.refreshToken,
        user: { ...res.user, roles: res.roles },
      });
      nav('/', { replace: true });
    } catch {
      setErr(t('auth.invalid') ?? 'Invalid credentials');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-background">
      {/* Brand panel */}
      <div className="hidden md:flex flex-col justify-between bg-sidebar text-sidebar-foreground p-10 relative overflow-hidden">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold">
            R
          </div>
          <div>
            <div className="font-semibold">{t('app.shortName')}</div>
            <div className="text-xs text-sidebar-foreground/70">{t('app.name')}</div>
          </div>
        </div>
        <div className="relative z-10">
          <h2 className="text-3xl font-semibold leading-tight">{t('app.name')}</h2>
          <p className="text-sm text-sidebar-foreground/70 mt-3 max-w-md">{t('app.tagline')}</p>
        </div>
        <div className="text-xs text-sidebar-foreground/50">© {new Date().getFullYear()} RCOS</div>
        <div className="absolute -bottom-32 -end-32 h-96 w-96 rounded-full bg-primary/20 blur-3xl" aria-hidden />
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="flex justify-end mb-6">
            <Button variant="ghost" size="sm" onClick={toggleLocale} className="gap-2">
              <Languages className="h-4 w-4" />
              {t('actions.switchLanguage')}
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t('auth.welcome')}</CardTitle>
              <CardDescription>{t('auth.signInHint')}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={submit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">{t('auth.email')}</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">{t('auth.password')}</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                {err && <div className="text-sm text-danger">{err}</div>}
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? t('common.loading') : t('actions.login')}
                </Button>
              </form>

              <div className="mt-6 rounded-md bg-muted p-4 text-xs text-muted-foreground space-y-1">
                <div className="font-medium text-foreground">{t('auth.demoCredentials')}</div>
                <div>owner@rcos.demo · Admin@2026</div>
                <div>ops@rcos.demo · Admin@2026</div>
                <div>fso@rcos.demo · Admin@2026</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
