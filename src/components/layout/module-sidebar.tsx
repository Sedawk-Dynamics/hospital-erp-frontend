'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useSidebarStore } from '@/stores/sidebar-store';
import { useModuleStore } from '@/stores/module-store';
import { MODULE_REGISTRY } from '@/config/modules';
import { getModulesForRole } from '@/config/role-modules';
import { useAuthStore } from '@/stores/auth-store';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ArrowLeftRight, ChevronLeft } from 'lucide-react';

function SidebarContent({ collapsed = false }: { collapsed?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const { close } = useSidebarStore();
  const { activeModule, clearModule } = useModuleStore();
  const { user } = useAuthStore();

  const roleSlug = user?.role?.slug;
  const allowedModules = getModulesForRole(roleSlug);
  const hasMultipleModules = allowedModules.length > 1;

  if (!activeModule) return null;

  const moduleConfig = MODULE_REGISTRY[activeModule];
  if (!moduleConfig) return null;

  const ModuleIcon = moduleConfig.icon;

  const handleSwitchModule = () => {
    clearModule();
    close();
    router.push('/select-module');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Module header */}
      <div
        className={cn(
          'flex items-center gap-2 px-4 h-16 border-b border-sidebar-border shrink-0 bg-primary text-primary-foreground',
          collapsed && 'justify-center px-2'
        )}
      >
        <ModuleIcon className="h-6 w-6 shrink-0" />
        {!collapsed && (
          <span className="font-bold text-base truncate">
            {moduleConfig.label}
          </span>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto py-4 px-2">
        <ul className="space-y-1">
          {moduleConfig.sidebarItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== moduleConfig.baseRoute && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => close()}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                    'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                    isActive
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground'
                      : 'text-sidebar-foreground',
                    collapsed && 'justify-center px-2'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Switch module button — only shown for multi-module roles */}
      {hasMultipleModules && (
        <div className={cn('border-t border-sidebar-border p-2', collapsed && 'px-1')}>
          <button
            onClick={handleSwitchModule}
            title={collapsed ? 'Switch Module' : undefined}
            className={cn(
              'flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium text-sidebar-foreground transition-colors',
              'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              collapsed && 'justify-center px-2'
            )}
          >
            <ArrowLeftRight className="h-4 w-4 shrink-0" />
            {!collapsed && <span>Switch Module</span>}
          </button>
        </div>
      )}
    </div>
  );
}

export function ModuleSidebar() {
  const { isOpen, isCollapsed, close, toggleCollapse } = useSidebarStore();

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'hidden lg:flex flex-col h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300 relative',
          isCollapsed ? 'w-[68px]' : 'w-60'
        )}
      >
        <SidebarContent collapsed={isCollapsed} />
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleCollapse}
          className="absolute -right-3 top-20 z-10 h-6 w-6 rounded-full border bg-background shadow-sm hover:bg-accent"
        >
          <ChevronLeft
            className={cn(
              'h-3.5 w-3.5 transition-transform',
              isCollapsed && 'rotate-180'
            )}
          />
        </Button>
      </aside>

      {/* Mobile Sidebar */}
      <Sheet open={isOpen} onOpenChange={(open) => !open && close()}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Module Navigation</SheetTitle>
          </SheetHeader>
          <SidebarContent />
        </SheetContent>
      </Sheet>
    </>
  );
}
