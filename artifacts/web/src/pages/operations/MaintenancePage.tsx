import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';

type Schedule = {
  id: string;
  assetId: string | null;
  titleAr: string;
  titleEn: string;
  frequency: string;
  kind: string;
  nextDueAt: string | null;
  isActive: boolean;
  riskIfSkipped: string;
};

export function MaintenancePage() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language.startsWith('ar');
  const schedules = useQuery({
    queryKey: ['maintenance-schedules', 'upcoming'],
    queryFn: () => api.get<Schedule[]>('/maintenance-schedules?dueInDays=30'),
  });

  return (
    <>
      <PageHeader title={t('maintenanceTab.title')} description={t('maintenanceTab.upcoming')} />
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('assets.name')}</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead>Next due</TableHead>
                <TableHead>Risk if skipped</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schedules.data?.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-muted-foreground">{t('common.empty')}</TableCell></TableRow>
              )}
              {schedules.data?.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{isAr ? s.titleAr : s.titleEn}</TableCell>
                  <TableCell>{s.kind}</TableCell>
                  <TableCell>{s.frequency}</TableCell>
                  <TableCell>{s.nextDueAt ? formatDate(s.nextDueAt, isAr ? 'ar' : 'en') : '—'}</TableCell>
                  <TableCell><Badge variant={s.riskIfSkipped === 'critical' ? 'danger' : s.riskIfSkipped === 'high' ? 'warning' : 'secondary'}>{s.riskIfSkipped}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
