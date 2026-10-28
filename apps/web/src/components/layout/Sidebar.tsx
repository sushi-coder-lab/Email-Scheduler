import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Clock,
  Send,
  Layers,
  MessageSquare,
  Activity,
  Plus,
  LogOut,
  Mail,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../common/Button';

export const Sidebar: React.FC<{ onOpenCompose: () => void }> = ({ onOpenCompose }) => {
  const { user, tenant, logout } = useAuth();

  const navItems = [
    { label: 'Overview', to: '/dashboard', icon: LayoutDashboard },
    { label: 'Scheduled Emails', to: '/scheduled', icon: Clock },
    { label: 'Sent History', to: '/sent', icon: Send },
    { label: 'Campaigns', to: '/campaigns', icon: Layers },
    { label: 'Slack Alerts', to: '/slack', icon: MessageSquare },
  ];

  return (
    <aside className="w-64 bg-surface border-r border-surface-border flex flex-col h-screen sticky top-0 shrink-0 z-30 select-none">
      {/* Brand Header */}
      <div className="p-6 border-b border-surface-border/60">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20 text-white font-bold">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-white text-base tracking-tight flex items-center gap-1.5">
              ReachInbox
            </div>
            <div className="text-[11px] text-slate-400 font-medium tracking-wide">
              OUTBOX LABS
            </div>
          </div>
        </div>

        {/* Workspace Switcher / Badge */}
        {tenant && (
          <div className="mt-4 px-3 py-1.5 rounded-lg bg-surface-hover/80 border border-surface-border flex items-center justify-between">
            <span className="text-xs text-slate-300 font-medium truncate">{tenant.name}</span>
            <span className="text-[10px] bg-primary/20 text-primary-light border border-primary/30 px-1.5 py-0.2 rounded font-mono uppercase">
              {tenant.role}
            </span>
          </div>
        )}
      </div>

      {/* Primary Action Button */}
      <div className="p-4">
        <Button
          onClick={onOpenCompose}
          className="w-full shadow-lg shadow-primary/25"
          icon={<Plus className="w-4 h-4" />}
        >
          Compose Email
        </Button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-primary/10 text-primary-light border border-primary/30 font-semibold'
                    : 'text-slate-400 hover:text-white hover:bg-surface-hover'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}

        {/* Live Bull Board Queue Monitor */}
        <a
          href="/api/admin/queues"
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-surface-hover transition-colors"
        >
          <div className="flex items-center gap-3">
            <Activity className="w-4 h-4 text-emerald-400" />
            <span>Bull Board Monitor</span>
          </div>
          <span className="text-[10px] bg-emerald-950 border border-emerald-800 text-emerald-300 px-1.5 py-0.5 rounded font-mono">
            LIVE
          </span>
        </a>
      </nav>

      {/* User Profile Footer */}
      <div className="p-4 border-t border-surface-border/60 bg-surface/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name}
                className="w-9 h-9 rounded-full ring-2 ring-primary/40 object-cover shrink-0"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-surface-border flex items-center justify-center text-sm font-semibold text-slate-200 shrink-0">
                {user?.name?.charAt(0) || 'U'}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-white truncate">{user?.name}</div>
              <div className="text-[11px] text-slate-400 truncate">{user?.email}</div>
            </div>
          </div>

          <button
            onClick={logout}
            title="Logout"
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-950/30 transition-colors shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
