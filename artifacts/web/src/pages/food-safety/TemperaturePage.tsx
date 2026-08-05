import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Plus, ThermometerSun } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';

type Log = {
  id: string;
  branchId: string; areaId: string | null; assetId: string | null;
  kind: string; valueC: string;
  targetMinC: string | null; targetMaxC: string | null;
  isInRange: boolean | null;
  observedAt: string; notes: string | null;
};
type Branch = { id: string; nameEn: string; nameAr: string };
type Area = { id: string; nameEn: string; nameAr: string; branchId: string };

export function TemperaturePage() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language.startsWith('ar');
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const logs = useQuery({ queryKey: ['temperature-logs'], queryFn: () => api.get<Log[]>('/food-safety/temperature-logs') });
  const branches = useQuery({ queryKey: ['branches'], queryFn: () => api.get<Branch[]>('/branches') });
  const [branchId, setBranchId] = useState('');
  const areas = useQuery({ enabled: !!branchId, queryKey: ['areas', branchId], queryFn: () => api.get<Area[]>(`/areas?branchId=${branchId}`) });

  const [form, setForm] = useState({ areaId: '', kind: 'spot', valueC: '', targetMinC: '', targetMaxC: '', notes: '' });
  const mut = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/food-safety/temperature-logs', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['temperature-logs'] });
      setForm({ areaId: '', kind: 'spot', valueC: '', targetMinC: '', targetMaxC: '', notes: '' });
      setOpen(false);
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    mut.mutate({
      branchId, areaId: form.areaId || null,
      kind: form.kind, valueC: Number(form.valueC),
      targetMinC: form.targetMinC ? Number(form.targetMinC) : null,
      targetMaxC: form.targetMaxC ? Number(form.targetMaxC) : null,
      notes: form.notes || null,
    });
  };

  const branchById = new Map((branches.data ?? []).map((b) => [b.id, b]));

  return (
    <>
      <PageHeader
        title={t('foodSafety.temperature')}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4" />{t('foodSafety.newReading')}</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{t('foodSafety.newReading')}</DialogTitle></DialogHeader>
              <form onSubmit={submit} className="grid gap-3">
                <div>
                  <Label>{t('assets.branch')}</Label>
                  <Select value={branchId} onValueChange={setBranchId}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>{branches.data?.map((b) => <SelectItem key={b.id} value={b.id}>{isAr ? b.nameAr : b.nameEn}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t('assets.area')}</Label>
                  <Select value={form.areaId} onValueChange={(v) => setForm({ ...form, areaId: v })}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>{areas.data?.map((a) => <SelectItem key={a.id} value={a.id}>{isAr ? a.nameAr : a.nameEn}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div><Label>Kind</Label><Input value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} /></div>
                  <div><Label>Value (°C)</Label><Input type="number" step="0.1" required value={form.valueC} onChange={(e) => setForm({ ...form, valueC: e.target.value })} /></div>
                  <div><Label>Target</Label><div className="flex gap-1"><Input type="number" step="0.1" placeholder="min" value={form.targetMinC} onChange={(e) => setForm({ ...form, targetMinC: e.target.value })} /><Input type="number" step="0.1" placeholder="max" value={form.targetMaxC} onChange={(e) => setForm({ ...form, targetMaxC: e.target.value })} /></div></div>
                </div>
                <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
                <Button type="submit" disabled={mut.isPending || !branchId}>{mut.isPending ? t('common.loading') : t('actions.save')}</Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {logs.data && logs.data.length === 0 ? (
        <EmptyState icon={ThermometerSun} title={t('common.empty')} />
      ) : (
        <Card><CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Observed</TableHead><TableHead>{t('assets.branch')}</TableHead><TableHead>Kind</TableHead><TableHead>Value</TableHead><TableHead>Target</TableHead><TableHead>In range</TableHead></TableRow></TableHeader>
            <TableBody>
              {logs.data?.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="text-muted-foreground text-xs">{formatDate(l.observedAt, isAr ? 'ar' : 'en')}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{branchById.get(l.branchId) ? (isAr ? branchById.get(l.branchId)!.nameAr : branchById.get(l.branchId)!.nameEn) : '—'}</TableCell>
                  <TableCell>{l.kind}</TableCell>
                  <TableCell className="font-mono">{Number(l.valueC).toFixed(1)}°C</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{l.targetMinC ?? '—'} to {l.targetMaxC ?? '—'}</TableCell>
                  <TableCell>{l.isInRange === null ? '—' : <Badge variant={l.isInRange ? 'success' : 'danger'}>{l.isInRange ? 'in' : 'out'}</Badge>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}
    </>
  );
}
