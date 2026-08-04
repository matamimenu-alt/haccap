import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/lib/api';

type Branch = { id: string; nameEn: string; nameAr: string };
type Asset = { id: string; nameEn: string; nameAr: string; branchId: string };
type Template = { id: string; titleEn: string; titleAr: string; kind: string; defaultPriority: string; defaultRisk: string };

export function TaskNewPage() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language.startsWith('ar');
  const nav = useNavigate();

  const branches = useQuery({ queryKey: ['branches'], queryFn: () => api.get<Branch[]>('/branches') });
  const templates = useQuery({ queryKey: ['task-templates'], queryFn: () => api.get<Template[]>('/task-templates') });
  const [branchId, setBranchId] = useState('');
  const assets = useQuery({
    enabled: !!branchId,
    queryKey: ['assets-for-branch', branchId],
    queryFn: () => api.get<Asset[]>(`/assets?branchId=${branchId}&pageSize=200`),
  });

  const [form, setForm] = useState({
    templateId: '',
    targetType: 'asset' as 'asset' | 'area' | 'branch',
    assetId: '',
    kind: 'ad_hoc',
    titleAr: '',
    titleEn: '',
    description: '',
    priority: 'normal',
    riskLevel: 'medium',
    dueAt: '',
  });
  const [err, setErr] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post<{ id: string }>('/tasks', body),
    onSuccess: (created) => nav(`/tasks/${created.id}`),
    onError: (e: Error) => setErr(e.message),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    const targetId = form.targetType === 'asset' ? form.assetId : branchId;
    if (!branchId || !targetId) {
      setErr('Branch and target are required');
      return;
    }
    mutation.mutate({
      branchId,
      targetType: form.targetType,
      targetId,
      templateId: form.templateId || null,
      kind: form.kind,
      titleAr: form.titleAr,
      titleEn: form.titleEn,
      description: form.description || null,
      priority: form.priority,
      riskLevel: form.riskLevel,
      dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : null,
    });
  };

  return (
    <>
      <PageHeader title={t('tasks.add')} />
      <Card>
        <CardContent className="p-6">
          <form onSubmit={submit} className="grid gap-4 md:grid-cols-2 max-w-3xl">
            <div className="space-y-2">
              <Label>{t('assets.branch')}</Label>
              <Select value={branchId} onValueChange={setBranchId}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {branches.data?.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{isAr ? b.nameAr : b.nameEn}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Target</Label>
              <Select value={form.targetType} onValueChange={(v) => setForm({ ...form, targetType: v as 'asset' | 'area' | 'branch' })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="asset">Asset</SelectItem>
                  <SelectItem value="branch">Branch (facility-wide)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.targetType === 'asset' && (
              <div className="space-y-2 md:col-span-2">
                <Label>Asset</Label>
                <Select value={form.assetId} onValueChange={(v) => setForm({ ...form, assetId: v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {assets.data?.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{isAr ? a.nameAr : a.nameEn}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2 md:col-span-2">
              <Label>Template (optional)</Label>
              <Select value={form.templateId} onValueChange={(v) => {
                const tpl = templates.data?.find((tp) => tp.id === v);
                setForm({
                  ...form,
                  templateId: v,
                  titleAr: form.titleAr || (tpl?.titleAr ?? ''),
                  titleEn: form.titleEn || (tpl?.titleEn ?? ''),
                  kind: tpl?.kind ?? form.kind,
                  priority: tpl?.defaultPriority ?? form.priority,
                  riskLevel: tpl?.defaultRisk ?? form.riskLevel,
                });
              }}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {templates.data?.map((tpl) => (
                    <SelectItem key={tpl.id} value={tpl.id}>{isAr ? tpl.titleAr : tpl.titleEn}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Title (AR)</Label>
              <Input required value={form.titleAr} onChange={(e) => setForm({ ...form, titleAr: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Title (EN)</Label>
              <Input required value={form.titleEn} onChange={(e) => setForm({ ...form, titleEn: e.target.value })} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>

            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['low', 'normal', 'high', 'urgent', 'critical'].map((p) => (
                    <SelectItem key={p} value={p}>{t(`tasks.priority.${p}` as const)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('tasks.dueAt')}</Label>
              <Input type="datetime-local" value={form.dueAt} onChange={(e) => setForm({ ...form, dueAt: e.target.value })} />
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
