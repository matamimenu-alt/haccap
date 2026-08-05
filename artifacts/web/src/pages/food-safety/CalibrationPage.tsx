import { Layers3 } from 'lucide-react';
import { ResultBadge, SimpleLogPage } from './SimpleLogPage';

type Row = {
  id: string; reference: string | null;
  method: string; performedAt: string;
  expectedValue: string | null; measuredValue: string | null; tolerance: string | null; unit: string;
  isPass: boolean; adjustmentMade: boolean; nextDueOn: string | null;
};

export function CalibrationPage() {
  return (
    <SimpleLogPage<Row>
      titleKey="foodSafety.calibration"
      endpoint="/food-safety/calibrations"
      icon={Layers3}
      dateKey="performedAt"
      columns={[
        { key: 'ref', label: 'Ref', render: (r) => <span className="font-mono text-xs">{r.reference ?? '—'}</span> },
        { key: 'method', label: 'Method', render: (r) => r.method },
        { key: 'values', label: 'Expected / Measured', render: (r) => (
          <span className="font-mono text-xs">{r.expectedValue ?? '?'} / {r.measuredValue ?? '?'} {r.unit}</span>
        ) },
        { key: 'result', label: 'Result', render: (r) => (
          <ResultBadge value={r.isPass ? 'pass' : 'fail'} variantMap={{ pass: 'success', fail: 'danger' }} />
        ) },
        { key: 'adj', label: 'Adjusted', render: (r) => r.adjustmentMade ? '✓' : '—' },
        { key: 'next', label: 'Next due', render: (r) => <span className="text-xs text-muted-foreground">{r.nextDueOn ? new Date(r.nextDueOn).toISOString().slice(0, 10) : '—'}</span> },
      ]}
    />
  );
}
