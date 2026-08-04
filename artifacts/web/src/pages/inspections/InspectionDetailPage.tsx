import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';

type Item = {
  key: string;
  sectionKey: string;
  labelAr: string;
  labelEn: string;
  type: 'yesno' | 'scale5' | 'numeric' | 'text';
  weight?: number;
  critical?: boolean;
  passIf?: { op: 'gte' | 'lte' | 'between'; value?: number; min?: number; max?: number };
  unit?: string;
};
type Section = { key: string; labelAr: string; labelEn: string; weight?: number; order?: number };

type Response = {
  id: string;
  itemKey: string;
  sectionKey: string;
  value: 'pass' | 'fail' | 'partial' | 'not_applicable' | 'observed' | null;
  numericValue: string | null;
  textValue: string | null;
  isPass: boolean | null;
  isCritical: boolean;
  note: string | null;
};

type Inspection = {
  id: string;
  titleEn: string;
  titleAr: string;
  kind: string;
  status: 'scheduled' | 'in_progress' | 'submitted' | 'finalized' | 'cancelled';
  overallScore: string | null;
  overallPass: boolean | null;
  criticalFailures: number;
  majorFailures: number;
  minorFailures: number;
  notes: string | null;
  verdict: string | null;
  templateSnapshot: { sections: Section[]; items: Item[]; passThreshold?: number };
  responses: Response[];
  findings: unknown[];
};

export function InspectionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const isAr = i18n.language.startsWith('ar');
  const qc = useQueryClient();

  const inspection = useQuery({ enabled: !!id, queryKey: ['inspection', id], queryFn: () => api.get<Inspection>(`/inspections/${id}`) });

  const responseMut = useMutation({
    mutationFn: (input: { itemKey: string; body: Record<string, unknown> }) =>
      api.patch(`/inspections/${id}/responses/${input.itemKey}`, input.body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inspection', id] }),
  });
  const submitMut = useMutation({
    mutationFn: () => api.post(`/inspections/${id}/submit`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inspection', id] }),
  });
  const finalizeMut = useMutation({
    mutationFn: () => api.post(`/inspections/${id}/finalize`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inspection', id] }),
  });

  const responseByKey = useMemo(() => {
    const m = new Map<string, Response>();
    (inspection.data?.responses ?? []).forEach((r) => m.set(r.itemKey, r));
    return m;
  }, [inspection.data]);

  if (inspection.isLoading) return <div>{t('common.loading')}</div>;
  if (!inspection.data) return <div>{t('common.error')}</div>;
  const ins = inspection.data;
  const isEditable = ins.status === 'scheduled' || ins.status === 'in_progress';

  const patch = (itemKey: string, body: Record<string, unknown>) => responseMut.mutate({ itemKey, body });

  return (
    <>
      <PageHeader
        title={isAr ? ins.titleAr : ins.titleEn}
        description={`${t(`inspections.kind.${ins.kind}` as const)} · ${t(`inspections.status.${ins.status}` as const)}`}
        actions={
          <div className="flex items-center gap-2">
            {ins.overallScore && (
              <Badge variant={ins.overallPass ? 'success' : 'danger'}>
                {Number(ins.overallScore).toFixed(1)}%
              </Badge>
            )}
            {ins.criticalFailures > 0 && <Badge variant="danger">{ins.criticalFailures} critical</Badge>}
            {ins.status === 'in_progress' && (
              <Button size="sm" onClick={() => submitMut.mutate()} disabled={submitMut.isPending}>{t('inspections.actions.submit')}</Button>
            )}
            {ins.status === 'submitted' && (
              <Button size="sm" onClick={() => finalizeMut.mutate()} disabled={finalizeMut.isPending}>{t('inspections.actions.finalize')}</Button>
            )}
          </div>
        }
      />

      <div className="space-y-6">
        {(ins.templateSnapshot.sections ?? []).map((section) => {
          const items = (ins.templateSnapshot.items ?? []).filter((it) => it.sectionKey === section.key);
          return (
            <Card key={section.key}>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-baseline justify-between">
                  <h3 className="font-semibold">{isAr ? section.labelAr : section.labelEn}</h3>
                  {section.weight && <span className="text-xs text-muted-foreground">weight × {section.weight}</span>}
                </div>
                <ul className="divide-y">
                  {items.map((item) => {
                    const resp = responseByKey.get(item.key);
                    return (
                      <li key={item.key} className="py-3 grid gap-3 md:grid-cols-[1fr_auto] items-start">
                        <div>
                          <div className="text-sm font-medium">
                            {isAr ? item.labelAr : item.labelEn}
                            {item.critical && <Badge className="ms-2" variant="danger">critical</Badge>}
                            {item.weight && item.weight > 1 && <Badge className="ms-2" variant="outline">×{item.weight}</Badge>}
                          </div>
                          {item.passIf && (
                            <div className="text-xs text-muted-foreground mt-0.5">
                              pass if {item.passIf.op} {item.passIf.value ?? `${item.passIf.min}..${item.passIf.max}`}{item.unit ? ` ${item.unit}` : ''}
                            </div>
                          )}
                          {resp?.note && <div className="text-xs text-muted-foreground mt-1">{resp.note}</div>}
                        </div>
                        <div className="flex items-center gap-2">
                          {item.type === 'numeric' ? (
                            <>
                              <Input
                                type="number"
                                step="0.1"
                                defaultValue={resp?.numericValue ?? ''}
                                onBlur={(e) => e.target.value && patch(item.key, { value: 'observed', numericValue: Number(e.target.value) })}
                                disabled={!isEditable}
                                className="w-28"
                              />
                              {item.unit && <span className="text-sm text-muted-foreground">{item.unit}</span>}
                              {resp?.isPass === true && <Badge variant="success">pass</Badge>}
                              {resp?.isPass === false && <Badge variant="danger">fail</Badge>}
                            </>
                          ) : item.type === 'text' ? (
                            <Textarea
                              defaultValue={resp?.textValue ?? ''}
                              onBlur={(e) => patch(item.key, { value: e.target.value ? 'observed' : 'not_applicable', textValue: e.target.value })}
                              disabled={!isEditable}
                              className="w-64"
                            />
                          ) : (
                            <div className="flex gap-1">
                              {(['pass', 'fail', 'partial', 'not_applicable'] as const).map((v) => (
                                <Button
                                  key={v}
                                  size="sm"
                                  variant={resp?.value === v ? 'default' : 'outline'}
                                  disabled={!isEditable}
                                  onClick={() => patch(item.key, { value: v })}
                                >
                                  {t(`inspections.response.${v}` as const)}
                                </Button>
                              ))}
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          );
        })}

        {ins.status === 'finalized' && (
          <Card>
            <CardContent className="p-6 space-y-2">
              <div className="text-sm font-semibold">{t('inspections.overallScore')}: {ins.overallScore}%</div>
              <div className="text-sm">Critical: {ins.criticalFailures} · Major: {ins.majorFailures} · Minor: {ins.minorFailures}</div>
              {ins.verdict && <div className="text-sm text-muted-foreground">{ins.verdict}</div>}
              {ins.findings.length > 0 && (
                <div className="text-sm">{ins.findings.length} finding(s) — check the Findings page.</div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
