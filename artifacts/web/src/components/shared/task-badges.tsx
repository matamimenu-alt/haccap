import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';

type TaskStatus =
  | 'draft' | 'open' | 'scheduled' | 'in_progress' | 'blocked'
  | 'in_review' | 'completed' | 'verified' | 'cancelled';

const statusVariant: Record<TaskStatus, 'default' | 'secondary' | 'success' | 'warning' | 'danger' | 'outline'> = {
  draft: 'outline',
  open: 'default',
  scheduled: 'secondary',
  in_progress: 'default',
  blocked: 'danger',
  in_review: 'warning',
  completed: 'success',
  verified: 'success',
  cancelled: 'secondary',
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const { t } = useTranslation();
  return <Badge variant={statusVariant[status]}>{t(`tasks.status.${status}` as const)}</Badge>;
}

type Priority = 'low' | 'normal' | 'high' | 'urgent' | 'critical';
const priorityVariant: Record<Priority, 'secondary' | 'outline' | 'warning' | 'danger'> = {
  low: 'outline',
  normal: 'secondary',
  high: 'warning',
  urgent: 'danger',
  critical: 'danger',
};

export function TaskPriorityBadge({ level }: { level: Priority }) {
  const { t } = useTranslation();
  return <Badge variant={priorityVariant[level]}>{t(`tasks.priority.${level}` as const)}</Badge>;
}
