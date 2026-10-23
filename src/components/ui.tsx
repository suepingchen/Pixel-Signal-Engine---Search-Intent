import { ReactNode } from 'react';

export function Card({ title, children, right }: { title?: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      {(title || right) && (
        <div className="flex items-start justify-between gap-3 mb-3">
          {title && <h3 className="text-sm font-bold text-slate-900">{title}</h3>}
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function Note({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warn' | 'ok' }) {
  const c = tone === 'warn' ? 'bg-amber-50 border-amber-200 text-amber-900' : tone === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-blue-50 border-blue-200 text-blue-900';
  return <div className={`rounded-lg border px-3 py-2 text-xs leading-relaxed ${c}`}>{children}</div>;
}

export function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr>{head.map((h) => <th key={h} className="text-left font-semibold text-slate-600 border-b border-slate-200 px-2 py-1.5 whitespace-nowrap">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-slate-100">{r.map((c, j) => <td key={j} className="px-2 py-1.5 align-top">{c}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Btn({ children, onClick, kind = 'primary', disabled }: { children: ReactNode; onClick?: () => void; kind?: 'primary' | 'ghost'; disabled?: boolean }) {
  const c = kind === 'primary' ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-300';
  return <button type="button" disabled={disabled} onClick={onClick} className={`px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50 ${c}`}>{children}</button>;
}

export function download(name: string, text: string, type = 'text/csv') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}
