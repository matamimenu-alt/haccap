import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import { PageHeader } from '@/components/shared/page-header';
import { AssetStatusBadge, CriticalityBadge } from '@/components/shared/status-badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';

type HydratedAsset = {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  status: 'operational' | 'needs_repair' | 'under_maintenance' | 'out_of_service' | 'in_storage' | 'decommissioned';
  criticality: 'low' | 'medium' | 'high' | 'critical';
  manufacturer: string | null;
  model: string | null;
  serialNumber: string | null;
  spec: Record<string, unknown>;
  aiSummary: string | null;
  branch: { id: string; nameEn: string; nameAr: string };
  area: { id: string; nameEn: string; nameAr: string; kind: string } | null;
  category: { id: string; path: string; nameEn: string; nameAr: string } | null;
  supplier: { id: string; nameEn: string } | null;
  activeQr: { token: string; scanUrl: string } | null;
  tags: { id: string; labelEn: string; labelAr: string; colorHex: string | null }[];
  purchaseDate: string | null;
  purchaseCost: string | null;
  currency: string;
  installedDate: string | null;
};

type AssetEvent = {
  id: string;
  eventType: string;
  actorUserId: string | null;
  source: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

type Warranty = {
  id: string;
  type: string;
  startsOn: string;
  endsOn: string;
  coverageSummary: string | null;
  isActive: boolean;
};

type Schedule = {
  id: string;
  titleAr: string;
  titleEn: string;
  frequency: string;
  nextDueAt: string | null;
  isActive: boolean;
};

type AttachmentItem = {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  kind: 'document' | 'photo' | 'video' | 'audio' | 'other';
  url: string;
  createdAt: string;
};

export function AssetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const isAr = i18n.language.startsWith('ar');

  const asset = useQuery({
    enabled: !!id,
    queryKey: ['asset', id],
    queryFn: () => api.get<HydratedAsset>(`/assets/${id}`),
  });

  const events = useQuery({
    enabled: !!id,
    queryKey: ['asset', id, 'events'],
    queryFn: () => api.get<AssetEvent[]>(`/assets/${id}/events`),
  });

  const warranties = useQuery({
    enabled: !!id,
    queryKey: ['asset', id, 'warranties'],
    queryFn: () => api.get<Warranty[]>(`/assets/${id}/warranties`),
  });

  const schedules = useQuery({
    enabled: !!id,
    queryKey: ['asset', id, 'schedules'],
    queryFn: () => api.get<Schedule[]>(`/assets/${id}/maintenance-schedules`),
  });

  const docs = useQuery({
    enabled: !!id,
    queryKey: ['asset', id, 'documents'],
    queryFn: () => api.get<AttachmentItem[]>(`/attachments?targetType=asset&targetId=${id}`),
  });

  if (asset.isLoading) return <div>{t('common.loading')}</div>;
  if (!asset.data) return <div>{t('common.error')}</div>;

  const a = asset.data;
  const photos = (docs.data ?? []).filter((d) => d.kind === 'photo');
  const documents = (docs.data ?? []).filter((d) => d.kind !== 'photo');

  return (
    <>
      <PageHeader
        title={isAr ? a.nameAr : a.nameEn}
        description={`${a.code} · ${a.manufacturer ?? '—'} ${a.model ?? ''}`}
        actions={
          <div className="flex items-center gap-2">
            <AssetStatusBadge status={a.status} />
            <CriticalityBadge level={a.criticality} />
          </div>
        }
      />

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">{t('assets.overview')}</TabsTrigger>
          <TabsTrigger value="spec">{t('assets.spec')}</TabsTrigger>
          <TabsTrigger value="warranties">{t('assets.warranties')}</TabsTrigger>
          <TabsTrigger value="maintenance">{t('assets.maintenanceTab')}</TabsTrigger>
          <TabsTrigger value="documents">{t('assets.documents')}</TabsTrigger>
          <TabsTrigger value="photos">{t('assets.photos')}</TabsTrigger>
          <TabsTrigger value="history">{t('assets.history')}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="md:col-span-2">
              <CardContent className="p-6 space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 text-sm">
                  <Field label={t('assets.branch')} value={isAr ? a.branch.nameAr : a.branch.nameEn} />
                  <Field label={t('assets.area')} value={a.area ? (isAr ? a.area.nameAr : a.area.nameEn) : '—'} />
                  <Field label={t('assets.category')} value={a.category ? (isAr ? a.category.nameAr : a.category.nameEn) : '—'} />
                  <Field label={t('assets.supplier')} value={a.supplier?.nameEn ?? '—'} />
                  <Field label={t('assets.serial')} value={a.serialNumber ?? '—'} />
                  <Field label={t('assets.purchaseDate')} value={a.purchaseDate ?? '—'} />
                  <Field label={t('assets.purchaseCost')} value={a.purchaseCost ? `${a.purchaseCost} ${a.currency}` : '—'} />
                  <Field label={t('assets.installedDate')} value={a.installedDate ?? '—'} />
                </div>
                {a.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {a.tags.map((tag) => (
                      <Badge key={tag.id} variant="secondary" style={tag.colorHex ? { backgroundColor: `${tag.colorHex}20`, color: tag.colorHex } : undefined}>
                        {isAr ? tag.labelAr : tag.labelEn}
                      </Badge>
                    ))}
                  </div>
                )}
                {a.aiSummary && (
                  <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
                    AI · {a.aiSummary}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 flex flex-col items-center gap-3">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">QR</div>
                {a.activeQr ? (
                  <>
                    <QRCodeSVG value={a.activeQr.scanUrl} size={168} />
                    <div className="text-xs font-mono text-muted-foreground truncate max-w-full">{a.activeQr.token}</div>
                  </>
                ) : (
                  <div className="text-sm text-muted-foreground">—</div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="spec">
          <Card>
            <CardContent className="p-6">
              {Object.keys(a.spec).length === 0 ? (
                <div className="text-muted-foreground text-sm">{t('common.empty')}</div>
              ) : (
                <dl className="grid gap-3 sm:grid-cols-2 text-sm">
                  {Object.entries(a.spec).map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{k}</dt>
                      <dd className="font-medium">{String(v ?? '—')}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="warranties">
          <Card>
            <CardContent className="p-6">
              {warranties.data?.length ? (
                <ul className="divide-y">
                  {warranties.data.map((w) => (
                    <li key={w.id} className="py-3 flex items-center justify-between text-sm">
                      <div>
                        <div className="font-medium">{w.type}</div>
                        <div className="text-muted-foreground text-xs">{w.startsOn} → {w.endsOn}</div>
                      </div>
                      <Badge variant={w.isActive ? 'success' : 'secondary'}>{w.isActive ? 'active' : 'ended'}</Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-muted-foreground text-sm">{t('common.empty')}</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="maintenance">
          <Card>
            <CardContent className="p-6">
              {schedules.data?.length ? (
                <ul className="divide-y">
                  {schedules.data.map((s) => (
                    <li key={s.id} className="py-3 flex items-center justify-between text-sm">
                      <div>
                        <div className="font-medium">{isAr ? s.titleAr : s.titleEn}</div>
                        <div className="text-muted-foreground text-xs">
                          {s.frequency} · next: {s.nextDueAt ? formatDate(s.nextDueAt, isAr ? 'ar' : 'en') : '—'}
                        </div>
                      </div>
                      <Badge variant={s.isActive ? 'success' : 'secondary'}>{s.isActive ? 'active' : 'paused'}</Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-muted-foreground text-sm">{t('common.empty')}</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardContent className="p-6">
              {documents.length ? (
                <ul className="divide-y">
                  {documents.map((d) => (
                    <li key={d.id} className="py-2 flex items-center justify-between text-sm">
                      <a href={d.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">{d.filename}</a>
                      <span className="text-xs text-muted-foreground">{(d.sizeBytes / 1024).toFixed(1)} KB</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-muted-foreground text-sm">{t('common.empty')}</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="photos">
          <Card>
            <CardContent className="p-6">
              {photos.length ? (
                <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4">
                  {photos.map((p) => (
                    <a key={p.id} href={p.url} target="_blank" rel="noreferrer" className="block aspect-square overflow-hidden rounded-md bg-muted">
                      <img src={p.url} alt={p.filename} className="w-full h-full object-cover" />
                    </a>
                  ))}
                </div>
              ) : (
                <div className="text-muted-foreground text-sm">{t('common.empty')}</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardContent className="p-6">
              {events.data?.length ? (
                <ul className="space-y-3">
                  {events.data.map((e) => (
                    <li key={e.id} className="flex gap-3 text-sm">
                      <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                      <div className="flex-1">
                        <div className="font-medium">{e.eventType.replace(/_/g, ' ')}</div>
                        <div className="text-xs text-muted-foreground">{formatDate(e.createdAt, isAr ? 'ar' : 'en')} · {e.source}</div>
                        {Object.keys(e.payload).length > 0 && (
                          <pre className="mt-1 text-xs bg-muted rounded px-2 py-1 overflow-x-auto">{JSON.stringify(e.payload, null, 0)}</pre>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-muted-foreground text-sm">{t('common.empty')}</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
