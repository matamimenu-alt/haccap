import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { LucideIcon } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';

/**
 * A generic list page for the simpler food-safety log types (receiving,
 * cleaning, pest control, calibration, certifications, batches). Each page
 * configures the endpoint + columns.
 */
export function SimpleLogPage<T extends Record<string, unknown> & { id: string }>({
  titleKey,
  endpoint,
  icon: Icon,
  columns,
  dateKey,
}: {
  titleKey: string;
  endpoint: string;
  icon: LucideIcon;
  columns: Array<{
    key: string;
    label: string;
    render: (row: T, isAr: boolean) => React.ReactNode;
  }>;
  dateKey?: keyof T;
}) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language.startsWith('ar');
  const rows = useQuery({ queryKey: [endpoint], queryFn: () => api.get<T[]>(endpoint) });

  return (
    <>
      <PageHeader title={t(titleKey)} />
      {rows.isLoading ? (
        <Card><CardContent className="p-6 text-muted-foreground">{t('common.loading')}</CardContent></Card>
      ) : rows.data && rows.data.length === 0 ? (
        <EmptyState icon={Icon} title={t('common.empty')} />
      ) : (
        <Card><CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                {dateKey && <TableHead>Date</TableHead>}
                {columns.map((c) => <TableHead key={c.key}>{c.label}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.data?.map((row) => (
                <TableRow key={row.id}>
                  {dateKey && <TableCell className="text-muted-foreground text-xs">{formatDate(row[dateKey] as unknown as string, isAr ? 'ar' : 'en')}</TableCell>}
                  {columns.map((c) => <TableCell key={c.key}>{c.render(row, isAr)}</TableCell>)}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}
    </>
  );
}

// Reusable renderers
export function ResultBadge({ value, variantMap }: { value: string; variantMap: Record<string, 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'danger'> }) {
  const variant = variantMap[value] ?? 'secondary';
  return <Badge variant={variant}>{value.replace(/_/g, ' ')}</Badge>;
}
