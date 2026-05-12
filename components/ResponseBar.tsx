import { Choice } from '@/lib/types';

export function ResponseBar({ label, count, total }: { label: Choice; count: number; total: number }) {
  const ratio = total === 0 ? 0 : Math.round((count / total) * 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm"><span>{label}</span><span>{count}人 ({ratio}%)</span></div>
      <div className="h-3 rounded bg-slate-200">
        <div className="h-full rounded bg-blue-500" style={{ width: `${ratio}%` }} />
      </div>
    </div>
  );
}
