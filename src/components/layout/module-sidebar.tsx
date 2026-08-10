'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useSidebarStore } from '@/stores/sidebar-store';
import { MODULE_REGISTRY, getModuleFromPathname, type NavItem } from '@/config/modules';
import { getModulesForRole, getRolePortalLabel } from '@/config/role-modules';
import { useAuthStore } from '@/stores/auth-store';
import { PlatformLogo } from '@/components/branding/platform-logo';

function normalizeRoleSlug(slug?: string | null): string {
  return (slug ?? '').toLowerCase().replace(/[\s-]+/g, '_');
}

/**
 * Drop sidebar items the current role isn't allowed to see. `admin` and
 * `super_admin` always pass. Items without `restrictTo` are visible to all.
 */
function visibleSidebarItems(items: NavItem[], roleSlug?: string): NavItem[] {
  const role = normalizeRoleSlug(roleSlug);
  if (role === 'admin' || role === 'super_admin') return items;
  return items.filter((it) => !it.restrictTo || it.restrictTo.includes(role));
}
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ChevronDown, HeartPulse, PanelLeftClose, PanelLeft } from 'lucide-react';
import type { ModuleKey } from '@/stores/module-store';

function SidebarContent({
  collapsed = false,
  hoverExpand = false,
  pinned = false,
  onTogglePin,
}: {
  collapsed?: boolean;
  hoverExpand?: boolean;
  pinned?: boolean;
  onTogglePin?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { close } = useSidebarStore();
  const { user } = useAuthStore();

  const roleSlug = user?.role?.slug;
  const allowedModules = getModulesForRole(roleSlug);
  const portalLabel = getRolePortalLabel(roleSlug);
  const isSingleModule = allowedModules.length === 1;
  const currentModule = getModuleFromPathname(pathname);

  // When pinned, always show labels. When hover-expand, show on hover. Otherwise based on collapsed.
  const showLabels = pinned ? true : hoverExpand ? true : !collapsed;

  const [expandedGroups, setExpandedGroups] = useState<Set<ModuleKey>>(() => {
    const initial = new Set<ModuleKey>();
    if (currentModule) initial.add(currentModule);
    return initial;
  });

  useEffect(() => {
    if (currentModule) {
      setExpandedGroups((prev) => {
        if (prev.has(currentModule)) return prev;
        const next = new Set(prev);
        next.add(currentModule);
        return next;
      });
    }
  }, [currentModule]);

  const toggleGroup = (key: ModuleKey) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (allowedModules.length === 0) return null;

  const initials = user
    ? `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase()
    : 'U';

  // Label visibility class helper
  const labelVisibility = pinned
    ? 'opacity-100'
    : hoverExpand
      ? 'opacity-0 group-hover:opacity-100'
      : collapsed
        ? 'hidden'
        : 'opacity-100';

  return (
    <div className="flex flex-col h-full w-full">
      {/* Brand + Pin button — the toggle sits right next to the logo. */}
      <div className="mb-12 flex items-center gap-2 px-6 w-full overflow-hidden">
        <PlatformLogo
          variant="light"
          alt={process.env.NEXT_PUBLIC_APP_NAME || 'Logo'}
          className="h-10 w-auto max-w-[150px] object-contain shrink-0"
          fallback={
            <>
              <div className="min-w-[40px] h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                <HeartPulse className="h-5 w-5 text-primary" />
              </div>
              <div className={cn(
                'ml-3 min-w-0 whitespace-nowrap transition-opacity duration-300',
                labelVisibility
              )}>
                <h2 className="text-primary font-bold text-xl tracking-tighter font-headline truncate">
                  {process.env.NEXT_PUBLIC_APP_NAME || 'Sanctuary'}
                </h2>
                <p className="text-xs text-slate-400 font-medium font-label truncate">{portalLabel}</p>
              </div>
            </>
          }
        />
        {/* Collapse / pin toggle — sits beside the logo and is always visible so
            the sidebar can be toggled from any page. */}
        {onTogglePin && (
          <button
            onClick={onTogglePin}
            title={pinned ? 'Collapse sidebar' : 'Pin sidebar open'}
            className={cn(
              'shrink-0 ml-auto p-1.5 rounded-lg transition-all duration-200 text-primary bg-primary/10 hover:bg-primary/15',
              // Hidden while the sidebar is collapsed; shown when pinned or hovered open.
              pinned ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            )}
          >
            {pinned ? (
              <PanelLeftClose className="h-4 w-4" />
            ) : (
              <PanelLeft className="h-4 w-4" />
            )}
          </button>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 w-full space-y-2 overflow-y-auto overflow-x-hidden sanctuary-scrollbar px-0">
        {allowedModules.map((moduleKey) => {
          const config = MODULE_REGISTRY[moduleKey];
          if (!config) return null;

          const isExpanded = expandedGroups.has(moduleKey);
          const isCurrentModule = currentModule === moduleKey;
          const ModuleIcon = config.icon;

          /* ── Single-module mode: flat list ── */
          if (isSingleModule) {
            return (
              <div key={moduleKey} className="space-y-2">
                {visibleSidebarItems(config.sidebarItems, roleSlug).map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== config.baseRoute && pathname.startsWith(item.href));
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => close()}
                      title={!pinned && collapsed && !hoverExpand ? item.label : undefined}
                      className={cn(
                        'relative flex items-center px-6 py-4 w-full transition-all duration-200',
                        isActive
                          ? 'bg-white text-primary rounded-l-xl rounded-r-none sidebar-branch'
                          : 'text-slate-400 hover:text-primary hover:bg-primary/5'
                      )}
                    >
                      <Icon className="min-w-[32px] h-5 w-5 shrink-0" style={isActive ? { strokeWidth: 2.5 } : undefined} />
                      <span className={cn(
                        'ml-4 font-sans text-sm font-medium tracking-wide whitespace-nowrap transition-opacity duration-300',
                        labelVisibility
                      )}>
                        {item.label}
                      </span>
                    </Link>
                  );
                })}
              </div>
            );
          }

          /* ── Multi-module mode: expandable groups ── */
          return (
            <div key={moduleKey}>
              <button
                onClick={() => {
                  if (!pinned && collapsed && !hoverExpand) {
                    router.push(config.baseRoute);
                    close();
                  } else {
                    toggleGroup(moduleKey);
                  }
                }}
                title={!pinned && collapsed && !hoverExpand ? config.label : undefined}
                className={cn(
                  'relative flex items-center px-6 py-4 w-full transition-all duration-200',
                  isCurrentModule && (!isExpanded || (!pinned && collapsed))
                    ? 'bg-white text-primary rounded-l-xl rounded-r-none sidebar-branch'
                    : 'text-slate-400 hover:text-primary hover:bg-primary/5'
                )}
              >
                <ModuleIcon className="min-w-[32px] h-5 w-5 shrink-0" style={isCurrentModule ? { strokeWidth: 2.5 } : undefined} />
                <span className={cn(
                  'ml-4 flex-1 text-left font-sans text-sm font-medium tracking-wide whitespace-nowrap transition-opacity duration-300',
                  labelVisibility
                )}>
                  {config.label}
                </span>
                {showLabels && (
                  <ChevronDown className={cn(
                    'h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-200',
                    !pinned && hoverExpand ? 'opacity-0 group-hover:opacity-100' : '',
                    isExpanded && 'rotate-180'
                  )} />
                )}
              </button>

              {/* Sub-items */}
              {showLabels && isExpanded && (
                <div className={cn(
                  'space-y-0.5 ml-[44px] pl-3 border-l border-outline-variant/20',
                  // When not pinned and hover-expand mode, hide sub-items until hover
                  !pinned && hoverExpand && 'hidden group-hover:block'
                )}>
                  {visibleSidebarItems(config.sidebarItems, roleSlug).map((item) => {
                    const isActive =
                      pathname === item.href ||
                      (item.href !== config.baseRoute && pathname.startsWith(item.href));
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => close()}
                        className={cn(
                          'flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-200',
                          isActive
                            ? 'text-primary font-semibold bg-primary/5'
                            : 'text-on-surface-variant hover:text-primary hover:bg-primary/5'
                        )}
                      >
                        <Icon className={cn('h-4 w-4 shrink-0', isActive && 'text-primary')} />
                        <span className={cn(
                          'truncate transition-opacity duration-300',
                          pinned ? 'opacity-100' : hoverExpand ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'
                        )}>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* User info at bottom */}
      <div className="mt-auto px-6 w-full">
        <div className="flex items-center w-full">
          <div className="min-w-[40px] h-10 w-10 rounded-xl bg-secondary-container flex items-center justify-center text-on-secondary-container font-bold text-sm shrink-0">
            {initials}
          </div>
          <div className={cn(
            'ml-4 whitespace-nowrap transition-opacity duration-300',
            labelVisibility
          )}>
            <p className="text-xs font-bold text-on-surface font-label">
              {user ? `${user.firstName} ${user.lastName}` : 'User'}
            </p>
            <p className="text-[10px] text-slate-400 font-label capitalize">
              {user?.role?.name?.replace(/_/g, ' ') || ''}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ModuleSidebar() {
  const { isOpen, close, isPinned, togglePin } = useSidebarStore();

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'hidden lg:flex fixed left-0 top-0 h-full z-50 flex-col items-center py-8 bg-slate-50 transition-all duration-300 ease-in-out border-r-0 shadow-[24px_0_40px_-4px_rgba(0,0,0,0.05)] overflow-x-hidden overflow-y-auto sanctuary-scrollbar',
          isPinned
            ? 'w-64'                          // Pinned: always expanded
            : 'w-20 hover:w-64 group'         // Unpinned: collapsed, expand on hover
        )}
      >
        <SidebarContent
          collapsed={!isPinned}
          hoverExpand={!isPinned}
          pinned={isPinned}
          onTogglePin={togglePin}
        />
      </aside>

      {/* Mobile Sidebar */}
      <Sheet open={isOpen} onOpenChange={(open) => !open && close()}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
          </SheetHeader>
          <SidebarContent pinned={true} />
        </SheetContent>
      </Sheet>
    </>
  );
}
