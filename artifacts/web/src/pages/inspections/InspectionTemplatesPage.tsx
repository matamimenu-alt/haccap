import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';

type Template = {
  id: string;
  key: string;
  version: number;
  titleAr: string;
  titleEn: string;
  kind: string;
  passThreshold: number;
  issuingAuthority: string | null;
  sections: unknown[];
  items: unknown[];
};

export function InspectionTemplatesPage() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language.startsWith('ar');
  const q = useQuery({ queryKey: ['inspection-templates'], queryFn: () => api.get<Template[]>('/inspection-templates') });

  return (
    <>
      <PageHeader title={t('inspections.templates')} />
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Key</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Authority</TableHead>
                <TableHead>Sections</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Pass %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.data?.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-muted-foreground">{t('common.empty')}</TableCell></TableRow>
              )}
              {q.data?.map((tpl) => (
                <TableRow key={tpl.id}>
                  <TableCell className="font-mono text-xs">{tpl.key} v{tpl.version}</TableCell>
                  <TableCell className="font-medium">{isAr ? tpl.titleAr : tpl.titleEn}</TableCell>
                  <TableCell>{t(`inspections.kind.${tpl.kind}` as const)}</TableCell>
                  <TableCell className="text-muted-foreground">{tpl.issuingAuthority ?? '—'}</TableCell>
                  <TableCell>{tpl.sections.length}</TableCell>
                  <TableCell>{tpl.items.length}</TableCell>
                  <TableCell><Badge variant="secondary">{tpl.passThreshold}%</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
