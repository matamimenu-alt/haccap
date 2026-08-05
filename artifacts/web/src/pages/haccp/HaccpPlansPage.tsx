import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';

type Plan = {
  id: string;
  reference: string;
  version: number;
  titleEn: string;
  titleAr: string;
  status: 'draft' | 'under_review' | 'approved' | 'active' | 'superseded' | 'archived';
  reviewDueOn: string | null;
  scopeProducts: Array<{ nameEn: string }>;
  updatedAt: string;
};

const statusVariant = {
  draft: 'outline', under_review: 'warning', approved: 'default',
  active: 'success', superseded: 'secondary', archived: 'secondary',
} as const;

export function HaccpPlansPage() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language.startsWith('ar');
  const plans = useQuery({ queryKey: ['haccp-plans'], queryFn: () => api.get<Plan[]>('/haccp/plans') });

  return (
    <>
      <PageHeader title={t('haccp.plans')} />
      {plans.isLoading ? (
        <Card><CardContent className="p-6 text-muted-foreground">{t('common.loading')}</CardContent></Card>
      ) : plans.data && plans.data.length === 0 ? (
        <EmptyState icon={ShieldCheck} title={t('common.empty')} />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ref</TableHead>
                  <TableHead>{t('assets.name')}</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Review due</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.data?.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">
                      <Link to={`/haccp/plans/${p.id}`} className="text-primary hover:underline">{p.reference} v{p.version}</Link>
                    </TableCell>
                    <TableCell className="font-medium">{isAr ? p.titleAr : p.titleEn}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{p.scopeProducts.map((s) => s.nameEn).join(', ')}</TableCell>
                    <TableCell><Badge variant={statusVariant[p.status]}>{t(`haccp.planStatus.${p.status}` as const)}</Badge></TableCell>
                    <TableCell className="text-muted-foreground text-xs">{p.reviewDueOn ? formatDate(p.reviewDueOn, isAr ? 'ar' : 'en') : '—'}</TableCell>
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
