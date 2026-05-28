import { useState } from 'react';
import { X, GitBranch, FolderPlus, Box } from 'lucide-react';
import toast from 'react-hot-toast';
import { workspaces } from '../api.js';

const TEMPLATES = [
  { id: 'blank',     label: 'Blank',      icon: '📄', desc: 'Empty workspace',                  image: 'asterope/base'      },
  { id: 'node',      label: 'Node.js',    icon: '🟢', desc: 'Node 20 · npm · yarn · TypeScript', image: 'asterope/node'      },
  { id: 'python',    label: 'Python',     icon: '🐍', desc: 'Python 3 · pip · poetry',           image: 'asterope/python'    },
  { id: 'php',       label: 'PHP',        icon: '🐘', desc: 'PHP 8.3 · Composer',                image: 'asterope/php'       },
  { id: 'laravel',   label: 'Laravel',    icon: '🎼', desc: 'PHP · Composer · Node · Laravel',   image: 'asterope/laravel'   },
  { id: 'react',     label: 'React',      icon: '⚛️', desc: 'Node 20 · Vite · TypeScript',       image: 'asterope/node'      },
  { id: 'go',        label: 'Go',         icon: '🐹', desc: 'Go 1.22',                            image: 'asterope/go'        },
  { id: 'fullstack', label: 'Full-stack', icon: '🌐', desc: 'PHP · Node · Python · Go',           image: 'asterope/fullstack' },
];

const SOURCE_BLANK = 'blank';
const SOURCE_GIT   = 'git';

export default function CreateModal({ onClose, onCreated }) {
  const [name, setName]         = useState('');
  const [desc, setDesc]         = useState('');
  const [source, setSource]     = useState(SOURCE_BLANK);
  const [gitUrl, setGitUrl]     = useState('');
  const [gitTemplate, setGitTemplate] = useState('blank');
  const [template, setTemplate] = useState('blank');
  const [loading, setLoading]   = useState(false);

  const selectedTpl = TEMPLATES.find(t => t.id === (source === SOURCE_GIT ? gitTemplate : template));

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) { toast.error('Name is required'); return; }
    if (source === SOURCE_GIT && !gitUrl.trim()) { toast.error('Git URL is required'); return; }

    setLoading(true);
    try {
      const { data } = await workspaces.create({
        name:        name.trim(),
        description: desc.trim(),
        gitUrl:      source === SOURCE_GIT ? gitUrl.trim() : null,
        template:    source === SOURCE_GIT ? gitTemplate : template,
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
      <div className="relative w-full max-w-2xl card animate-slide-up shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#30363d] shrink-0">
          <div className="flex items-center gap-2">
            <FolderPlus className="w-5 h-5 text-[#1f6feb]" />
            <h2 className="text-base font-semibold text-[#e6edf3]">New workspace</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-[#30363d] transition-colors text-[#8b949e] hover:text-[#e6edf3]">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1">
          <form onSubmit={handleSubmit} id="create-form" className="p-5 space-y-5">
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
                  Template
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

            {/* Template picker (always visible — controls the Docker image) */}
            <div>
              <label className="label">
                {source === SOURCE_GIT ? 'Docker environment' : 'Template'}
                <span className="ml-1 text-[#484f58] font-normal text-xs">— determines the container image</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {TEMPLATES.map(t => {
                  const active = source === SOURCE_GIT ? gitTemplate === t.id : template === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => source === SOURCE_GIT ? setGitTemplate(t.id) : setTemplate(t.id)}
                      className={`flex flex-col items-start gap-1 p-3 rounded-md border text-left transition-all ${
                        active
                          ? 'border-[#1f6feb] bg-[#1f6feb]/10'
                          : 'border-[#30363d] hover:border-[#8b949e]'
                      }`}
                    >
                      <span className="text-xl leading-none">{t.icon}</span>
                      <span className="text-sm font-medium text-[#e6edf3]">{t.label}</span>
                      <span className="text-xs text-[#8b949e] leading-snug">{t.desc}</span>
                    </button>
                  );
                })}
              </div>

              {/* Selected image pill */}
              {selectedTpl && (
                <p className="text-xs text-[#8b949e] mt-2">
                  Docker image: <code className="text-[#58a6ff] bg-[#0d1117] px-1.5 py-0.5 rounded">{selectedTpl.image}:latest</code>
                </p>
              )}
            </div>

            {/* Git URL (only for clone source) */}
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
          </form>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-5 border-t border-[#30363d] shrink-0">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" form="create-form" disabled={loading} className="btn-primary">
            {loading
              ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Creating&hellip;</>
              : 'Create workspace'
            }
          </button>
        </div>
      </div>
    </div>
  );
}
