import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';

type Department = { id: string; nameAr: string; nameEn: string; code: string | null };

export function DepartmentsPage() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language.startsWith('ar');
  const q = useQuery({ queryKey: ['departments'], queryFn: () => api.get<Department[]>('/departments') });

  return (
    <>
      <PageHeader title={t('nav.departments')} />
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.data?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={2} className="text-muted-foreground">{t('common.empty')}</TableCell>
                </TableRow>
              )}
              {q.data?.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-mono text-xs">{d.code ?? '—'}</TableCell>
                  <TableCell className="font-medium">{isAr ? d.nameAr : d.nameEn}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
