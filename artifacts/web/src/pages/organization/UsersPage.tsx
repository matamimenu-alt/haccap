import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';

type UserRow = {
  id: string;
  email: string;
  fullNameAr: string;
  fullNameEn: string;
  status: 'active' | 'invited' | 'suspended' | 'deactivated';
  lastLoginAt: string | null;
};

const statusVariant: Record<UserRow['status'], 'success' | 'warning' | 'danger' | 'secondary'> = {
  active: 'success',
  invited: 'warning',
  suspended: 'danger',
  deactivated: 'secondary',
};

export function UsersPage() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language.startsWith('ar');
  const q = useQuery({ queryKey: ['users'], queryFn: () => api.get<UserRow[]>('/users') });

  return (
    <>
      <PageHeader title={t('users.title')} />
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('users.fullName')}</TableHead>
                <TableHead>{t('users.email')}</TableHead>
                <TableHead>{t('users.status')}</TableHead>
                <TableHead>{t('users.lastLogin')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.isLoading && (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">{t('common.loading')}</TableCell>
                </TableRow>
              )}
              {q.data?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">{t('common.empty')}</TableCell>
                </TableRow>
              )}
              {q.data?.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{isAr ? u.fullNameAr : u.fullNameEn}</TableCell>
                  <TableCell className="font-mono text-xs">{u.email}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[u.status]}>{t(`status.${u.status}` as const)}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(u.lastLoginAt, isAr ? 'ar' : 'en')}
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
