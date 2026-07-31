import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';

type Supplier = {
  id: string;
  code: string | null;
  nameEn: string;
  nameAr: string;
  city: string | null;
  categories: string[];
  isPreferred: boolean;
  isActive: boolean;
};

export function SuppliersPage() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language.startsWith('ar');
  const suppliers = useQuery({ queryKey: ['suppliers'], queryFn: () => api.get<Supplier[]>('/suppliers') });

  return (
    <>
      <PageHeader title={t('suppliers.title')} />
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>{t('assets.name')}</TableHead>
                <TableHead>{t('suppliers.categories')}</TableHead>
                <TableHead>{t('branches.city')}</TableHead>
                <TableHead>{t('suppliers.preferred')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.data?.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-muted-foreground">{t('common.empty')}</TableCell></TableRow>
              )}
              {suppliers.data?.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-xs">{s.code ?? '—'}</TableCell>
                  <TableCell className="font-medium">{isAr ? s.nameAr : s.nameEn}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    <div className="flex flex-wrap gap-1">
                      {s.categories.map((c) => <Badge key={c} variant="outline">{c}</Badge>)}
                    </div>
                  </TableCell>
                  <TableCell>{s.city ?? '—'}</TableCell>
                  <TableCell>{s.isPreferred && <Badge variant="success">★</Badge>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
