import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';

type Branch = {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  restaurantType: string;
  status: 'active' | 'inactive' | 'closed_for_renovation' | 'permanently_closed';
  city: string;
};

const statusVariant: Record<Branch['status'], 'success' | 'warning' | 'danger' | 'secondary'> = {
  active: 'success',
  inactive: 'secondary',
  closed_for_renovation: 'warning',
  permanently_closed: 'danger',
};

export function BranchesPage() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language.startsWith('ar');
  const q = useQuery({ queryKey: ['branches'], queryFn: () => api.get<Branch[]>('/branches') });

  return (
    <>
      <PageHeader title={t('branches.title')} />
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('branches.code')}</TableHead>
                <TableHead>{t('branches.name')}</TableHead>
                <TableHead>{t('branches.city')}</TableHead>
                <TableHead>{t('branches.type')}</TableHead>
                <TableHead>{t('branches.status')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.isLoading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    {t('common.loading')}
                  </TableCell>
                </TableRow>
              )}
              {q.data?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    {t('common.empty')}
                  </TableCell>
                </TableRow>
              )}
              {q.data?.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-mono text-xs">{b.code}</TableCell>
                  <TableCell className="font-medium">{isAr ? b.nameAr : b.nameEn}</TableCell>
                  <TableCell>{b.city}</TableCell>
                  <TableCell>{t(`restaurantType.${b.restaurantType}` as const)}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[b.status]}>{t(`status.${b.status}` as const)}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
