import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ClipboardList, Plus } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';

type Inspection = {
  id: string;
  titleEn: string;
  titleAr: string;
  kind: string;
  status: 'scheduled' | 'in_progress' | 'submitted' | 'finalized' | 'cancelled';
  overallScore: string | null;
  overallPass: boolean | null;
  criticalFailures: number;
  createdAt: string;
  finalizedAt: string | null;
};

const statusVariant = {
  scheduled: 'secondary',
  in_progress: 'default',
  submitted: 'warning',
  finalized: 'success',
  cancelled: 'secondary',
} as const;

export function InspectionsPage() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language.startsWith('ar');
  const inspections = useQuery({ queryKey: ['inspections'], queryFn: () => api.get<Inspection[]>('/inspections') });

  return (
    <>
      <PageHeader
        title={t('inspections.title')}
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link to="/inspection-templates">{t('inspections.templates')}</Link>
            </Button>
            <Button asChild>
              <Link to="/inspections/new"><Plus className="h-4 w-4" />{t('inspections.add')}</Link>
            </Button>
          </div>
        }
      />

      {inspections.isLoading ? (
        <Card><CardContent className="p-6 text-muted-foreground">{t('common.loading')}</CardContent></Card>
      ) : inspections.data && inspections.data.length === 0 ? (
        <EmptyState icon={ClipboardList} title={t('common.empty')} description={t('inspections.templates')} />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('assets.name')}</TableHead>
                  <TableHead>{t('assets.kind')}</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>{t('inspections.overallScore')}</TableHead>
                  <TableHead>Critical</TableHead>
                  <TableHead>Finalized</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inspections.data?.map((ins) => (
                  <TableRow key={ins.id}>
                    <TableCell className="font-medium">
                      <Link to={`/inspections/${ins.id}`} className="text-primary hover:underline">
                        {isAr ? ins.titleAr : ins.titleEn}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{t(`inspections.kind.${ins.kind}` as const)}</TableCell>
                    <TableCell><Badge variant={statusVariant[ins.status]}>{t(`inspections.status.${ins.status}` as const)}</Badge></TableCell>
                    <TableCell className="font-mono text-xs">
                      {ins.overallScore ? `${Number(ins.overallScore).toFixed(1)}%` : '—'}
                      {ins.overallPass !== null && (
                        <Badge className="ms-2" variant={ins.overallPass ? 'success' : 'danger'}>
                          {ins.overallPass ? 'pass' : 'fail'}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{ins.criticalFailures ? <Badge variant="danger">{ins.criticalFailures}</Badge> : '—'}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{ins.finalizedAt ? formatDate(ins.finalizedAt, isAr ? 'ar' : 'en') : '—'}</TableCell>
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
