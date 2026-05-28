import { Terminal, LogOut, Plus } from 'lucide-react';
import SystemStats from './SystemStats.jsx';

export default function Header({ onCreateClick, onLogout }) {
  return (
    <header className="sticky top-0 z-30 border-b border-[#30363d] bg-[#0d1117]/90 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#1f6feb]/20 border border-[#1f6feb]/30">
            <Terminal className="w-4 h-4 text-[#1f6feb]" />
          </div>
          <div>
            <span className="font-bold text-[#e6edf3] text-base tracking-tight">Asterope</span>
            <span className="hidden sm:inline text-[#8b949e] text-xs ml-2">Remote Dev</span>
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <SystemStats />

          <button
            onClick={onCreateClick}
            className="btn-accent hidden sm:inline-flex"
          >
            <Plus className="w-4 h-4" />
            New workspace
          </button>

          <button
            onClick={onCreateClick}
            className="btn-accent sm:hidden"
            aria-label="New workspace"
          >
            <Plus className="w-4 h-4" />
          </button>

          <button
            onClick={onLogout}
            className="btn-secondary"
            title="Sign out"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>
    </header>
  );
}
