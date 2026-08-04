import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { CheckSquare, Square } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { TaskPriorityBadge, TaskStatusBadge } from '@/components/shared/task-badges';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';

type ChecklistState = Record<string, { done: boolean; note?: string; at?: string; byUserId?: string; value?: unknown }>;

type TaskHydrated = {
  id: string;
  titleAr: string;
  titleEn: string;
  description: string | null;
  status: 'draft' | 'open' | 'scheduled' | 'in_progress' | 'blocked' | 'in_review' | 'completed' | 'verified' | 'cancelled';
  priority: 'low' | 'normal' | 'high' | 'urgent' | 'critical';
  kind: string;
  dueAt: string | null;
  primaryAssigneeUserId: string | null;
  aiSummary: string | null;
  checklistState: ChecklistState;
  template: {
    id: string;
    checklistItems: Array<{ key: string; labelAr: string; labelEn: string; required: boolean; type: string }>;
    requiredAttachments: Array<{ kind: string; minCount: number; labelAr: string; labelEn: string }>;
  } | null;
  branch: { id: string; nameEn: string | null; nameAr: string | null };
  area: { id: string; nameEn: string | null; nameAr: string | null } | null;
};

type Comment = { id: string; authorUserId: string; body: string; createdAt: string };
type Event = { id: string; eventType: string; actorUserId: string | null; source: string; payload: Record<string, unknown>; createdAt: string };

