import { Boxes } from 'lucide-react';
import { ResultBadge, SimpleLogPage } from './SimpleLogPage';

type Row = {
  id: string; code: string;
  productNameEn: string; productNameAr: string | null;
  supplierBatchNumber: string | null;
  status: 'received' | 'in_storage' | 'in_prep' | 'in_service' | 'consumed' | 'expired' | 'recalled' | 'discarded';
  productionDate: string | null; expiryDate: string | null;
  initialQuantity: string | null; currentQuantity: string | null; unit: string | null;
  isRecalled: boolean;
};

export function BatchesPage() {
  return (
    <SimpleLogPage<Row>
      titleKey="foodSafety.batches"
      endpoint="/food-safety/batches"
      icon={Boxes}
      columns={[
        { key: 'code', label: 'Batch code', render: (r) => <span className="font-mono text-xs font-medium">{r.code}</span> },
        { key: 'product', label: 'Product', render: (r, isAr) => isAr ? (r.productNameAr ?? r.productNameEn) : r.productNameEn },
        { key: 'supplier_batch', label: 'Supplier batch', render: (r) => <span className="font-mono text-xs text-muted-foreground">{r.supplierBatchNumber ?? '—'}</span> },
        { key: 'quantity', label: 'Quantity', render: (r) => <span className="font-mono text-xs">{r.currentQuantity ?? r.initialQuantity ?? '—'} {r.unit ?? ''}</span> },
        { key: 'expiry', label: 'Expiry', render: (r) => <span className="text-xs text-muted-foreground">{r.expiryDate ?? '—'}</span> },
        { key: 'status', label: 'Status', render: (r) => (
          <ResultBadge value={r.status} variantMap={{ received: 'default', in_storage: 'secondary', in_prep: 'default', in_service: 'default', consumed: 'secondary', expired: 'warning', recalled: 'danger', discarded: 'secondary' }} />
        ) },
      ]}
    />
  );
}
