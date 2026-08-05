import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';

type Article = {
  id: string;
  key: string;
  version: number;
  kind: string;
  status: 'draft' | 'in_review' | 'published' | 'archived';
  titleAr: string;
  titleEn: string;
  summaryAr: string | null;
  summaryEn: string | null;
  bodyMd: string;
  bodyMdAr: string | null;
  tags: string[];
  references: Array<{ authority: string; ref: string; url?: string; note?: string }>;
  requiresAcknowledgement: boolean;
  publishedAt: string | null;
  updatedAt: string;
  links: Array<{ id: string; targetType: string; targetRef: string; label: string | null }>;
  versions: Array<{ id: string; version: number; createdAt: string; changelog: string | null }>;
};

const statusVariant = { draft: 'outline', in_review: 'warning', published: 'success', archived: 'secondary' } as const;

// Extremely small Markdown → JSX renderer for Phase 5: handles #, ##, ###,
// bullet lists, bold **, and paragraph breaks. Full renderer swaps in later.
function renderMd(md: string): React.ReactNode {
  const blocks = md.split(/\n{2,}/);
  return blocks.map((block, i) => {
    const trimmed = block.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('### ')) return <h3 key={i} className="text-base font-semibold mt-4 mb-2">{trimmed.slice(4)}</h3>;
    if (trimmed.startsWith('## '))  return <h2 key={i} className="text-lg font-semibold mt-6 mb-2">{trimmed.slice(3)}</h2>;
    if (trimmed.startsWith('# '))   return <h1 key={i} className="text-xl font-semibold mt-6 mb-3">{trimmed.slice(2)}</h1>;
    if (/^([-*]|\d+\.)\s/m.test(trimmed)) {
      const isOl = /^\d+\.\s/.test(trimmed);
      const items = trimmed.split(/\n/).map((l) => l.replace(/^([-*]|\d+\.)\s+/, ''));
      const Tag = isOl ? 'ol' : 'ul';
      return (
        <Tag key={i} className={isOl ? 'list-decimal ps-6 space-y-1 my-2' : 'list-disc ps-6 space-y-1 my-2'}>
          {items.map((it, j) => <li key={j}>{renderInline(it)}</li>)}
        </Tag>
      );
    }
    return <p key={i} className="my-2 leading-relaxed">{renderInline(trimmed)}</p>;
  });
}
function renderInline(s: string): React.ReactNode {
  const parts = s.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) return <strong key={i}>{p.slice(2, -2)}</strong>;
    return <span key={i}>{p}</span>;
  });
}