export function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const isAr = i18n.language.startsWith('ar');
  const qc = useQueryClient();

  const task = useQuery({ enabled: !!id, queryKey: ['task', id], queryFn: () => api.get<TaskHydrated>(`/tasks/${id}`) });
  const events = useQuery({ enabled: !!id, queryKey: ['task', id, 'events'], queryFn: () => api.get<Event[]>(`/tasks/${id}/events`) });
  const comments = useQuery({ enabled: !!id, queryKey: ['task', id, 'comments'], queryFn: () => api.get<Comment[]>(`/tasks/${id}/comments`) });

  const [commentBody, setCommentBody] = useState('');

  const transition = useMutation({
    mutationFn: async (action: 'start' | 'submit' | 'complete' | 'verify' | 'cancel') => {
      const body = action === 'cancel' ? { reason: 'Cancelled from UI' } : {};
      return api.post(`/tasks/${id}/${action}`, body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task', id] });
      qc.invalidateQueries({ queryKey: ['task', id, 'events'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const checklistMut = useMutation({
    mutationFn: (input: { itemKey: string; done: boolean }) =>
      api.patch(`/tasks/${id}/checklist/${input.itemKey}`, { done: input.done }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task', id] });
      qc.invalidateQueries({ queryKey: ['task', id, 'events'] });
    },
  });

  const commentMut = useMutation({
    mutationFn: (body: string) => api.post(`/tasks/${id}/comments`, { body }),
    onSuccess: () => {
      setCommentBody('');
      qc.invalidateQueries({ queryKey: ['task', id, 'comments'] });
      qc.invalidateQueries({ queryKey: ['task', id, 'events'] });
    },
  });

  if (task.isLoading) return <div>{t('common.loading')}</div>;
  if (!task.data) return <div>{t('common.error')}</div>;
  const tk = task.data;

  return (
    <>
      <PageHeader
        title={isAr ? tk.titleAr : tk.titleEn}
        description={`${t(`tasks.kind.${tk.kind}` as const)} · ${tk.branch.nameEn ?? ''}${tk.area ? ` · ${tk.area.nameEn ?? ''}` : ''}`}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <TaskStatusBadge status={tk.status} />
            <TaskPriorityBadge level={tk.priority} />
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {tk.status === 'open' || tk.status === 'scheduled' ? (
          <Button size="sm" onClick={() => transition.mutate('start')} disabled={transition.isPending}>{t('tasks.actions.start')}</Button>
        ) : null}
        {tk.status === 'in_progress' ? (
          <>
            <Button size="sm" onClick={() => transition.mutate('submit')} disabled={transition.isPending}>{t('tasks.actions.submit')}</Button>
            <Button size="sm" variant="secondary" onClick={() => transition.mutate('complete')} disabled={transition.isPending}>{t('tasks.actions.complete')}</Button>
          </>
        ) : null}
        {tk.status === 'in_review' || tk.status === 'completed' ? (
          <Button size="sm" onClick={() => transition.mutate('verify')} disabled={transition.isPending}>{t('tasks.actions.verify')}</Button>
        ) : null}
        {!['cancelled', 'verified'].includes(tk.status) && (
          <Button size="sm" variant="ghost" onClick={() => transition.mutate('cancel')} disabled={transition.isPending}>{t('tasks.actions.cancel')}</Button>
        )}
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">{t('tasks.detail.overview')}</TabsTrigger>
          <TabsTrigger value="checklist">{t('tasks.detail.checklist')}</TabsTrigger>
          <TabsTrigger value="comments">{t('tasks.detail.comments')}</TabsTrigger>
          <TabsTrigger value="history">{t('tasks.detail.history')}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 text-sm">
                <Field label={t('tasks.dueAt')} value={tk.dueAt ? formatDate(tk.dueAt, isAr ? 'ar' : 'en') : '—'} />
                <Field label="Priority" value={tk.priority} />
                <Field label={t('assets.branch')} value={tk.branch.nameEn ?? '—'} />
                <Field label={t('assets.area')} value={tk.area?.nameEn ?? '—'} />
              </div>
              {tk.description && <p className="text-sm">{tk.description}</p>}
              {tk.aiSummary && (
                <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground">AI · {tk.aiSummary}</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="checklist">
          <Card>
            <CardContent className="p-6">
              {tk.template?.checklistItems?.length ? (
                <ul className="space-y-2">
                  {tk.template.checklistItems.map((item) => {
                    const state = tk.checklistState?.[item.key];
                    const done = !!state?.done;
                    return (
                      <li key={item.key} className="flex items-start gap-3">
                        <button
                          type="button"
                          className="mt-0.5"
                          onClick={() => checklistMut.mutate({ itemKey: item.key, done: !done })}
                          aria-label={item.labelEn}
                        >
                          {done ? <CheckSquare className="h-5 w-5 text-primary" /> : <Square className="h-5 w-5 text-muted-foreground" />}
                        </button>
                        <div className="flex-1">
                          <div className={`text-sm ${done ? 'line-through text-muted-foreground' : ''}`}>
                            {isAr ? item.labelAr : item.labelEn}
                            {item.required && <span className="text-danger ms-1">*</span>}
                          </div>
                          {state?.at && (
                            <div className="text-xs text-muted-foreground">
                              {formatDate(state.at, isAr ? 'ar' : 'en')}
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="text-muted-foreground text-sm">{t('common.empty')}</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="comments">
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-3">
                {comments.data?.length ? (
                  <ul className="divide-y">
                    {comments.data.map((c) => (
                      <li key={c.id} className="py-3 text-sm">
                        <div className="text-xs text-muted-foreground mb-1">{formatDate(c.createdAt, isAr ? 'ar' : 'en')}</div>
                        <div>{c.body}</div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-muted-foreground text-sm">{t('common.empty')}</div>
                )}
              </div>
              <div className="pt-2 border-t space-y-2">
                <Textarea value={commentBody} onChange={(e) => setCommentBody(e.target.value)} placeholder="Add a comment…" />
                <div className="flex justify-end">
                  <Button size="sm" disabled={!commentBody.trim() || commentMut.isPending} onClick={() => commentMut.mutate(commentBody.trim())}>
                    {t('actions.add')}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardContent className="p-6">
              {events.data?.length ? (
                <ul className="space-y-3">
                  {events.data.map((e) => (
                    <li key={e.id} className="flex gap-3 text-sm">
                      <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                      <div className="flex-1">
                        <div className="font-medium">{e.eventType.replace(/_/g, ' ')}</div>
                        <div className="text-xs text-muted-foreground">{formatDate(e.createdAt, isAr ? 'ar' : 'en')} · {e.source}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-muted-foreground text-sm">{t('common.empty')}</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
