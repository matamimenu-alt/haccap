import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

type Resolved = {
  assetId: string;
  code: string;
  nameEn: string;
  nameAr: string;
  status: string;
  criticality: string;
  branch: { id: string; nameEn: string | null };
  area: { id: string; nameEn: string | null } | null;
};

export function QrScanPage() {
  const { token } = useParams<{ token: string }>();
  const { t, i18n } = useTranslation();
  const isAr = i18n.language.startsWith('ar');
  const [state, setState] = useState<{ loading: boolean; data?: Resolved; error?: string }>({ loading: true });

  useEffect(() => {
    if (!token) return;
    api
      .get<Resolved>(`/qr/scan/${token}`)
      .then((data) => setState({ loading: false, data }))
      .catch((e: Error) => setState({ loading: false, error: e.message }));
  }, [token]);

  return (
    <>
      <PageHeader title={`QR · ${token}`} />
      <Card>
        <CardContent className="p-6">
          {state.loading && <div>{t('common.loading')}</div>}
          {state.error && <div className="text-danger">{state.error}</div>}
          {state.data && (
            <div className="space-y-3">
              <div className="text-xl font-semibold">{isAr ? state.data.nameAr : state.data.nameEn}</div>
              <div className="text-sm text-muted-foreground">
                {state.data.code} · {state.data.branch.nameEn ?? ''} {state.data.area ? `· ${state.data.area.nameEn ?? ''}` : ''}
              </div>
              <div className="flex gap-2 text-sm">
                <span>Status: <strong>{state.data.status}</strong></span>
                <span>Criticality: <strong>{state.data.criticality}</strong></span>
              </div>
              <Button asChild>
                <Link to={`/operations/assets/${state.data.assetId}`}>Open asset</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
