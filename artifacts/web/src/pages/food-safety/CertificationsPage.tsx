import { ShieldCheck } from 'lucide-react';
import { ResultBadge, SimpleLogPage } from './SimpleLogPage';

type Row = {
  id: string; userId: string; kind: string;
  titleEn: string; titleAr: string;
  issuingAuthority: string | null;
  issuedOn: string | null; expiresOn: string | null;
  status: 'active' | 'expiring_soon' | 'expired' | 'revoked' | 'pending';
};

export function CertificationsPage() {
  return (
    <SimpleLogPage<Row>
      titleKey="foodSafety.certifications"
      endpoint="/food-safety/certifications"
      icon={ShieldCheck}
      columns={[
        { key: 'title', label: 'Title', render: (r, isAr) => <span className="font-medium">{isAr ? r.titleAr : r.titleEn}</span> },
        { key: 'kind', label: 'Kind', render: (r) => <span className="text-xs font-mono text-muted-foreground">{r.kind}</span> },
        { key: 'authority', label: 'Authority', render: (r) => r.issuingAuthority ?? '—' },
        { key: 'issued', label: 'Issued', render: (r) => <span className="text-xs text-muted-foreground">{r.issuedOn ?? '—'}</span> },
        { key: 'expires', label: 'Expires', render: (r) => <span className="text-xs text-muted-foreground">{r.expiresOn ?? '—'}</span> },
        { key: 'status', label: 'Status', render: (r) => (
          <ResultBadge value={r.status} variantMap={{ active: 'success', expiring_soon: 'warning', expired: 'danger', revoked: 'secondary', pending: 'outline' }} />
        ) },
      ]}
    />
  );
}
