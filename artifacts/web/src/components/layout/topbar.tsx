import { useTranslation } from 'react-i18next';
import { LogOut, Languages } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toggleLocale } from '@/i18n';
import { useAuthStore } from '@/stores/auth';
import { api } from '@/lib/api';

export function Topbar() {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const clear = useAuthStore((s) => s.clear);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const isAr = i18n.language.startsWith('ar');

  const displayName = user ? (isAr ? user.fullNameAr : user.fullNameEn) : '';

  const logout = async () => {
    try {
      await api.post('/auth/logout', refreshToken ? { refreshToken } : {});
    } catch {
      /* ignore */
    }
    clear();
    window.location.href = '/login';
  };

  return (
    <header className="h-16 border-b bg-background flex items-center justify-between px-6">
      <div className="text-sm text-muted-foreground">{t('app.tagline')}</div>
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={toggleLocale} className="gap-2">
          <Languages className="h-4 w-4" />
          {t('actions.switchLanguage')}
        </Button>
        <div className="text-sm">
          <div className="font-medium leading-tight">{displayName}</div>
          <div className="text-xs text-muted-foreground leading-tight">{user?.email}</div>
        </div>
        <Button variant="ghost" size="icon" onClick={logout} aria-label={t('actions.logout') ?? ''}>
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
