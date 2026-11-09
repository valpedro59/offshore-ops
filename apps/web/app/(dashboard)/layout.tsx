import AppSidebar from '@/components/dashboard/app-sidebar';
import { SidebarProvider, SidebarTrigger } from '@/components/ui';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <main>
        <SidebarTrigger />
        {children}
      </main>
    </SidebarProvider>
  );
}
