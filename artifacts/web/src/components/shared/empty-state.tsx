import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <Card>
      <CardContent className="p-12 text-center flex flex-col items-center gap-3">
        {Icon && <Icon className="h-10 w-10 text-muted-foreground/60" />}
        <div className="font-medium">{title}</div>
        {description && <div className="text-sm text-muted-foreground max-w-md">{description}</div>}
        {action && <div className="mt-2">{action}</div>}
      </CardContent>
    </Card>
  );
}
