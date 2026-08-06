import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
} from "react";
import { cn } from "@/lib/cn";

type FieldTextProps = {
  label?: string;
  hint?: string;
  error?: string;
};

export type InputProps = InputHTMLAttributes<HTMLInputElement> & FieldTextProps;

export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input(
    { className, error, hint, id, label, ...props },
    ref,
  ) {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const descriptionId = error || hint ? `${inputId}-description` : undefined;

    return (
      <label className="grid gap-2 text-sm font-semibold text-foreground" htmlFor={inputId}>
        {label && <span>{label}</span>}
        <input
          aria-describedby={descriptionId}
          aria-invalid={Boolean(error)}
          className={cn(
            "focus-ring min-h-11 w-full rounded-xl border border-border bg-surface px-3 text-foreground outline-none placeholder:text-muted",
            error && "border-danger",
            className,
          )}
          id={inputId}
          ref={ref}
          {...props}
        />
        {(error || hint) && (
          <span
            className={cn("text-xs font-medium", error ? "text-danger" : "text-muted")}
            id={descriptionId}
          >
            {error ?? hint}
          </span>
        )}
      </label>
    );
  },
);

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & FieldTextProps;

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select(
    { children, className, error, hint, id, label, ...props },
    ref,
  ) {
    const generatedId = useId();
    const selectId = id ?? generatedId;
    const descriptionId = error || hint ? `${selectId}-description` : undefined;

    return (
      <label className="grid gap-2 text-sm font-semibold text-foreground" htmlFor={selectId}>
        {label && <span>{label}</span>}
        <select
          aria-describedby={descriptionId}
          aria-invalid={Boolean(error)}
          className={cn(
            "focus-ring min-h-11 w-full rounded-xl border border-border bg-surface px-3 text-foreground outline-none",
            error && "border-danger",
            className,
          )}
          id={selectId}
          ref={ref}
          {...props}
        >
          {children}
        </select>
        {(error || hint) && (
          <span
            className={cn("text-xs font-medium", error ? "text-danger" : "text-muted")}
            id={descriptionId}
          >
            {error ?? hint}
          </span>
        )}
      </label>
    );
  },
);
