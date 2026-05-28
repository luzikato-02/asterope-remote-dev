import { useState } from 'react';
import toast from 'react-hot-toast';
import { Lock, Terminal } from 'lucide-react';
import { auth } from '../api.js';

export default function Login({ onLogin }) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await auth.login(password);
      localStorage.setItem('asterope_token', data.token);
      onLogin();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed');
      setPassword('');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0d1117] flex items-center justify-center px-4">
      {/* Background grid */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2240%22%20height%3D%2240%22%20viewBox%3D%220%200%2040%2040%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%2330363d%22%20fill-opacity%3D%220.2%22%3E%3Cpath%20d%3D%22M0%2040L40%200H0V40z%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E')] opacity-20 pointer-events-none" />

      <div className="relative w-full max-w-sm animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#161b22] border border-[#30363d] mb-4">
            <Terminal className="w-7 h-7 text-[#1f6feb]" />
          </div>
          <h1 className="text-2xl font-bold text-[#e6edf3]">Asterope</h1>
          <p className="text-sm text-[#8b949e] mt-1">Remote Development Dashboard</p>
        </div>

        {/* Card */}
        <div className="card p-6">
          <h2 className="text-base font-semibold text-[#e6edf3] mb-5 flex items-center gap-2">
            <Lock className="w-4 h-4 text-[#8b949e]" />
            Sign in to continue
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Password</label>
              <input
                type="password"
                className="input"
                placeholder="Enter your dashboard password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoFocus
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading || !password}
              className="btn-accent w-full justify-center py-2"
            >
              {loading
                ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Signing in…</>
                : 'Sign in'
              }
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-[#484f58] mt-6">
          Asterope — self-hosted remote development
        </p>
      </div>
    </div>
  );
}
