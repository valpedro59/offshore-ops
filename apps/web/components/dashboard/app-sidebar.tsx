'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '../ui';

import { ChevronUp, Building2 } from 'lucide-react';
import { NAV_ITEMS } from '@/lib/constants';

import { cn } from '@/lib/utils';

const AppSidebar = () => {
  const pathname = usePathname();

  const isActive = (href: string) => {
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <Sidebar collapsible="icon">
      {/* HEADER / LOGO */}
      <SidebarHeader className="border-b border-white/10 px-4 py-6">
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center gap-3 px-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accentuation text-xl font-black text-white">
                O
              </div>

              <div className="min-w-0 group-data-[collapsible=icon]:hidden">
                <h1 className="text-xl font-extrabold tracking-tight text-white">
                  Offshore <span className="text-accentuation">Ops</span>
                </h1>

                <p className="text-[10px] font-semibold tracking-[0.25em] text-slate-400">CONGO</p>
              </div>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* NAVIGATION */}
      <SidebarContent className="py-5">
        <SidebarGroup>
          <SidebarGroupLabel className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">
            Menu principal
          </SidebarGroupLabel>

          <SidebarMenu className="gap-1.5">
            {NAV_ITEMS.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;

              return (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    render={<Link href={item.href} />}
                    className={cn(
                      'h-11 rounded-lg text-sm font-medium transition-all',
                      active
                        ? 'bg-accentuation text-white font-semibold'
                        : 'text-slate-400 hover:bg-white/5 hover:text-white',
                    )}
                  >
                    <Icon className="h-4.5 w-4.5 shrink-0" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      {/* FOOTER */}
      <SidebarFooter className="border-t border-white/10 p-3">
        {/* COMPANY */}
        <div className="mb-3 flex items-center gap-3 rounded-lg bg-white/5 p-3 group-data-[collapsible=icon]:hidden">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-700">
            <Building2 size={17} className="text-slate-200" />
          </div>

          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-white">Pointe-Noire Subsea</p>
            <p className="text-[10px] text-slate-400">Société active</p>
          </div>
        </div>

        {/* USER PROFILE */}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Mon profil"
              className="h-12 rounded-lg text-white hover:bg-white/10 hover:text-white"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-500 text-sm font-bold text-white">
                AD
              </div>

              <div className="flex min-w-0 flex-1 flex-col items-start gap-0.5 group-data-[collapsible=icon]:hidden">
                <span className="text-xs font-semibold">Administrateur</span>
                <span className="text-[10px] text-slate-400">Admin</span>
              </div>

              <ChevronUp className="h-4 w-4 text-slate-400 group-data-[collapsible=icon]:hidden" />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
};

export default AppSidebar;
