import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';

type AssetStatus =
  | 'operational'
  | 'needs_repair'
  | 'under_maintenance'
  | 'out_of_service'
  | 'in_storage'
  | 'decommissioned';

const variantByStatus: Record<AssetStatus, 'success' | 'warning' | 'danger' | 'secondary'> = {
  operational: 'success',
  needs_repair: 'warning',
  under_maintenance: 'warning',
  out_of_service: 'danger',
  in_storage: 'secondary',
  decommissioned: 'secondary',
};

export function AssetStatusBadge({ status }: { status: AssetStatus }) {
  const { t } = useTranslation();
  return <Badge variant={variantByStatus[status]}>{t(`assets.status.${status}` as const)}</Badge>;
}

type Criticality = 'low' | 'medium' | 'high' | 'critical';
const variantByCriticality: Record<Criticality, 'secondary' | 'default' | 'warning' | 'danger'> = {
  low: 'secondary',
  medium: 'default',
  high: 'warning',
  critical: 'danger',
};

export function CriticalityBadge({ level }: { level: Criticality }) {
  const { t } = useTranslation();
  return <Badge variant={variantByCriticality[level]}>{t(`assets.criticality.${level}` as const)}</Badge>;
}
