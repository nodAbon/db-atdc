'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SIDEBAR_ITEMS, sidebarActionIcons } from '../lib/sidebarConfig';
import { LogOut, Sun, Moon, Sparkles } from 'lucide-react';

export default function AppSidebar({
  activeTab = 'DASHBOARD',
  setActiveTab = () => {},
  profile = { name: '관리자', emp_no: '17000001', dept: '경영지원팀', rank: '책임' },
  theme = 'dark',
  toggleTheme = () => {},
  onLogout = () => {},
  version = 'v1.0.0',
}) {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      {/* Brand Header */}
      <div className="brand">
        <div className="brand-badge">DB</div>
        <div className="brand-text">
          <span className="brand-title">db-atdc</span>
          <span className="brand-subtitle">근태관리 시스템</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="tab-menu">
        <div className="sidebar-section">
          <div className="sidebar-section-title">근태 관리</div>
          <div className="sidebar-section-items">
            {SIDEBAR_ITEMS.map((item) => {
              const Icon = item.icon;
              const isRoute = !item.tab;
              const isActive = isRoute
                ? pathname === item.href
                : pathname === '/' && activeTab === item.tab;

              if (isRoute) {
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`tab-btn${isActive ? ' active' : ''}`}
                  >
                    <Icon size={18} style={{ color: isActive ? 'var(--blue)' : 'var(--text-3)' }} />
                    <span>{item.label}</span>
                  </Link>
                );
              }

              return (
                <button
                  key={item.tab}
                  type="button"
                  className={`tab-btn${isActive ? ' active' : ''}`}
                  onClick={() => {
                    setActiveTab(item.tab);
                    if (pathname !== '/') {
                      window.location.href = item.href;
                    }
                  }}
                >
                  <Icon size={18} style={{ color: isActive ? 'var(--blue)' : 'var(--text-3)' }} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Footer / Profile */}
      <div className="sidebar-footer">
        <div className="user-profile">
          <div className="user-avatar">
            {profile.name ? profile.name.slice(0, 1) : 'D'}
          </div>
          <div className="user-info">
            <span className="user-name">{profile.name} {profile.rank || ''}</span>
            <span className="user-role">{profile.dept || '부서미지정'} ({profile.emp_no})</span>
          </div>
        </div>

        <div className="sidebar-utils">
          <button
            type="button"
            className="sidebar-util-btn"
            onClick={toggleTheme}
            title={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            <span>{theme === 'dark' ? '라이트' : '다크'}</span>
          </button>

          <button
            type="button"
            className="sidebar-util-btn"
            onClick={onLogout}
            title="로그아웃"
          >
            <LogOut size={15} />
            <span>로그아웃</span>
          </button>

          <span className="sidebar-ver">{version}</span>
        </div>
      </div>
    </aside>
  );
}
