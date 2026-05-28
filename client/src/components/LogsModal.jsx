import { useEffect, useRef, useState } from 'react';
import { X, Terminal, RefreshCw } from 'lucide-react';
import { workspaces } from '../api.js';

export default function LogsModal({ workspace, onClose }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  async function fetchLogs() {
    setLoading(true);
    try {
      const { data } = await workspaces.logs(workspace.id);
      setLogs(data.logs || []);
    } catch {}
    setLoading(false);
  }

  useEffect(() => {
    fetchLogs();
    const id = setInterval(fetchLogs, 3000);
    return () => clearInterval(id);
  }, [workspace.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-3xl card animate-slide-up shadow-2xl flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#30363d] shrink-0">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-[#238636]" />
            <h2 className="text-sm font-semibold text-[#e6edf3]">
              Logs — <span className="text-[#8b949e] font-normal">{workspace.name}</span>
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchLogs} disabled={loading} className="btn-secondary py-1 text-xs" title="Refresh">
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={onClose} className="p-1 rounded hover:bg-[#30363d] transition-colors text-[#8b949e]">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Log body */}
        <div className="flex-1 overflow-y-auto p-4 font-mono text-xs bg-[#0d1117] space-y-0.5 min-h-[200px]">
          {logs.length === 0 ? (
            <p className="text-[#484f58] italic">No logs yet. Start the workspace to see output.</p>
          ) : (
            logs.map((entry, i) => (
              <div key={i} className="flex gap-3 text-[#8b949e]">
                <span className="shrink-0 text-[#484f58]">
                  {new Date(entry.ts).toLocaleTimeString()}
                </span>
                <span className="text-[#c9d1d9] break-all">{entry.line}</span>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
}
