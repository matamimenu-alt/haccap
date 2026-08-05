import { Truck } from 'lucide-react';
import { ResultBadge, SimpleLogPage } from './SimpleLogPage';

type Row = {
  id: string; reference: string | null; invoiceNumber: string | null;
  supplierId: string | null; driverName: string | null;
  receivedAt: string; result: 'accepted' | 'partially_accepted' | 'rejected' | 'quarantine';
  vehicleTempC: string | null; productTempC: string | null;
  items: Array<{ nameEn: string; quantity: number; unit: string; accepted: boolean }>;
};

export function ReceivingPage() {
  return (
    <SimpleLogPage<Row>
      titleKey="foodSafety.receiving"
      endpoint="/food-safety/receiving"
      icon={Truck}
      dateKey="receivedAt"
      columns={[
        { key: 'ref', label: 'Ref', render: (r) => <span className="font-mono text-xs">{r.reference ?? '—'}</span> },
        { key: 'invoice', label: 'Invoice', render: (r) => <span className="font-mono text-xs">{r.invoiceNumber ?? '—'}</span> },
        { key: 'items', label: 'Items', render: (r) => <span className="text-xs text-muted-foreground">{r.items.length} item(s)</span> },
        { key: 'temps', label: 'Vehicle / product', render: (r) => (
          <span className="text-xs text-muted-foreground">
            {r.vehicleTempC ? `${Number(r.vehicleTempC).toFixed(1)}°C` : '—'} / {r.productTempC ? `${Number(r.productTempC).toFixed(1)}°C` : '—'}
          </span>
        ) },
        { key: 'result', label: 'Result', render: (r) => (
          <ResultBadge value={r.result} variantMap={{ accepted: 'success', partially_accepted: 'warning', rejected: 'danger', quarantine: 'warning' }} />
        ) },
      ]}
    />
  );
}
