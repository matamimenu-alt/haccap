import { Wrench } from 'lucide-react';
import { ResultBadge, SimpleLogPage } from './SimpleLogPage';

type Row = {
  id: string;
  areaId: string | null;
  frequency: string;
  scopeDescription: string | null;
  performedAt: string;
  method: string | null;
  chemicals: Array<{ name: string; concentration?: string }>;
  atpSwabRlu: string | null;
  isVerified: boolean;
};

export function CleaningPage() {
  return (
    <SimpleLogPage<Row>
      titleKey="foodSafety.cleaning"
      endpoint="/food-safety/cleaning"
      icon={Wrench}
      dateKey="performedAt"
      columns={[
        { key: 'freq', label: 'Frequency', render: (r) => r.frequency },
        { key: 'scope', label: 'Scope', render: (r) => <span className="text-xs text-muted-foreground truncate">{r.scopeDescription ?? '—'}</span> },
        { key: 'method', label: 'Method', render: (r) => r.method ?? '—' },
        { key: 'chemicals', label: 'Chemicals', render: (r) => <span className="text-xs text-muted-foreground">{r.chemicals.map((c) => c.name).join(', ') || '—'}</span> },
        { key: 'atp', label: 'ATP (RLU)', render: (r) => <span className="font-mono text-xs">{r.atpSwabRlu ?? '—'}</span> },
        { key: 'verified', label: 'Verified', render: (r) => <ResultBadge value={r.isVerified ? 'verified' : 'pending'} variantMap={{ verified: 'success', pending: 'warning' }} /> },
      ]}
    />
  );
}
