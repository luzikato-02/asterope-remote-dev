import { useEffect, useState } from 'react';
import { Cpu, MemoryStick, HardDrive } from 'lucide-react';
import { metrics } from '../api.js';

function Bar({ value, color }) {
  return (
    <div className="h-1 w-16 bg-[#30363d] rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-700 ${color}`}
        style={{ width: `${Math.min(value, 100)}%` }}
      />
    </div>
  );
}

function Stat({ icon: Icon, label, value, color }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <Icon className="w-3.5 h-3.5 text-[#8b949e] shrink-0" />
      <span className="text-[#8b949e]">{label}</span>
      <Bar value={value} color={color} />
      <span className="text-[#e6edf3] font-medium tabular-nums w-8 text-right">{value}%</span>
    </div>
  );
}

export default function SystemStats() {
  const [data, setData] = useState(null);

  async function fetchMetrics() {
    try {
      const res = await metrics.get();
      setData(res.data);
    } catch {}
  }

  useEffect(() => {
    fetchMetrics();
    const id = setInterval(fetchMetrics, 8000);
    return () => clearInterval(id);
  }, []);

  if (!data) return null;

  const cpuColor   = data.cpu.usage > 80 ? 'bg-[#da3633]' : data.cpu.usage > 60 ? 'bg-[#d29922]' : 'bg-[#1f6feb]';
  const memColor   = data.memory.usagePercent > 80 ? 'bg-[#da3633]' : data.memory.usagePercent > 60 ? 'bg-[#d29922]' : 'bg-[#238636]';
  const diskColor  = data.disk.usagePercent > 80 ? 'bg-[#da3633]' : data.disk.usagePercent > 60 ? 'bg-[#d29922]' : 'bg-[#8957e5]';

  return (
    <div className="hidden md:flex items-center gap-4 px-3 py-1.5 rounded-lg bg-[#161b22] border border-[#30363d]">
      <Stat icon={Cpu}        label="CPU"  value={data.cpu.usage}            color={cpuColor}  />
      <div className="w-px h-4 bg-[#30363d]" />
      <Stat icon={MemoryStick} label="RAM"  value={data.memory.usagePercent}  color={memColor}  />
      <div className="w-px h-4 bg-[#30363d]" />
      <Stat icon={HardDrive}  label="Disk" value={data.disk.usagePercent}    color={diskColor} />
    </div>
  );
}
