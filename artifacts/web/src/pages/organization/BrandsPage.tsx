import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';

type Brand = {
  id: string;
  nameAr: string;
  nameEn: string;
  slug: string;
  description: string | null;
};

export function BrandsPage() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language.startsWith('ar');
  const q = useQuery({ queryKey: ['brands'], queryFn: () => api.get<Brand[]>('/brands') });

  return (
    <>
      <PageHeader title={t('brands.title')} />
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('brands.slug')}</TableHead>
                <TableHead>{isAr ? t('brands.title') : 'Name'}</TableHead>
                <TableHead>{t('brands.description')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.isLoading && (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted-foreground">
                    {t('common.loading')}
                  </TableCell>
                </TableRow>
              )}
              {q.data?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted-foreground">
                    {t('common.empty')}
                  </TableCell>
                </TableRow>
              )}
              {q.data?.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-mono text-xs">{b.slug}</TableCell>
                  <TableCell className="font-medium">{isAr ? b.nameAr : b.nameEn}</TableCell>
                  <TableCell className="text-muted-foreground">{b.description ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
