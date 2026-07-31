import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/lib/api';

type Branch = { id: string; nameEn: string; nameAr: string };
type Area = { id: string; nameEn: string; nameAr: string; branchId: string };
type Category = { id: string; nameEn: string; nameAr: string; path: string };

export function AssetNewPage() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language.startsWith('ar');
  const nav = useNavigate();

  const branches = useQuery({ queryKey: ['branches'], queryFn: () => api.get<Branch[]>('/branches') });
  const [branchId, setBranchId] = useState('');
  const areas = useQuery({
    enabled: !!branchId,
    queryKey: ['areas', branchId],
    queryFn: () => api.get<Area[]>(`/areas?branchId=${branchId}`),
  });
  const categories = useQuery({
    queryKey: ['asset-categories'],
    queryFn: () => api.get<Category[]>('/asset-categories'),
  });

  const [form, setForm] = useState({
    code: '',
    nameAr: '',
    nameEn: '',
    areaId: '',
    categoryId: '',
    kind: 'equipment',
    manufacturer: '',
    model: '',
    serialNumber: '',
    criticality: 'medium',
    status: 'operational',
  });
  const [err, setErr] = useState<string | null>(null);

  const catOptions = useMemo(
    () => (categories.data ?? []).slice().sort((a, b) => a.path.localeCompare(b.path)),
    [categories.data],
  );

  const mutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post<{ id: string }>('/assets', body),
    onSuccess: (created) => nav(`/operations/assets/${created.id}`),
    onError: (e: Error) => setErr(e.message),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    const payload = {
      branchId,
      code: form.code,
      nameAr: form.nameAr,
      nameEn: form.nameEn,
      areaId: form.areaId || null,
      categoryId: form.categoryId || null,
      kind: form.kind,
      manufacturer: form.manufacturer || null,
      model: form.model || null,
      serialNumber: form.serialNumber || null,
      criticality: form.criticality,
      status: form.status,
    };
    mutation.mutate(payload);
  };

  return (
    <>
      <PageHeader title={t('assets.add')} />
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
              <Label>{t('assets.area')}</Label>
              <Select value={form.areaId} onValueChange={(v) => setForm({ ...form, areaId: v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {areas.data?.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{isAr ? a.nameAr : a.nameEn}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>{t('assets.category')}</Label>
              <Select value={form.categoryId} onValueChange={(v) => setForm({ ...form, categoryId: v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {catOptions.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.path} — {isAr ? c.nameAr : c.nameEn}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('assets.code')}</Label>
              <Input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t('assets.kind')}</Label>
              <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['equipment','fixture','furniture','vehicle','signage','tool','sensor','container','facility','other'].map((k) => (
                    <SelectItem key={k} value={k}>{k}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('assets.name')} (AR)</Label>
              <Input required value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t('assets.name')} (EN)</Label>
              <Input required value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t('assets.manufacturer')}</Label>
              <Input value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t('assets.model')}</Label>
              <Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t('assets.serial')}</Label>
              <Input value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t('assets.criticality.high').split(' ')[0]}</Label>
              <Select value={form.criticality} onValueChange={(v) => setForm({ ...form, criticality: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['low', 'medium', 'high', 'critical'].map((c) => (
                    <SelectItem key={c} value={c}>{t(`assets.criticality.${c}` as const)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {err && <div className="md:col-span-2 text-sm text-danger">{err}</div>}
            <div className="md:col-span-2 flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => nav(-1)}>{t('actions.cancel')}</Button>
              <Button type="submit" disabled={mutation.isPending || !branchId}>{mutation.isPending ? t('common.loading') : t('actions.save')}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
