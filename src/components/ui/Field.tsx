/**
 * @fileoverview A labelled control with an optional hint underneath.
 */

interface FieldProps {
  label: string;
  /** Plain-language explanation of what the control does right now */
  hint?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export default function Field({ label, hint, children, className = '' }: FieldProps) {
  return (
    <div className={`flex min-w-0 flex-col gap-2 ${className}`}>
      <span className="text-sm text-ink-muted">{label}</span>
      {children}
      {hint && <p className="text-xs leading-relaxed text-ink-faint">{hint}</p>}
    </div>
  );
}
