import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';

type Category = {
  id: string;
  key: string;
  nameEn: string;
  nameAr: string;
  path: string;
  depth: number;
  defaultAssetKind: string;
  riskLevel: string;
  isSystem: boolean;
  companyId: string | null;
};

export function AssetCategoriesPage() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language.startsWith('ar');
  const categories = useQuery({ queryKey: ['asset-categories'], queryFn: () => api.get<Category[]>('/asset-categories') });

  const sorted = (categories.data ?? []).slice().sort((a, b) => a.path.localeCompare(b.path));

  return (
    <>
      <PageHeader title={t('nav.assetCategories')} />
      <Card>
        <CardContent className="p-6">
          {sorted.length === 0 && <div className="text-muted-foreground text-sm">{t('common.empty')}</div>}
          <ul className="space-y-1 text-sm">
            {sorted.map((c) => (
              <li key={c.id} className="flex items-center gap-3" style={{ paddingInlineStart: `${c.depth * 20}px` }}>
                <span className="font-mono text-xs text-muted-foreground">{c.path}</span>
                <span className="font-medium">{isAr ? c.nameAr : c.nameEn}</span>
                <Badge variant={c.isSystem ? 'secondary' : 'default'}>{c.isSystem ? 'system' : 'custom'}</Badge>
                <Badge variant={c.riskLevel === 'critical' ? 'danger' : c.riskLevel === 'high' ? 'warning' : 'outline'}>
                  {c.riskLevel}
                </Badge>
                <span className="text-xs text-muted-foreground">{c.defaultAssetKind}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </>
  );
}
