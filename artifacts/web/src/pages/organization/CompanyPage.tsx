import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';

type Company = {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  status: 'trial' | 'active' | 'suspended' | 'archived';
  country: string;
  defaultLocale: 'ar' | 'en';
  timezone: string;
  commercialRegistration: string | null;
  vatNumber: string | null;
  enabledModules: string[];
};

export function CompanyPage() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language.startsWith('ar');
  const q = useQuery({ queryKey: ['company', 'me'], queryFn: () => api.get<Company>('/companies/me') });

  return (
    <>
      <PageHeader title={t('nav.companies')} />
      {q.isLoading && <div>{t('common.loading')}</div>}
      {q.data && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-2xl font-semibold">{isAr ? q.data.nameAr : q.data.nameEn}</div>
                <div className="text-sm text-muted-foreground">{isAr ? q.data.nameEn : q.data.nameAr}</div>
              </div>
              <Badge variant={q.data.status === 'active' ? 'success' : 'warning'}>{q.data.status}</Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 text-sm">
              <Field label="Slug" value={q.data.slug} />
              <Field label="Country" value={q.data.country} />
              <Field label="Timezone" value={q.data.timezone} />
              <Field label="Default locale" value={q.data.defaultLocale} />
              <Field label="Commercial reg." value={q.data.commercialRegistration ?? '—'} />
              <Field label="VAT number" value={q.data.vatNumber ?? '—'} />
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
