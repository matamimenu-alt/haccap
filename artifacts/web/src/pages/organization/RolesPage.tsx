import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';

type Role = {
  id: string;
  key: string;
  nameAr: string;
  nameEn: string;
  isSystem: boolean;
  priority: string;
};

export function RolesPage() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language.startsWith('ar');
  const q = useQuery({ queryKey: ['roles'], queryFn: () => api.get<Role[]>('/roles') });

  return (
    <>
      <PageHeader title={t('nav.roles')} />
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Key</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Type</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.data?.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.key}</TableCell>
                  <TableCell className="font-medium">{isAr ? r.nameAr : r.nameEn}</TableCell>
                  <TableCell>{r.priority}</TableCell>
                  <TableCell>
                    <Badge variant={r.isSystem ? 'secondary' : 'default'}>
                      {r.isSystem ? 'System' : 'Custom'}
                    </Badge>
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
