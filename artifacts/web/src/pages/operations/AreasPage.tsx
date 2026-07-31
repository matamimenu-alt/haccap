import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';

type Area = {
  id: string;
  code: string;
  nameEn: string;
  nameAr: string;
  branchId: string;
  kind: string;
  riskLevel: string;
  isActive: boolean;
  targetTempMinC: string | null;
  targetTempMaxC: string | null;
};

type Branch = { id: string; nameEn: string; nameAr: string; code: string };

export function AreasPage() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language.startsWith('ar');

  const areas = useQuery({ queryKey: ['areas'], queryFn: () => api.get<Area[]>('/areas') });
  const branches = useQuery({ queryKey: ['branches'], queryFn: () => api.get<Branch[]>('/branches') });

  const branchById = new Map((branches.data ?? []).map((b) => [b.id, b]));

  return (
    <>
      <PageHeader title={t('areas.title')} />
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('nav.branches')}</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>{t('assets.name')}</TableHead>
                <TableHead>{t('assets.kind')}</TableHead>
                <TableHead>Risk</TableHead>
                <TableHead>Temp target</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {areas.data?.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-muted-foreground">{t('common.empty')}</TableCell></TableRow>
              )}
              {areas.data?.map((a) => {
                const b = branchById.get(a.branchId);
                return (
                  <TableRow key={a.id}>
                    <TableCell className="text-muted-foreground">{b ? (isAr ? b.nameAr : b.nameEn) : '—'}</TableCell>
                    <TableCell className="font-mono text-xs">{a.code}</TableCell>
                    <TableCell className="font-medium">{isAr ? a.nameAr : a.nameEn}</TableCell>
                    <TableCell>{t(`areas.kind.${a.kind}` as const)}</TableCell>
                    <TableCell><Badge variant={a.riskLevel === 'critical' ? 'danger' : a.riskLevel === 'high' ? 'warning' : 'secondary'}>{a.riskLevel}</Badge></TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {a.targetTempMinC != null || a.targetTempMaxC != null ? `${a.targetTempMinC ?? '—'} to ${a.targetTempMaxC ?? '—'} °C` : '—'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
