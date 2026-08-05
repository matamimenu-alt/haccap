import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';

type PlanDetail = {
  id: string;
  reference: string;
  version: number;
  status: string;
  titleEn: string; titleAr: string;
  description: string | null;
  productDescription: string | null;
  intendedUse: string | null;
  scopeProducts: Array<{ nameEn: string; nameAr?: string; category?: string }>;
  scopeProcesses: string[];
  teamMembers: Array<{ name: string; role: string; responsibilities?: string[] }>;
  prerequisitePrograms: string[];
  approvedAt: string | null;
  effectiveFrom: string | null;
  reviewDueOn: string | null;
  hazards: Array<{ id: string; titleEn: string; titleAr: string; type: string; stage: string; severity: number; likelihood: number; riskScore: number; isSignificant: boolean; isCcp: boolean; reference: string | null; agent: string | null }>;
  ccps: Array<{ id: string; reference: string; number: number; titleEn: string; titleAr: string; stage: string; assetId: string | null; criticalLimits: Array<{ metric: string; op: string; value?: number; unit?: string; labelEn?: string }> }>;
  verifications: Array<{ id: string; kind: string; titleEn: string; performedAt: string; isEffective: boolean }>;
};

export function HaccpPlanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const isAr = i18n.language.startsWith('ar');
  const plan = useQuery({ enabled: !!id, queryKey: ['haccp-plan', id], queryFn: () => api.get<PlanDetail>(`/haccp/plans/${id}`) });

  if (plan.isLoading) return <div>{t('common.loading')}</div>;
  if (!plan.data) return <div>{t('common.error')}</div>;
  const p = plan.data;

  return (
    <>
      <PageHeader
        title={isAr ? p.titleAr : p.titleEn}
        description={`${p.reference} v${p.version}`}
        actions={<Badge variant="success">{t(`haccp.planStatus.${p.status}` as const)}</Badge>}
      />

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="hazards">{t('haccp.hazards')} ({p.hazards.length})</TabsTrigger>
          <TabsTrigger value="ccps">{t('haccp.ccps')} ({p.ccps.length})</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="verifications">{t('haccp.verifications')} ({p.verifications.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardContent className="p-6 space-y-3 text-sm">
              {p.productDescription && <div><strong>Product:</strong> {p.productDescription}</div>}
              {p.intendedUse && <div><strong>Intended use:</strong> {p.intendedUse}</div>}
              <div><strong>Processes:</strong> {p.scopeProcesses.join(' → ')}</div>
              <div><strong>Prerequisite programs:</strong> {p.prerequisitePrograms.join(', ')}</div>
              <div className="grid gap-2 sm:grid-cols-3 mt-3 text-xs text-muted-foreground">
                <span>Approved {p.approvedAt ?? '—'}</span>
                <span>Effective from {p.effectiveFrom ?? '—'}</span>
                <span>Review due {p.reviewDueOn ?? '—'}</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hazards">
          <Card><CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr><th className="text-start p-3">Ref</th><th className="text-start p-3">Hazard</th><th className="p-3">Type</th><th className="p-3">Stage</th><th className="p-3">S×L</th><th className="p-3">Risk</th><th className="p-3">CCP</th></tr>
              </thead>
              <tbody>
                {p.hazards.map((h) => (
                  <tr key={h.id} className="border-t">
                    <td className="p-3 font-mono text-xs">{h.reference}</td>
                    <td className="p-3">
                      <div className="font-medium">{isAr ? h.titleAr : h.titleEn}</div>
                      {h.agent && <div className="text-xs text-muted-foreground">{h.agent}</div>}
                    </td>
                    <td className="p-3 text-center">{t(`haccp.hazardType.${h.type}` as const)}</td>
                    <td className="p-3 text-center text-xs">{h.stage}</td>
                    <td className="p-3 text-center">{h.severity} × {h.likelihood}</td>
                    <td className="p-3 text-center"><Badge variant={h.riskScore >= 15 ? 'danger' : h.riskScore >= 8 ? 'warning' : 'secondary'}>{h.riskScore}</Badge></td>
                    <td className="p-3 text-center">{h.isCcp && <Badge variant="danger">CCP</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="ccps">
          <div className="space-y-3">
            {p.ccps.map((ccp) => (
              <Card key={ccp.id}>
                <CardContent className="p-5 space-y-2">
                  <div className="flex items-center justify-between">
                    <Link to={`/haccp/ccps/${ccp.id}`} className="font-semibold text-primary hover:underline">
                      {ccp.reference} · {isAr ? ccp.titleAr : ccp.titleEn}
                    </Link>
                    <Badge variant="outline">{ccp.stage}</Badge>
                  </div>
                  <div className="text-sm">
                    {ccp.criticalLimits.map((cl, i) => (
                      <div key={i} className="text-muted-foreground">
                        <strong>{cl.labelEn ?? cl.metric}</strong>: {cl.op} {cl.value}{cl.unit ? ` ${cl.unit}` : ''}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="team">
          <Card><CardContent className="p-6">
            <ul className="divide-y">
              {p.teamMembers.map((m, i) => (
                <li key={i} className="py-3">
                  <div className="font-medium">{m.name}</div>
                  <div className="text-sm text-muted-foreground">{m.role}</div>
                  {m.responsibilities && <div className="text-xs text-muted-foreground mt-1">{m.responsibilities.join(' · ')}</div>}
                </li>
              ))}
            </ul>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="verifications">
          <Card><CardContent className="p-6">
            {p.verifications.length === 0 ? (
              <div className="text-muted-foreground text-sm">{t('common.empty')}</div>
            ) : (
              <ul className="divide-y">
                {p.verifications.map((v) => (
                  <li key={v.id} className="py-3 flex items-center justify-between text-sm">
                    <div>
                      <div className="font-medium">{v.titleEn}</div>
                      <div className="text-xs text-muted-foreground">{v.kind} · {formatDate(v.performedAt, isAr ? 'ar' : 'en')}</div>
                    </div>
                    <Badge variant={v.isEffective ? 'success' : 'warning'}>{v.isEffective ? 'effective' : 'issues'}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
