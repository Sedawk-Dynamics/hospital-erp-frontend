'use client';

import { Menu, PanelLeftClose, PanelLeft, Bell, LogOut, User, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSidebarStore } from '@/stores/sidebar-store';
import { useAuthStore } from '@/stores/auth-store';
import { useClinicStore } from '@/stores/clinic-store';
import { useModuleStore } from '@/stores/module-store';
import { MODULE_REGISTRY } from '@/config/modules';
import { getModulesForRole } from '@/config/role-modules';
import { useRouter } from 'next/navigation';

export function ModuleHeader() {
  const { toggle, isCollapsed, toggleCollapse } = useSidebarStore();
  const { user, logout } = useAuthStore();
  const { selectedClinic } = useClinicStore();
  const { activeModule } = useModuleStore();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const initials = user
    ? `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase()
    : 'U';

  const roleSlug = user?.role?.slug;
  const allowedModules = getModulesForRole(roleSlug);
  const hasMultipleModules = allowedModules.length > 1;

  // For doctor module, show "Dr FirstName" instead of generic "Doctor"
  const moduleLabel = activeModule === 'doctor' && user
    ? `Dr ${user.firstName}`
    : activeModule
      ? MODULE_REGISTRY[activeModule]?.label
      : '';

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 lg:px-6">
      {/* Mobile menu toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={toggle}
      >
        <Menu className="h-5 w-5" />
        <span className="sr-only">Toggle menu</span>
      </Button>

      {/* Desktop collapse toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="hidden lg:flex"
        onClick={toggleCollapse}
      >
        {isCollapsed ? (
          <PanelLeft className="h-5 w-5" />
        ) : (
          <PanelLeftClose className="h-5 w-5" />
        )}
        <span className="sr-only">Toggle sidebar</span>
      </Button>

      {/* Clinic name + Module label */}
      <div className="flex-1 flex items-center gap-2">
        <h2 className="text-sm font-semibold text-foreground">
          {selectedClinic?.name || user?.tenant?.name || 'Hospital ERP'}
        </h2>
        {moduleLabel && (
          <>
            <span className="text-muted-foreground">/</span>
            <span className="text-sm text-muted-foreground">{moduleLabel}</span>
          </>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">
        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-destructive" />
          <span className="sr-only">Notifications</span>
        </Button>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger className="relative h-9 w-9 rounded-full focus:outline-none">
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                {initials}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {user ? `${user.firstName} ${user.lastName}` : 'User'}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user?.email || ''}
                  </p>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => router.push('/select-clinic')}>
                <User className="mr-2 h-4 w-4" />
                <span>Switch Clinic</span>
              </DropdownMenuItem>
              {hasMultipleModules && (
                <DropdownMenuItem onClick={() => router.push('/select-module')}>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Switch Module</span>
                </DropdownMenuItem>
              )}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
