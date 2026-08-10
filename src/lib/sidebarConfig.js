import {
  LayoutDashboard,
  CalendarDays,
  Clock,
  Link as LinkIcon,
  LogOut,
  Sun,
  Moon,
  User,
} from 'lucide-react';

export const SIDEBAR_ITEMS = [
  {
    href: '/?tab=DASHBOARD',
    label: '대시보드',
    icon: LayoutDashboard,
    iconStyle: { color: 'var(--blue)' },
    category: '근태 관리',
    tab: 'DASHBOARD',
  },
  {
    href: '/?tab=MONTHLY',
    label: '월간 근태보고',
    icon: CalendarDays,
    iconStyle: { color: 'var(--green)' },
    category: '근태 관리',
    tab: 'MONTHLY',
  },
  {
    href: '/attendance-records',
    label: '출입기록 조회',
    icon: Clock,
    iconStyle: { color: 'var(--amber)' },
    category: '근태 관리',
  },
  {
    href: '/calendar-links',
    label: '캘린더 링크생성',
    icon: LinkIcon,
    iconStyle: { color: 'var(--purple)' },
    category: '근태 관리',
  },
];

export function getMainSidebarItems({ isAdmin = false, isLeader = false } = {}) {
  return SIDEBAR_ITEMS;
}

export const sidebarActionIcons = {
  logout: LogOut,
  light: Sun,
  dark: Moon,
  mypage: User,
};
