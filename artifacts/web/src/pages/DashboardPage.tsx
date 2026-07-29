import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Building2, MapPin, Store, Users } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

type Branch = { id: string; status: string };
type Brand = { id: string };
type User = { id: string; status: string };

export function DashboardPage() {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const isAr = i18n.language.startsWith('ar');

  const branches = useQuery({ queryKey: ['branches'], queryFn: () => api.get<Branch[]>('/branches') });
  const brands   = useQuery({ queryKey: ['brands'],   queryFn: () => api.get<Brand[]>('/brands') });
  const users    = useQuery({ queryKey: ['users'],    queryFn: () => api.get<User[]>('/users') });

  const stats = [
    {
      label: t('dashboard.stats.branches'),
      value: branches.data?.length ?? '—',
      icon: MapPin,
    },
    {
      label: t('dashboard.stats.brands'),
      value: brands.data?.length ?? '—',
      icon: Store,
    },
    {
      label: t('dashboard.stats.activeUsers'),
      value: users.data?.filter((u) => u.status === 'active').length ?? '—',
      icon: Users,
    },
    {
      label: t('dashboard.stats.openViolations'),
      value: '—',
      icon: Building2,
    },
  ];

  const name = user ? (isAr ? user.fullNameAr : user.fullNameEn) : '';

  return (
    <>
      <PageHeader
        title={t('dashboard.title')}
        description={t('dashboard.welcome', { name })}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
              <s.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          {t('dashboard.phase1Notice')}
        </CardContent>
      </Card>
    </>
  );
}
