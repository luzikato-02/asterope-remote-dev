import { useState } from 'react';
import { Play, Square, Trash2, ExternalLink, Clock, GitBranch, ScrollText, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import { workspaces as wsApi } from '../api.js';
import LogsModal from './LogsModal.jsx';

const STATUS_CONFIG = {
  running:  { dot: 'bg-[#238636] animate-pulse-slow', badge: 'text-[#3fb950] bg-[#238636]/20 border-[#238636]/40', label: 'Running' },
  stopped:  { dot: 'bg-[#8b949e]',                   badge: 'text-[#8b949e] bg-[#30363d]/50 border-[#30363d]',    label: 'Stopped' },
  creating: { dot: 'bg-[#d29922] animate-pulse',     badge: 'text-[#d29922] bg-[#d29922]/20 border-[#d29922]/40', label: 'Creating' },
  error:    { dot: 'bg-[#da3633]',                   badge: 'text-[#da3633] bg-[#da3633]/20 border-[#da3633]/40', label: 'Error'   },
};

const TEMPLATE_ICONS = {
  blank:     '📄',
  node:      '🟢',
  python:    '🐍',
  react:     '⚛️',
  go:        '🐹',
  php:       '🐘',
  laravel:   '🎼',
  fullstack: '🌐',
};

function timeAgo(date) {
  if (!date) return 'Never opened';
  try { return formatDistanceToNow(new Date(date), { addSuffix: true }); }
  catch { return 'Unknown'; }
}

export default function WorkspaceCard({ workspace, onUpdate, onDelete }) {
  const [actionLoading, setActionLoading] = useState(null); // 'start' | 'stop' | 'delete' | 'open'
  const [showLogs, setShowLogs] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const status = workspace.status;
  const cfg    = STATUS_CONFIG[status] || STATUS_CONFIG.stopped;
  const isRunning  = status === 'running';
  const isCreating = status === 'creating';

  function getWorkspaceUrl() {
    const host = window.location.hostname;
    return `http://${host}:${workspace.port}`;
  }

  async function handleStart() {
    setActionLoading('start');
    try {
      const { data } = await wsApi.start(workspace.id);
      toast.success(`${workspace.name} started`);
      onUpdate(data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to start');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleStop() {
    setActionLoading('stop');
    try {
      await wsApi.stop(workspace.id);
      toast.success(`${workspace.name} stopped`);
      onUpdate({ ...workspace, status: 'stopped', pid: null });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to stop');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleOpen() {
    if (!isRunning) {
      setActionLoading('open');
      try {
        const { data } = await wsApi.start(workspace.id);
        onUpdate(data);
        await new Promise(r => setTimeout(r, 1500));
        window.open(getWorkspaceUrl(), '_blank');
      } catch (err) {
        toast.error(err.response?.data?.error || 'Failed to start workspace');
      } finally {
        setActionLoading(null);
      }
    } else {
      window.open(getWorkspaceUrl(), '_blank');
    }
  }

  async function handleDelete() {
    setActionLoading('delete');
    setShowDeleteConfirm(false);
    try {
      await wsApi.delete(workspace.id);
      toast.success(`${workspace.name} deleted`);
      onDelete(workspace.id);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete');
      setActionLoading(null);
    }
  }

  const openLabel  = actionLoading === 'open'  ? 'Starting…'
                   : !isRunning               ? 'Start & Open'
                   : 'Open';

  return (
    <>
      <div className="card flex flex-col gap-0 hover:border-[#8b949e]/50 transition-all duration-200 group animate-fade-in">
        {/* Card top bar */}
        <div className="h-1 w-full rounded-t-lg bg-gradient-to-r from-[#1f6feb]/60 to-[#8957e5]/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        <div className="p-5 flex flex-col gap-4">
          {/* Header row */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <span className="text-2xl leading-none mt-0.5 shrink-0">
                {TEMPLATE_ICONS[workspace.template] || '📁'}
              </span>
              <div className="min-w-0">
                <h3 className="font-semibold text-[#e6edf3] text-sm truncate" title={workspace.name}>
                  {workspace.name}
                </h3>
                {workspace.description && (
                  <p className="text-xs text-[#8b949e] mt-0.5 line-clamp-2">{workspace.description}</p>
                )}
              </div>
            </div>

            {/* Status badge */}
            <div className={`flex items-center gap-1.5 shrink-0 text-xs px-2 py-1 rounded-full border font-medium ${cfg.badge}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
              {cfg.label}
            </div>
          </div>

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[#8b949e]">
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {timeAgo(workspace.lastOpenedAt)}
            </div>
            {workspace.gitUrl && (
              <div className="flex items-center gap-1 truncate max-w-[180px]" title={workspace.gitUrl}>
                <GitBranch className="w-3 h-3 shrink-0" />
                <span className="truncate">
                  {workspace.gitUrl.replace(/^https?:\/\/(www\.)?/, '').replace(/\.git$/, '')}
                </span>
              </div>
            )}
            <span className="text-[#484f58]">port {workspace.port}</span>
            {workspace.image && (
              <code className="text-[#484f58] text-[10px] bg-[#0d1117] px-1.5 py-0.5 rounded border border-[#21262d] truncate max-w-[120px]" title={workspace.image}>
                {workspace.image.replace('asterope/', '')}
              </code>
            )}
          </div>

          {/* Error message */}
          {status === 'error' && workspace.error && (
            <div className="text-xs text-[#da3633] bg-[#da3633]/10 border border-[#da3633]/30 rounded p-2">
              {workspace.error}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2 pt-1">
            {/* Open / Start & Open */}
            <button
              onClick={handleOpen}
              disabled={!!actionLoading || isCreating}
              className="btn-accent flex-1 justify-center"
            >
              {(actionLoading === 'open' || actionLoading === 'start') ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ExternalLink className="w-3.5 h-3.5" />
              )}
              {openLabel}
            </button>

            {/* Start / Stop toggle */}
            {isRunning ? (
              <button
                onClick={handleStop}
                disabled={!!actionLoading}
                className="btn-secondary"
                title="Stop"
              >
                {actionLoading === 'stop'
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Square className="w-3.5 h-3.5" />
                }
              </button>
            ) : (
              <button
                onClick={handleStart}
                disabled={!!actionLoading || isCreating || status === 'error'}
                className="btn-secondary"
                title="Start"
              >
                {actionLoading === 'start'
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Play className="w-3.5 h-3.5" />
                }
              </button>
            )}

            {/* Logs */}
            <button
              onClick={() => setShowLogs(true)}
              className="btn-secondary"
              title="View logs"
              disabled={!!actionLoading}
            >
              <ScrollText className="w-3.5 h-3.5" />
            </button>

            {/* Delete */}
            {showDeleteConfirm ? (
              <div className="flex items-center gap-1">
                <button onClick={handleDelete} className="btn-danger text-xs py-1 px-2">
                  {actionLoading === 'delete'
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : 'Confirm delete'
                  }
                </button>
                <button onClick={() => setShowDeleteConfirm(false)} className="btn-secondary text-xs py-1 px-2">
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={!!actionLoading}
                className="btn-secondary text-[#da3633] hover:border-[#da3633]/40"
                title="Delete workspace"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {showLogs && (
        <LogsModal workspace={workspace} onClose={() => setShowLogs(false)} />
      )}
    </>
  );
}
