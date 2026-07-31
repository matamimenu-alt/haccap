import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Package, Plus, Search } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { AssetStatusBadge, CriticalityBadge } from '@/components/shared/status-badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/lib/api';

type AssetRow = {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  status: 'operational' | 'needs_repair' | 'under_maintenance' | 'out_of_service' | 'in_storage' | 'decommissioned';
  criticality: 'low' | 'medium' | 'high' | 'critical';
  branchId: string;
  areaId: string | null;
  categoryId: string | null;
  kind: string;
  manufacturer: string | null;
  model: string | null;
};
type Branch = { id: string; nameEn: string; nameAr: string };

const STATUS_ALL = 'all' as const;

export function AssetsPage() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language.startsWith('ar');
  const [q, setQ] = useState('');
  const [branchId, setBranchId] = useState<string>('all');
  const [status, setStatus] = useState<string>(STATUS_ALL);

  const branches = useQuery({ queryKey: ['branches'], queryFn: () => api.get<Branch[]>('/branches') });

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (branchId !== 'all') p.set('branchId', branchId);
    if (status !== 'all') p.set('status', status);
    p.set('pageSize', '100');
    return p.toString();
  }, [q, branchId, status]);

  const assets = useQuery({
    queryKey: ['assets', params],
    queryFn: () => api.get<AssetRow[]>(`/assets?${params}`),
  });

  return (
    <>
      <PageHeader
        title={t('assets.title')}
        actions={
          <Button asChild>
            <Link to="/operations/assets/new">
              <Plus className="h-4 w-4" />
              {t('assets.add')}
            </Link>
          </Button>
        }
      />

      <Card className="mb-4">
        <CardContent className="p-4 flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute inset-y-0 start-3 my-auto h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('actions.search') ?? ''}
              className="ps-9"
            />
          </div>
          <Select value={branchId} onValueChange={setBranchId}>
            <SelectTrigger className="md:w-56"><SelectValue placeholder={t('nav.branches')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('nav.branches')} — {t('common.empty')}</SelectItem>
              {branches.data?.map((b) => (
                <SelectItem key={b.id} value={b.id}>{isAr ? b.nameAr : b.nameEn}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="md:w-48"><SelectValue placeholder={t('assets.status.operational')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">—</SelectItem>
              {['operational','needs_repair','under_maintenance','out_of_service','in_storage','decommissioned'].map((s) => (
                <SelectItem key={s} value={s}>{t(`assets.status.${s}` as const)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {assets.isLoading ? (
        <Card><CardContent className="p-6 text-muted-foreground">{t('common.loading')}</CardContent></Card>
      ) : assets.data && assets.data.length === 0 ? (
        <EmptyState
          icon={Package}
          title={t('assets.empty')}
          description={t('assets.emptyHint') ?? ''}
          action={
            <Button asChild>
              <Link to="/operations/assets/new"><Plus className="h-4 w-4" />{t('assets.add')}</Link>
            </Button>
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('assets.code')}</TableHead>
                  <TableHead>{t('assets.name')}</TableHead>
                  <TableHead>{t('assets.manufacturer')}</TableHead>
                  <TableHead>{t('assets.model')}</TableHead>
                  <TableHead>{t('assets.status.operational').split(' ')[0] /* label header */}</TableHead>
                  <TableHead>{t('assets.criticality.high').split(' ')[0]}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assets.data?.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono text-xs">
                      <Link to={`/operations/assets/${a.id}`} className="text-primary hover:underline">{a.code}</Link>
                    </TableCell>
                    <TableCell className="font-medium">{isAr ? a.nameAr : a.nameEn}</TableCell>
                    <TableCell className="text-muted-foreground">{a.manufacturer ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{a.model ?? '—'}</TableCell>
                    <TableCell><AssetStatusBadge status={a.status} /></TableCell>
                    <TableCell><CriticalityBadge level={a.criticality} /></TableCell>
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
