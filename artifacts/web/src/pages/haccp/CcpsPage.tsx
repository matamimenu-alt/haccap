import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';

type Plan = { id: string; titleEn: string; titleAr: string; reference: string };
type Ccp = {
  id: string; haccpPlanId: string; reference: string; number: number;
  titleEn: string; titleAr: string; stage: string;
  criticalLimits: Array<{ metric: string; op: string; value?: number; unit?: string }>;
  monitoring: { frequency: string; method: string };
};

export function CcpsPage() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language.startsWith('ar');
  const plans = useQuery({ queryKey: ['haccp-plans'], queryFn: () => api.get<Plan[]>('/haccp/plans') });
  const planEntries = plans.data ?? [];

  return (
    <>
      <PageHeader title={t('haccp.ccps')} />
      <div className="space-y-4">
        {planEntries.length === 0 && (
          <Card><CardContent className="p-6 text-muted-foreground">{t('common.empty')}</CardContent></Card>
        )}
        {planEntries.map((plan) => <PlanCcpBlock key={plan.id} plan={plan} isAr={isAr} t={t} />)}
      </div>
    </>
  );
}

function PlanCcpBlock({ plan, isAr, t }: { plan: Plan; isAr: boolean; t: ReturnType<typeof useTranslation>['t'] }) {
  const ccps = useQuery({ queryKey: ['ccps', plan.id], queryFn: () => api.get<Ccp[]>(`/haccp/plans/${plan.id}/ccps`) });
  if (!ccps.data || ccps.data.length === 0) return null;

  return (
    <Card>
      <CardContent className="p-0">
        <div className="p-4 border-b">
          <div className="font-semibold">{isAr ? plan.titleAr : plan.titleEn}</div>
          <div className="text-xs text-muted-foreground font-mono">{plan.reference}</div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ref</TableHead>
              <TableHead>{t('assets.name')}</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>Critical limits</TableHead>
              <TableHead>Frequency</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ccps.data.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-mono text-xs">{c.reference}</TableCell>
                <TableCell className="font-medium">{isAr ? c.titleAr : c.titleEn}</TableCell>
                <TableCell><Badge variant="outline">{c.stage}</Badge></TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {c.criticalLimits.map((cl) => `${cl.metric} ${cl.op} ${cl.value ?? '?'}${cl.unit ?? ''}`).join(' · ')}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{c.monitoring.frequency}</TableCell>
                <TableCell>
                  <Link to={`/haccp/ccps/${c.id}`} className="text-primary hover:underline text-xs">Monitor →</Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
