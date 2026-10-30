import React, { useState } from 'react';
import { Search, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const Header: React.FC<{
  title: string;
  description?: string;
}> = ({ title, description }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/scheduled?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <header className="h-16 border-b border-surface-border bg-surface/80 backdrop-blur-md px-8 flex items-center justify-between sticky top-0 z-20">
      <div>
        <h1 className="text-lg font-bold text-white tracking-tight">{title}</h1>
        {description && <p className="text-xs text-slate-400">{description}</p>}
      </div>

      <div className="flex items-center gap-4">
        {/* Global Search Bar */}
        <form onSubmit={handleSearchSubmit} className="relative w-64 md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search emails, recipients, subjects..."
            className="w-full pl-9 pr-4 py-1.5 bg-background border border-surface-border rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
          />
        </form>

        {/* System Health Badge */}
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-800/50 text-[11px] text-emerald-300 font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Cluster Healthy</span>
        </div>
      </div>
    </header>
  );
};
