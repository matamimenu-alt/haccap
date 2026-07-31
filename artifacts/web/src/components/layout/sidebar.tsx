import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard, Building2, Store, MapPin, Users, ShieldCheck,
  Layers3, Landmark, ClipboardList, ThermometerSun, ListTodo,
  AlertOctagon, FileBarChart2, Settings,
  Package, Boxes, Warehouse, Truck, Wrench,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type NavItem = { to: string; icon: typeof LayoutDashboard; labelKey: string; comingSoon?: boolean };
type NavSection = { titleKey: string; items: NavItem[] };

const sections: NavSection[] = [
  {
    titleKey: 'nav.dashboard',
    items: [{ to: '/', icon: LayoutDashboard, labelKey: 'nav.dashboard' }],
  },
  {
    titleKey: 'nav.organization',
    items: [
      { to: '/organization/company', icon: Building2, labelKey: 'nav.companies' },
      { to: '/organization/brands',   icon: Store,    labelKey: 'nav.brands' },
      { to: '/organization/branches', icon: MapPin,   labelKey: 'nav.branches' },
      { to: '/organization/users',    icon: Users,    labelKey: 'nav.users' },
      { to: '/organization/roles',    icon: ShieldCheck, labelKey: 'nav.roles' },
      { to: '/organization/departments', icon: Layers3, labelKey: 'nav.departments' },
      { to: '/organization/org-levels',  icon: Landmark, labelKey: 'nav.orgLevels' },
    ],
  },
  {
    titleKey: 'nav.operations',
    items: [
      { to: '/operations/assets',            icon: Package,   labelKey: 'nav.assets' },
      { to: '/operations/areas',             icon: Warehouse, labelKey: 'nav.areas' },
      { to: '/operations/asset-categories',  icon: Boxes,     labelKey: 'nav.assetCategories' },
      { to: '/operations/suppliers',         icon: Truck,     labelKey: 'nav.suppliers' },
      { to: '/operations/maintenance',       icon: Wrench,    labelKey: 'nav.maintenance' },
    ],
  },
  {
    titleKey: 'nav.compliance',
    items: [
      { to: '/tasks',      icon: ListTodo,       labelKey: 'nav.tasks',      comingSoon: true },
      { to: '/compliance', icon: ClipboardList, labelKey: 'nav.compliance', comingSoon: true },
      { to: '/haccp',      icon: ShieldCheck,    labelKey: 'nav.haccp',      comingSoon: true },
      { to: '/food-safety',icon: ThermometerSun, labelKey: 'nav.foodSafety', comingSoon: true },
      { to: '/capa',       icon: AlertOctagon,   labelKey: 'nav.capa',       comingSoon: true },
      { to: '/reports',    icon: FileBarChart2,  labelKey: 'nav.reports',    comingSoon: true },
    ],
  },
  {
    titleKey: 'nav.settings',
    items: [{ to: '/settings', icon: Settings, labelKey: 'nav.settings', comingSoon: true }],
  },
];

export function Sidebar() {
  const { t } = useTranslation();

  return (
    <aside className="hidden md:flex md:w-64 shrink-0 bg-sidebar text-sidebar-foreground flex-col border-e border-sidebar-accent/40">
      <div className="h-16 flex items-center gap-3 px-5 border-b border-sidebar-accent/40">
        <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold">
          R
        </div>
        <div>
          <div className="font-semibold text-sm">{t('app.shortName')}</div>
          <div className="text-xs text-sidebar-foreground/60 truncate max-w-[10rem]">{t('app.name')}</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-4">
        {sections.map((section) => (
          <div key={section.titleKey} className="mb-6 px-3">
            <div className="text-[10px] uppercase tracking-wider text-sidebar-foreground/50 px-3 mb-2">
              {t(section.titleKey)}
            </div>
            <ul className="space-y-1">
              {section.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                        isActive
                          ? 'bg-sidebar-accent text-sidebar-foreground'
                          : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
                        item.comingSoon && 'pointer-events-none opacity-40',
                      )
                    }
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1">{t(item.labelKey)}</span>
                    {item.comingSoon && (
                      <span className="text-[9px] uppercase tracking-wider text-sidebar-foreground/40">
                        soon
                      </span>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
