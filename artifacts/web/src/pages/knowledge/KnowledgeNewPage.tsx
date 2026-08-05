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

type Category = { id: string; nameEn: string; nameAr: string; path: string };

export function KnowledgeNewPage() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language.startsWith('ar');
  const nav = useNavigate();
  const cats = useQuery({ queryKey: ['knowledge-categories'], queryFn: () => api.get<Category[]>('/knowledge/categories') });

  const [form, setForm] = useState({
    key: '',
    kind: 'sop',
    categoryId: '',
    titleAr: '',
    titleEn: '',
    summaryEn: '',
    summaryAr: '',
    bodyMd: '',
    tags: '',
  });
  const [err, setErr] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post<{ id: string }>('/knowledge/articles', body),
    onSuccess: (created) => nav(`/knowledge/${created.id}`),
    onError: (e: Error) => setErr(e.message),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    mutation.mutate({
      key: form.key,
      kind: form.kind,
      categoryId: form.categoryId || null,
      titleAr: form.titleAr,
      titleEn: form.titleEn,
      summaryEn: form.summaryEn || null,
      summaryAr: form.summaryAr || null,
      bodyMd: form.bodyMd,
      tags: form.tags.split(',').map((s) => s.trim()).filter(Boolean),
    });
  };

  return (
    <>
      <PageHeader title={t('knowledge.add')} />
      <Card>
        <CardContent className="p-6">
          <form onSubmit={submit} className="grid gap-4 md:grid-cols-2 max-w-3xl">
            <div className="space-y-2">
              <Label>Key</Label>
              <Input required value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} placeholder="sop.walkin_cooler_temp" />
            </div>
            <div className="space-y-2">
              <Label>Kind</Label>
              <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['sop','policy','guideline','faq','reference','training_material','procedure','checklist','incident_playbook','regulatory_citation','other'].map((k) => (
                    <SelectItem key={k} value={k}>{t(`knowledge.kind.${k}` as const)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Category</Label>
              <Select value={form.categoryId} onValueChange={(v) => setForm({ ...form, categoryId: v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {cats.data?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.path} — {isAr ? c.nameAr : c.nameEn}</SelectItem>
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
              <Label>Summary</Label>
              <Textarea value={form.summaryEn} onChange={(e) => setForm({ ...form, summaryEn: e.target.value })} placeholder="One-liner summary" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Body (Markdown)</Label>
              <Textarea rows={12} value={form.bodyMd} onChange={(e) => setForm({ ...form, bodyMd: e.target.value })} className="font-mono text-xs" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Tags (comma-separated)</Label>
              <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="haccp, temperature, cooler" />
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
