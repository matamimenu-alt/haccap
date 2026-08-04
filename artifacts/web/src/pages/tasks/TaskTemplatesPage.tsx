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
  titleAr: string;
  titleEn: string;
  kind: string;
  defaultPriority: string;
  defaultRisk: string;
  estimatedDurationMinutes: number | null;
  requiresVerification: boolean;
  checklistItems: unknown[];
  isSystem: boolean;
};

export function TaskTemplatesPage() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language.startsWith('ar');
  const q = useQuery({ queryKey: ['task-templates'], queryFn: () => api.get<Template[]>('/task-templates') });

  return (
    <>
      <PageHeader title={t('tasks.templates.title')} />
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Key</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Est.</TableHead>
                <TableHead>Steps</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.data?.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-muted-foreground">{t('common.empty')}</TableCell></TableRow>
              )}
              {q.data?.map((tpl) => (
                <TableRow key={tpl.id}>
                  <TableCell className="font-mono text-xs">{tpl.key}</TableCell>
                  <TableCell className="font-medium">{isAr ? tpl.titleAr : tpl.titleEn}</TableCell>
                  <TableCell>{t(`tasks.kind.${tpl.kind}` as const)}</TableCell>
                  <TableCell><Badge variant={tpl.defaultPriority === 'critical' ? 'danger' : tpl.defaultPriority === 'high' ? 'warning' : 'secondary'}>{t(`tasks.priority.${tpl.defaultPriority}` as const)}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">{tpl.estimatedDurationMinutes ? `${tpl.estimatedDurationMinutes}m` : '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{tpl.checklistItems?.length ?? 0}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
