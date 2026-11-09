import {
  Bot,
  Box,
  Boxes,
  ChartNoAxesCombined,
  ClipboardCheck,
  History,
  LayoutDashboard,
  ShieldAlert,
  ShieldCheck,
  Users,
} from 'lucide-react';

export const NAV_ITEMS = [
  {
    title: 'Tableau de bord',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    title: 'Stock & Entrepôts',
    href: '/stock',
    icon: Boxes,
  },
  {
    title: 'HSE & Incidents',
    href: '/hse',
    icon: ShieldAlert,
  },
  {
    title: 'Inspections',
    href: '/inspection',
    icon: ClipboardCheck,
  },
  {
    title: "Journal d'audit",
    href: '/audit',
    icon: History,
  },
  {
    title: 'Utilisateurs',
    href: '/users',
    icon: Users,
  },
  {
    title: 'Assistant IA',
    href: '/ia',
    icon: Bot,
  },
];

export const features = [
  {
    icon: Box,
    title: 'Gestion des stocks',
    description: 'Suivi des articles et mouvements',
  },
  {
    icon: ShieldCheck,
    title: 'HSE & Sécurité',
    description: 'Suivi des incidents et prévention',
  },
  {
    icon: ClipboardCheck,
    title: 'Inspections',
    description: 'Contrôles et conformité',
  },
  {
    icon: ChartNoAxesCombined,
    title: 'Pilotage',
    description: 'Reporting et suivi opérationnel',
  },
];
