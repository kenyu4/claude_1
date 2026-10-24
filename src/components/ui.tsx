import type { Subject } from "@/lib/types";

export const SUBJECT_STYLE: Record<Subject, { dot: string; chip: string }> = {
  算数: { dot: "bg-blue-500", chip: "bg-blue-50 text-blue-700" },
  国語: { dot: "bg-rose-500", chip: "bg-rose-50 text-rose-700" },
  理科: { dot: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-700" },
  社会: { dot: "bg-amber-500", chip: "bg-amber-50 text-amber-800" },
  その他: { dot: "bg-zinc-400", chip: "bg-zinc-100 text-zinc-700" },
};

export function SubjectChip({ subject }: { subject: Subject }) {
  return (
    <span className={`inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[11px] font-bold ${SUBJECT_STYLE[subject].chip}`}>
      {subject}
    </span>
  );
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-100" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-zinc-900 transition-[width] duration-300" style={{ width: `${value}%` }} />
    </div>
  );
}

export const btn = {
  primary:
    "inline-flex min-h-12 items-center justify-center rounded-xl bg-zinc-900 px-5 text-[15px] font-bold text-white active:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-300",
  secondary:
    "inline-flex min-h-11 items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-800 active:bg-zinc-50 disabled:opacity-40",
  ghost: "inline-flex min-h-10 items-center justify-center rounded-lg px-3 text-sm font-medium text-zinc-600 active:bg-zinc-100",
  danger: "inline-flex min-h-10 items-center justify-center rounded-lg px-3 text-sm font-medium text-red-600 active:bg-red-50",
};

export const field =
  "w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-base outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900";
