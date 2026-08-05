import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';

type Ccp = {
  id: string;
  reference: string;
  titleEn: string; titleAr: string;
  stage: string;
  assetId: string | null;
  criticalLimits: Array<{ metric: string; op: string; value?: number; min?: number; max?: number; unit?: string; labelEn?: string; labelAr?: string }>;
  monitoring: { frequency: string; method: string; responsibleRoleKey?: string; procedureRef?: string };
  correctiveActionPlaybook: Array<{ step: string; ownerRoleKey?: string; deadlineMinutes?: number }>;
  monitoringLogs: Array<{ id: string; readings: Record<string, unknown>; result: 'in_limit' | 'warning' | 'deviation' | 'critical_deviation'; isDeviation: boolean; observedAt: string; notes: string | null }>;
};

const resultVariant = {
  in_limit: 'success', warning: 'warning',
  deviation: 'danger', critical_deviation: 'danger',
} as const;

export function CcpMonitorPage() {
  const { id } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const isAr = i18n.language.startsWith('ar');
  const qc = useQueryClient();

  const ccp = useQuery({ enabled: !!id, queryKey: ['ccp', id], queryFn: () => api.get<Ccp>(`/haccp/ccps/${id}`) });
  const branches = useQuery({ queryKey: ['branches'], queryFn: () => api.get<Array<{ id: string; nameEn: string; nameAr: string }>>('/branches') });

  const [branchId, setBranchId] = useState('');
  const [readings, setReadings] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');

  const monitorMut = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/haccp/ccp-monitoring', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ccp', id] });
      setReadings({});
      setNote('');
    },
  });

  if (ccp.isLoading) return <div>{t('common.loading')}</div>;
  if (!ccp.data) return <div>{t('common.error')}</div>;
  const c = ccp.data;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    monitorMut.mutate({
      ccpId: c.id,
      branchId: branchId || branches.data?.[0]?.id,
      readings: Object.fromEntries(Object.entries(readings).map(([k, v]) => [k, Number(v)])),
      notes: note || null,
    });
  };

  return (
    <>
      <PageHeader
        title={`${c.reference} · ${isAr ? c.titleAr : c.titleEn}`}
        description={`${c.stage} · ${c.monitoring.method} · ${c.monitoring.frequency}`}
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_400px]">
        <Card>
          <CardContent className="p-6 space-y-3">
            <h3 className="font-semibold">{t('haccp.criticalLimit')}</h3>
            <ul className="text-sm space-y-1">
              {c.criticalLimits.map((cl, i) => (
                <li key={i} className="text-muted-foreground">
                  <strong className="text-foreground">{cl.labelEn ?? cl.metric}</strong>: {cl.op} {cl.value ?? `${cl.min}..${cl.max}`}{cl.unit ? ` ${cl.unit}` : ''}
                </li>
              ))}
            </ul>

            {c.correctiveActionPlaybook.length > 0 && (
              <>
                <h3 className="font-semibold pt-2">Corrective action playbook</h3>
                <ol className="list-decimal ps-6 text-sm space-y-1">
                  {c.correctiveActionPlaybook.map((p, i) => (
                    <li key={i}><span className="text-foreground">{p.step}</span> {p.ownerRoleKey && <span className="text-xs text-muted-foreground">({p.ownerRoleKey})</span>}</li>
                  ))}
                </ol>
              </>
            )}

            <h3 className="font-semibold pt-2">Recent monitoring</h3>
            {c.monitoringLogs.length === 0 ? (
              <div className="text-muted-foreground text-sm">{t('common.empty')}</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-muted-foreground">
                  <tr><th className="text-start p-2">Observed</th><th className="text-start p-2">Reading</th><th className="p-2">Result</th></tr>
                </thead>
                <tbody>
                  {c.monitoringLogs.slice(0, 20).map((l) => (
                    <tr key={l.id} className="border-t">
                      <td className="p-2 text-muted-foreground">{formatDate(l.observedAt, isAr ? 'ar' : 'en')}</td>
                      <td className="p-2 font-mono text-xs">{Object.entries(l.readings).map(([k, v]) => `${k}=${v}`).join(', ')}</td>
                      <td className="p-2 text-center"><Badge variant={resultVariant[l.result]}>{t(`haccp.monitoringResult.${l.result}` as const)}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 space-y-4">
            <h3 className="font-semibold">{t('haccp.recordReading')}</h3>
            <form onSubmit={submit} className="space-y-3">
              <div className="space-y-2">
                <Label>{t('assets.branch')}</Label>
                <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                  {branches.data?.map((b) => <option key={b.id} value={b.id}>{isAr ? b.nameAr : b.nameEn}</option>)}
                </select>
              </div>
              {c.criticalLimits.map((cl) => (
                <div key={cl.metric} className="space-y-2">
                  <Label>{cl.labelEn ?? cl.metric} {cl.unit && <span className="text-muted-foreground">({cl.unit})</span>}</Label>
                  <Input
                    type="number" step="0.1" required
                    value={readings[cl.metric] ?? ''}
                    onChange={(e) => setReadings({ ...readings, [cl.metric]: e.target.value })}
                  />
                </div>
              ))}
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
              </div>
              <Button type="submit" className="w-full" disabled={monitorMut.isPending}>
                {monitorMut.isPending ? t('common.loading') : t('actions.save')}
              </Button>
              <Link to="/haccp/ccps" className="block text-xs text-muted-foreground hover:underline text-center">← back</Link>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
