import { useEffect, useState, useCallback } from 'react';
import { Search, FolderOpen, Loader2, RefreshCw, Play, Square } from 'lucide-react';
import toast from 'react-hot-toast';
import Header from './Header.jsx';
import WorkspaceCard from './WorkspaceCard.jsx';
import CreateModal from './CreateModal.jsx';
import { workspaces as wsApi } from '../api.js';

const FILTER_ALL     = 'all';
const FILTER_RUNNING = 'running';
const FILTER_STOPPED = 'stopped';

export default function Dashboard({ onLogout }) {
  const [workspaces, setWorkspaces]     = useState([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [showCreate, setShowCreate]     = useState(false);
  const [search, setSearch]             = useState('');
  const [filter, setFilter]             = useState(FILTER_ALL);

  const fetchWorkspaces = useCallback(async (quiet = false) => {
    if (!quiet) setRefreshing(true);
    try {
      const { data } = await wsApi.list();
      setWorkspaces(data);
    } catch (err) {
      if (!quiet) toast.error('Failed to load workspaces');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkspaces();
    // Poll every 5s to keep statuses fresh (for 'creating' workspaces)
    const id = setInterval(() => fetchWorkspaces(true), 5000);
    return () => clearInterval(id);
  }, [fetchWorkspaces]);

  function handleUpdate(updated) {
    setWorkspaces(prev => prev.map(w => w.id === updated.id ? { ...w, ...updated } : w));
  }

  function handleDelete(id) {
    setWorkspaces(prev => prev.filter(w => w.id !== id));
  }

  function handleCreated(workspace) {
    setWorkspaces(prev => [workspace, ...prev]);
  }

  const filtered = workspaces
    .filter(w => {
      if (filter === FILTER_RUNNING) return w.status === 'running';
      if (filter === FILTER_STOPPED) return w.status === 'stopped' || w.status === 'error';
      return true;
    })
    .filter(w =>
      !search ||
      w.name.toLowerCase().includes(search.toLowerCase()) ||
      (w.description || '').toLowerCase().includes(search.toLowerCase())
    );

  const runningCount = workspaces.filter(w => w.status === 'running').length;
  const totalCount   = workspaces.length;

  return (
    <div className="min-h-screen bg-[#0d1117]">
      <Header onCreateClick={() => setShowCreate(true)} onLogout={onLogout} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Page title + stats */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl font-bold text-[#e6edf3]">Workspaces</h1>
            <p className="text-sm text-[#8b949e] mt-0.5">
              {totalCount === 0 ? 'No workspaces yet'
                : `${totalCount} workspace${totalCount !== 1 ? 's' : ''} · ${runningCount} running`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchWorkspaces()}
              disabled={refreshing}
              className="btn-secondary"
              title="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#484f58]" />
            <input
              className="input pl-9"
              placeholder="Search workspaces…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-1 bg-[#161b22] border border-[#30363d] rounded-lg p-1">
            {[
              { key: FILTER_ALL,     label: 'All',     icon: null },
              { key: FILTER_RUNNING, label: 'Running', icon: Play    },
              { key: FILTER_STOPPED, label: 'Stopped', icon: Square  },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all ${
                  filter === key
                    ? 'bg-[#30363d] text-[#e6edf3]'
                    : 'text-[#8b949e] hover:text-[#e6edf3]'
                }`}
              >
                {Icon && <Icon className="w-3 h-3" />}
                {label}
                {key === FILTER_ALL     && <span className="text-[#484f58]">{totalCount}</span>}
                {key === FILTER_RUNNING && <span className="text-[#484f58]">{runningCount}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20 text-[#8b949e]">
            <Loader2 className="w-6 h-6 animate-spin mr-3" />
            Loading workspaces…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#161b22] border border-[#30363d] flex items-center justify-center mb-4">
              <FolderOpen className="w-7 h-7 text-[#484f58]" />
            </div>
            <h3 className="text-base font-medium text-[#8b949e] mb-1">
              {search ? 'No workspaces match your search' : 'No workspaces yet'}
            </h3>
            <p className="text-sm text-[#484f58] mb-6">
              {search
                ? 'Try a different search term'
                : 'Create your first workspace to get started'
              }
            </p>
            {!search && (
              <button onClick={() => setShowCreate(true)} className="btn-primary">
                Create workspace
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(workspace => (
              <WorkspaceCard
                key={workspace.id}
                workspace={workspace}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </main>

      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}
