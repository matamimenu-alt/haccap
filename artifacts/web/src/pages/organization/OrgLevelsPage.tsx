import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';

type OrgLevel = { id: string; depth: number; nameAr: string; nameEn: string };

export function OrgLevelsPage() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language.startsWith('ar');
  const q = useQuery({ queryKey: ['org-levels'], queryFn: () => api.get<OrgLevel[]>('/org-levels') });

  return (
    <>
      <PageHeader title={t('nav.orgLevels')} />
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Depth</TableHead>
                <TableHead>Name</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.data?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={2} className="text-muted-foreground">{t('common.empty')}</TableCell>
                </TableRow>
              )}
              {q.data?.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>{l.depth}</TableCell>
                  <TableCell className="font-medium">{isAr ? l.nameAr : l.nameEn}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
