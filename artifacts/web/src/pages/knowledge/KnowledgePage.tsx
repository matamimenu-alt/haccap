import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { BookOpen, Plus, Search } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';

type Article = {
  id: string;
  key: string;
  titleAr: string;
  titleEn: string;
  summaryEn: string | null;
  kind: string;
  status: 'draft' | 'in_review' | 'published' | 'archived';
  tags: string[];
  categoryId: string | null;
  updatedAt: string;
};

type Category = { id: string; nameEn: string; nameAr: string; key: string; path: string; depth: number };

const statusVariant = { draft: 'outline', in_review: 'warning', published: 'success', archived: 'secondary' } as const;

export function KnowledgePage() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language.startsWith('ar');
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('all');
  const [status, setStatus] = useState('all');

  const cats = useQuery({ queryKey: ['knowledge-categories'], queryFn: () => api.get<Category[]>('/knowledge/categories') });
  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (kind !== 'all') p.set('kind', kind);
    if (status !== 'all') p.set('status', status);
    return p.toString();
  }, [q, kind, status]);
  const articles = useQuery({ queryKey: ['knowledge-articles', params], queryFn: () => api.get<Article[]>(`/knowledge/articles?${params}`) });

  const catById = new Map((cats.data ?? []).map((c) => [c.id, c]));

  return (
    <>
      <PageHeader
        title={t('knowledge.title')}
        actions={
          <Button asChild>
            <Link to="/knowledge/new"><Plus className="h-4 w-4" />{t('knowledge.add')}</Link>
          </Button>
        }
      />

      <Card className="mb-4">
        <CardContent className="p-4 flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute inset-y-0 start-3 my-auto h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('actions.search') ?? ''} className="ps-9" />
          </div>
          <Select value={kind} onValueChange={setKind}>
            <SelectTrigger className="md:w-52"><SelectValue placeholder={t('assets.kind')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">—</SelectItem>
              {['sop','policy','guideline','faq','reference','training_material','procedure','checklist','incident_playbook','regulatory_citation','other'].map((k) => (
                <SelectItem key={k} value={k}>{t(`knowledge.kind.${k}` as const)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="md:w-44"><SelectValue placeholder={t('knowledge.status.published')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">—</SelectItem>
              {['draft', 'in_review', 'published', 'archived'].map((s) => (
                <SelectItem key={s} value={s}>{t(`knowledge.status.${s}` as const)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {articles.isLoading ? (
        <Card><CardContent className="p-6 text-muted-foreground">{t('common.loading')}</CardContent></Card>
      ) : articles.data && articles.data.length === 0 ? (
        <EmptyState icon={BookOpen} title={t('common.empty')} action={<Button asChild><Link to="/knowledge/new"><Plus className="h-4 w-4" />{t('knowledge.add')}</Link></Button>} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {articles.data?.map((a) => (
            <Link key={a.id} to={`/knowledge/${a.id}`} className="block">
              <Card className="h-full hover:border-primary transition-colors">
                <CardContent className="p-5 space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{t(`knowledge.kind.${a.kind}` as const)}</Badge>
                    <Badge variant={statusVariant[a.status]}>{t(`knowledge.status.${a.status}` as const)}</Badge>
                    {a.categoryId && catById.get(a.categoryId) && (
                      <span className="text-xs text-muted-foreground font-mono truncate">{catById.get(a.categoryId)!.path}</span>
                    )}
                  </div>
                  <h3 className="font-semibold leading-tight">{isAr ? a.titleAr : a.titleEn}</h3>
                  {a.summaryEn && <p className="text-sm text-muted-foreground line-clamp-2">{a.summaryEn}</p>}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex gap-1 flex-wrap">
                      {a.tags.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground">{formatDate(a.updatedAt, isAr ? 'ar' : 'en')}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
