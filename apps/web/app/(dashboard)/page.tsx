import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { DollarSign, Users, Activity, TrendingUp } from 'lucide-react';

const stats = [
  { title: 'Revenus', value: '45,2k €', icon: DollarSign, change: '+12%' },
  { title: 'Utilisateurs', value: '2 340', icon: Users, change: '+8%' },
  { title: 'Activité', value: '1 892', icon: Activity, change: '+3%' },
  { title: 'Croissance', value: '24%', icon: TrendingUp, change: '+5%' },
];

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Titre */}
      <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>

      {/* Cartes de stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.change} vs mois dernier</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Section graphiques / tables */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Revenus</CardTitle>
          </CardHeader>
          <CardContent>
            {/* <RevenueChart /> */}
            <p className="text-sm text-muted-foreground">
              Intégrer un graphique (Recharts, shadcn Chart…)
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Activité récente</CardTitle>
          </CardHeader>
          <CardContent>
            {/* <RecentActivity /> */}
            <p className="text-sm text-muted-foreground">Liste d&apos;activité récente</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