export function KnowledgeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const isAr = i18n.language.startsWith('ar');
  const qc = useQueryClient();

  const article = useQuery({ enabled: !!id, queryKey: ['knowledge-article', id], queryFn: () => api.get<Article>(`/knowledge/articles/${id}`) });

  const publishMut = useMutation({
    mutationFn: () => api.post(`/knowledge/articles/${id}/publish`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['knowledge-article', id] }),
  });
  const archiveMut = useMutation({
    mutationFn: () => api.post(`/knowledge/articles/${id}/archive`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['knowledge-article', id] }),
  });

  const body = useMemo(() => {
    if (!article.data) return '';
    return isAr && article.data.bodyMdAr ? article.data.bodyMdAr : article.data.bodyMd;
  }, [article.data, isAr]);

  if (article.isLoading) return <div>{t('common.loading')}</div>;
  if (!article.data) return <div>{t('common.error')}</div>;
  const a = article.data;

  return (
    <>
      <PageHeader
        title={isAr ? a.titleAr : a.titleEn}
        description={a.key}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="outline">{t(`knowledge.kind.${a.kind}` as const)} · v{a.version}</Badge>
            <Badge variant={statusVariant[a.status]}>{t(`knowledge.status.${a.status}` as const)}</Badge>
            {a.status === 'draft' || a.status === 'in_review' ? (
              <Button size="sm" onClick={() => publishMut.mutate()} disabled={publishMut.isPending}>{t('knowledge.publish')}</Button>
            ) : null}
            {a.status !== 'archived' && a.status !== 'draft' && (
              <Button size="sm" variant="ghost" onClick={() => archiveMut.mutate()} disabled={archiveMut.isPending}>{t('knowledge.archive')}</Button>
            )}
          </div>
        }
      />

      <Tabs defaultValue="body">
        <TabsList>
          <TabsTrigger value="body">Body</TabsTrigger>
          <TabsTrigger value="references">{t('knowledge.references')}</TabsTrigger>
          <TabsTrigger value="links">{t('knowledge.linkedTo')}</TabsTrigger>
          <TabsTrigger value="versions">{t('knowledge.versionHistory')}</TabsTrigger>
        </TabsList>

        <TabsContent value="body">
          <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
            <Card>
              <CardContent className="p-6 prose prose-sm max-w-none dark:prose-invert">
                {(isAr ? a.summaryAr : a.summaryEn) && (
                  <div className="text-sm text-muted-foreground border-l-2 border-primary ps-3 mb-4">
                    {isAr ? a.summaryAr : a.summaryEn}
                  </div>
                )}
                {renderMd(body)}
              </CardContent>
            </Card>
            <div className="space-y-4">
              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Meta</div>
                  <div className="text-sm">Updated {formatDate(a.updatedAt, isAr ? 'ar' : 'en')}</div>
                  {a.publishedAt && <div className="text-sm text-muted-foreground">Published {formatDate(a.publishedAt, isAr ? 'ar' : 'en')}</div>}
                  {a.requiresAcknowledgement && <Badge variant="warning">{t('knowledge.acknowledgement')}</Badge>}
                </CardContent>
              </Card>
              {a.tags.length > 0 && (
                <Card>
                  <CardContent className="p-4">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Tags</div>
                    <div className="flex flex-wrap gap-1">
                      {a.tags.map((tag) => <Badge key={tag} variant="secondary">{tag}</Badge>)}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="references">
          <Card>
            <CardContent className="p-6">
              {a.references.length === 0 ? (
                <div className="text-sm text-muted-foreground">{t('common.empty')}</div>
              ) : (
                <ul className="divide-y">
                  {a.references.map((r, i) => (
                    <li key={i} className="py-3 text-sm">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{r.authority}</Badge>
                        <span className="font-mono text-xs">{r.ref}</span>
                        {r.url && <a href={r.url} target="_blank" rel="noreferrer" className="text-primary hover:underline text-xs">open</a>}
                      </div>
                      {r.note && <div className="text-xs text-muted-foreground mt-1">{r.note}</div>}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="links">
          <Card>
            <CardContent className="p-6">
              {a.links.length === 0 ? (
                <div className="text-sm text-muted-foreground">{t('common.empty')}</div>
              ) : (
                <ul className="divide-y">
                  {a.links.map((l) => (
                    <li key={l.id} className="py-3 text-sm flex items-center gap-3">
                      <Badge variant="secondary">{l.targetType.replace(/_/g, ' ')}</Badge>
                      <span className="font-mono text-xs text-muted-foreground">{l.targetRef}</span>
                      {l.label && <span>· {l.label}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="versions">
          <Card>
            <CardContent className="p-6">
              <ul className="space-y-2">
                {a.versions.map((v) => (
                  <li key={v.id} className="flex items-center gap-3 text-sm">
                    <Badge variant="outline">v{v.version}</Badge>
                    <span className="text-muted-foreground text-xs">{formatDate(v.createdAt, isAr ? 'ar' : 'en')}</span>
                    {v.changelog && <span className="text-muted-foreground">— {v.changelog}</span>}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="mt-6">
        <Link to="/knowledge" className="text-sm text-primary hover:underline">← Knowledge base</Link>
      </div>
    </>
  );
}
