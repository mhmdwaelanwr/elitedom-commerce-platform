import { forwardRef, useId, type InputHTMLAttributes, type SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type FieldTextProps = {
  label?: string;
  hint?: string;
  error?: string;
};

export type InputProps = InputHTMLAttributes<HTMLInputElement> & FieldTextProps;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, error, hint, id, label, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const descriptionId = error || hint ? `${inputId}-description` : undefined;

  return (
    <label className="grid gap-1.5 text-sm font-semibold text-foreground" htmlFor={inputId}>
      {label ? <span>{label}</span> : null}
      <input
        aria-describedby={descriptionId}
        aria-invalid={Boolean(error)}
        className={cn(
          "focus-ring min-h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground outline-none transition placeholder:text-muted hover:border-primary/30 focus:border-primary focus:ring-2 focus:ring-primary/10",
          error && "border-danger focus:border-danger focus:ring-danger/10",
          className,
        )}
        id={inputId}
        ref={ref}
        {...props}
      />
      {error || hint ? (
        <span className={cn("text-xs font-medium leading-5", error ? "text-danger" : "text-muted")} id={descriptionId}>
          {error ?? hint}
        </span>
      ) : null}
    </label>
  );
});

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & FieldTextProps;

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { children, className, error, hint, id, label, ...props },
  ref,
) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const descriptionId = error || hint ? `${selectId}-description` : undefined;

  return (
    <label className="grid gap-1.5 text-sm font-semibold text-foreground" htmlFor={selectId}>
      {label ? <span>{label}</span> : null}
      <select
        aria-describedby={descriptionId}
        aria-invalid={Boolean(error)}
        className={cn(
          "focus-ring min-h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground outline-none transition hover:border-primary/30 focus:border-primary focus:ring-2 focus:ring-primary/10",
          error && "border-danger focus:border-danger focus:ring-danger/10",
          className,
        )}
        id={selectId}
        ref={ref}
        {...props}
      >
        {children}
      </select>
      {error || hint ? (
        <span className={cn("text-xs font-medium leading-5", error ? "text-danger" : "text-muted")} id={descriptionId}>
          {error ?? hint}
        </span>
      ) : null}
    </label>
  );
});
