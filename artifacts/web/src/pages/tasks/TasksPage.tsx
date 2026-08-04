import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ListTodo, Plus, Search } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { TaskPriorityBadge, TaskStatusBadge } from '@/components/shared/task-badges';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';

type Task = {
  id: string;
  code?: string;
  titleAr: string;
  titleEn: string;
  status: 'draft' | 'open' | 'scheduled' | 'in_progress' | 'blocked' | 'in_review' | 'completed' | 'verified' | 'cancelled';
  priority: 'low' | 'normal' | 'high' | 'urgent' | 'critical';
  kind: string;
  dueAt: string | null;
  branchId: string;
};
type Branch = { id: string; nameEn: string; nameAr: string };

export function TasksPage() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language.startsWith('ar');
  const [q, setQ] = useState('');
  const [branchId, setBranchId] = useState('all');
  const [status, setStatus] = useState('all');
  const [overdue, setOverdue] = useState(false);
  const [mine, setMine] = useState(false);

  const branches = useQuery({ queryKey: ['branches'], queryFn: () => api.get<Branch[]>('/branches') });

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (branchId !== 'all') p.set('branchId', branchId);
    if (status !== 'all') p.set('status', status);
    if (overdue) p.set('overdue', 'true');
    if (mine) p.set('assignedToMe', 'true');
    p.set('pageSize', '100');
    return p.toString();
  }, [q, branchId, status, overdue, mine]);

  const tasks = useQuery({ queryKey: ['tasks', params], queryFn: () => api.get<Task[]>(`/tasks?${params}`) });

  return (
    <>
      <PageHeader
        title={t('tasks.title')}
        actions={
          <Button asChild>
            <Link to="/tasks/new">
              <Plus className="h-4 w-4" />
              {t('tasks.add')}
            </Link>
          </Button>
        }
      />

      <Card className="mb-4">
        <CardContent className="p-4 flex flex-col md:flex-row gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute inset-y-0 start-3 my-auto h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('actions.search') ?? ''} className="ps-9" />
          </div>
          <Select value={branchId} onValueChange={setBranchId}>
            <SelectTrigger className="md:w-56"><SelectValue placeholder={t('nav.branches')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">—</SelectItem>
              {branches.data?.map((b) => (
                <SelectItem key={b.id} value={b.id}>{isAr ? b.nameAr : b.nameEn}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="md:w-48"><SelectValue placeholder={t('tasks.status.open')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">—</SelectItem>
              {['open','scheduled','in_progress','blocked','in_review','completed','verified','cancelled'].map((s) => (
                <SelectItem key={s} value={s}>{t(`tasks.status.${s}` as const)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant={overdue ? 'default' : 'outline'} size="sm" onClick={() => setOverdue((v) => !v)}>{t('tasks.overdue')}</Button>
          <Button variant={mine ? 'default' : 'outline'} size="sm" onClick={() => setMine((v) => !v)}>{t('tasks.mine')}</Button>
        </CardContent>
      </Card>

      {tasks.isLoading ? (
        <Card><CardContent className="p-6 text-muted-foreground">{t('common.loading')}</CardContent></Card>
      ) : tasks.data && tasks.data.length === 0 ? (
        <EmptyState
          icon={ListTodo}
          title={t('tasks.empty')}
          description={t('tasks.emptyHint') ?? ''}
          action={<Button asChild><Link to="/tasks/new"><Plus className="h-4 w-4" />{t('tasks.add')}</Link></Button>}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('assets.name')}</TableHead>
                  <TableHead>{t('assets.kind')}</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>{t('tasks.dueAt')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.data?.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell className="font-medium">
                      <Link to={`/tasks/${task.id}`} className="text-primary hover:underline">
                        {isAr ? task.titleAr : task.titleEn}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{t(`tasks.kind.${task.kind}` as const)}</TableCell>
                    <TableCell><TaskStatusBadge status={task.status} /></TableCell>
                    <TableCell><TaskPriorityBadge level={task.priority} /></TableCell>
                    <TableCell className="text-muted-foreground text-xs">{task.dueAt ? formatDate(task.dueAt, isAr ? 'ar' : 'en') : '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </>
  );
}
