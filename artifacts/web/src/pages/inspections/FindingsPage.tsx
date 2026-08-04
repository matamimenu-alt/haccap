import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertOctagon } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';

type Finding = {
  id: string;
  titleAr: string;
  titleEn: string;
  severity: 'observation' | 'minor' | 'major' | 'critical';
  status: 'open' | 'in_capa' | 'resolved' | 'accepted_risk' | 'closed' | 'reopened';
  createdAt: string;
  dueAt: string | null;
  followupTaskId: string | null;
};

const sevVariant = { observation: 'secondary', minor: 'outline', major: 'warning', critical: 'danger' } as const;
const statusVariant = { open: 'default', in_capa: 'warning', resolved: 'success', accepted_risk: 'secondary', closed: 'secondary', reopened: 'danger' } as const;

export function FindingsPage() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language.startsWith('ar');
  const findings = useQuery({ queryKey: ['findings'], queryFn: () => api.get<Finding[]>('/findings') });

  return (
    <>
      <PageHeader title={t('nav.findings')} />
      {findings.isLoading ? (
        <Card><CardContent className="p-6 text-muted-foreground">{t('common.loading')}</CardContent></Card>
      ) : findings.data && findings.data.length === 0 ? (
        <EmptyState icon={AlertOctagon} title={t('common.empty')} description="Findings are created when inspections are finalized." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('assets.name')}</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Task</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {findings.data?.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">{isAr ? f.titleAr : f.titleEn}</TableCell>
                    <TableCell><Badge variant={sevVariant[f.severity]}>{t(`inspections.finding.severity.${f.severity}` as const)}</Badge></TableCell>
                    <TableCell><Badge variant={statusVariant[f.status]}>{t(`inspections.finding.status.${f.status}` as const)}</Badge></TableCell>
                    <TableCell className="text-muted-foreground text-xs">{f.dueAt ? formatDate(f.dueAt, isAr ? 'ar' : 'en') : '—'}</TableCell>
                    <TableCell>
                      {f.followupTaskId ? (
                        <a href={`/tasks/${f.followupTaskId}`} className="text-primary hover:underline text-xs font-mono">Open</a>
                      ) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </>
  );
}
