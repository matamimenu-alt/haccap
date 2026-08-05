import { AlertOctagon } from 'lucide-react';
import { ResultBadge, SimpleLogPage } from './SimpleLogPage';

type Row = {
  id: string; reference: string | null;
  supplierId: string | null; technicianName: string | null;
  visitedAt: string;
  result: 'clear' | 'evidence_found' | 'infestation' | 'treatment_applied';
  findings: Array<{ location: string; pest?: string }>;
  nextVisitDueOn: string | null;
};

export function PestControlPage() {
  return (
    <SimpleLogPage<Row>
      titleKey="foodSafety.pestControl"
      endpoint="/food-safety/pest-control"
      icon={AlertOctagon}
      dateKey="visitedAt"
      columns={[
        { key: 'ref', label: 'Ref', render: (r) => <span className="font-mono text-xs">{r.reference ?? '—'}</span> },
        { key: 'tech', label: 'Technician', render: (r) => r.technicianName ?? '—' },
        { key: 'result', label: 'Result', render: (r) => (
          <ResultBadge value={r.result} variantMap={{ clear: 'success', evidence_found: 'warning', infestation: 'danger', treatment_applied: 'default' }} />
        ) },
        { key: 'findings', label: 'Findings', render: (r) => <span className="text-xs text-muted-foreground">{r.findings.length} finding(s)</span> },
        { key: 'next', label: 'Next visit', render: (r) => <span className="text-xs text-muted-foreground">{r.nextVisitDueOn ? new Date(r.nextVisitDueOn).toISOString().slice(0, 10) : '—'}</span> },
      ]}
    />
  );
}
