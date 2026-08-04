import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/lib/api';

type Branch = { id: string; nameEn: string; nameAr: string };
type Template = { id: string; titleEn: string; titleAr: string; kind: string; scopeTargets: string[] };

export function InspectionNewPage() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language.startsWith('ar');
  const nav = useNavigate();
  const branches = useQuery({ queryKey: ['branches'], queryFn: () => api.get<Branch[]>('/branches') });
  const templates = useQuery({ queryKey: ['inspection-templates'], queryFn: () => api.get<Template[]>('/inspection-templates') });

  const [branchId, setBranchId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post<{ id: string }>('/inspections', body),
    onSuccess: (created) => nav(`/inspections/${created.id}`),
    onError: (e: Error) => setErr(e.message),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!branchId || !templateId) { setErr('Branch and template are required'); return; }
    mutation.mutate({
      branchId,
      targetType: 'branch',
      targetId: branchId,
      templateId,
    });
  };

  return (
    <>
      <PageHeader title={t('inspections.add')} />
      <Card>
        <CardContent className="p-6">
          <form onSubmit={submit} className="grid gap-4 md:grid-cols-2 max-w-2xl">
            <div className="space-y-2">
              <Label>{t('assets.branch')}</Label>
              <Select value={branchId} onValueChange={setBranchId}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {branches.data?.map((b) => <SelectItem key={b.id} value={b.id}>{isAr ? b.nameAr : b.nameEn}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('inspections.templates')}</Label>
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {templates.data?.map((tpl) => <SelectItem key={tpl.id} value={tpl.id}>{isAr ? tpl.titleAr : tpl.titleEn}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {err && <div className="md:col-span-2 text-sm text-danger">{err}</div>}
            <div className="md:col-span-2 flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => nav(-1)}>{t('actions.cancel')}</Button>
              <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? t('common.loading') : t('actions.save')}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
