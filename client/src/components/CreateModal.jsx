import { useState } from 'react';
import { X, GitBranch, FolderPlus, Box } from 'lucide-react';
import toast from 'react-hot-toast';
import { workspaces } from '../api.js';

const TEMPLATES = [
  { id: 'blank',  label: 'Blank',    icon: '📄', desc: 'Empty workspace' },
  { id: 'node',   label: 'Node.js',  icon: '🟢', desc: 'package.json + index.js' },
  { id: 'python', label: 'Python',   icon: '🐍', desc: 'main.py + requirements.txt' },
  { id: 'react',  label: 'React',    icon: '⚛️', desc: 'React + Vite starter' },
  { id: 'go',     label: 'Go',       icon: '🐹', desc: 'main.go + go.mod' },
];

const SOURCE_BLANK = 'blank';
const SOURCE_GIT   = 'git';

export default function CreateModal({ onClose, onCreated }) {
  const [name, setName]         = useState('');
  const [desc, setDesc]         = useState('');
  const [source, setSource]     = useState(SOURCE_BLANK);
  const [gitUrl, setGitUrl]     = useState('');
  const [template, setTemplate] = useState('blank');
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) { toast.error('Name is required'); return; }
    if (source === SOURCE_GIT && !gitUrl.trim()) { toast.error('Git URL is required'); return; }

    setLoading(true);
    try {
      const { data } = await workspaces.create({
        name: name.trim(),
        description: desc.trim(),
        gitUrl:   source === SOURCE_GIT ? gitUrl.trim() : null,
        template: source === SOURCE_BLANK ? template : 'blank',
      });
      toast.success(`Workspace "${data.name}" is being created`);
      onCreated(data);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create workspace');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg card animate-slide-up shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#30363d]">
          <div className="flex items-center gap-2">
            <FolderPlus className="w-5 h-5 text-[#1f6feb]" />
            <h2 className="text-base font-semibold text-[#e6edf3]">New workspace</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-[#30363d] transition-colors text-[#8b949e] hover:text-[#e6edf3]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Name */}
          <div>
            <label className="label">Workspace name <span className="text-[#da3633]">*</span></label>
            <input
              className="input"
              placeholder="my-project"
              value={name}
              onChange={e => setName(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
              autoFocus
              required
            />
            <p className="text-xs text-[#484f58] mt-1">Letters, numbers, hyphens and underscores only</p>
          </div>

          {/* Description */}
          <div>
            <label className="label">Description <span className="text-[#484f58]">(optional)</span></label>
            <input
              className="input"
              placeholder="What is this workspace for?"
              value={desc}
              onChange={e => setDesc(e.target.value)}
            />
          </div>

          {/* Source toggle */}
          <div>
            <label className="label">Source</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSource(SOURCE_BLANK)}
                className={`flex items-center gap-2 p-3 rounded-md border text-sm transition-all ${
                  source === SOURCE_BLANK
                    ? 'border-[#1f6feb] bg-[#1f6feb]/10 text-[#e6edf3]'
                    : 'border-[#30363d] text-[#8b949e] hover:border-[#8b949e]'
                }`}
              >
                <Box className="w-4 h-4" />
                Start from template
              </button>
              <button
                type="button"
                onClick={() => setSource(SOURCE_GIT)}
                className={`flex items-center gap-2 p-3 rounded-md border text-sm transition-all ${
                  source === SOURCE_GIT
                    ? 'border-[#1f6feb] bg-[#1f6feb]/10 text-[#e6edf3]'
                    : 'border-[#30363d] text-[#8b949e] hover:border-[#8b949e]'
                }`}
              >
                <GitBranch className="w-4 h-4" />
                Clone from Git
              </button>
            </div>
          </div>

          {/* Conditional: template picker */}
          {source === SOURCE_BLANK && (
            <div>
              <label className="label">Template</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {TEMPLATES.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTemplate(t.id)}
                    className={`flex flex-col items-start gap-1 p-3 rounded-md border text-left transition-all ${
                      template === t.id
                        ? 'border-[#1f6feb] bg-[#1f6feb]/10'
                        : 'border-[#30363d] hover:border-[#8b949e]'
                    }`}
                  >
                    <span className="text-xl leading-none">{t.icon}</span>
                    <span className="text-sm font-medium text-[#e6edf3]">{t.label}</span>
                    <span className="text-xs text-[#8b949e]">{t.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Conditional: git URL */}
          {source === SOURCE_GIT && (
            <div>
              <label className="label">Git repository URL <span className="text-[#da3633]">*</span></label>
              <input
                className="input"
                placeholder="https://github.com/user/repo.git"
                value={gitUrl}
                onChange={e => setGitUrl(e.target.value)}
                type="url"
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
            >
              {loading
                ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Creating…</>
                : 'Create workspace'
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
