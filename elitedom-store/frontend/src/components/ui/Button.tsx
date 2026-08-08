import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary: "border border-primary bg-primary text-primary-contrast shadow-sm hover:brightness-105",
  secondary: "border border-border bg-surface text-foreground shadow-sm hover:border-primary/40 hover:bg-elevated",
  ghost: "border border-transparent bg-transparent text-foreground hover:bg-elevated",
  danger: "border border-danger bg-danger text-primary-contrast shadow-sm hover:brightness-105",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "min-h-9 px-3 text-xs",
  md: "min-h-11 px-4 text-sm",
  lg: "min-h-12 px-5 text-sm",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    children,
    className,
    disabled,
    isLoading = false,
    size = "md",
    type = "button",
    variant = "primary",
    ...props
  },
  ref,
) {
  return (
    <button
      className={cn(
        "focus-ring inline-flex items-center justify-center gap-2 rounded-lg font-bold transition duration-150 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      disabled={disabled || isLoading}
      ref={ref}
      type={type}
      {...props}
    >
      {isLoading ? (
        <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-current border-e-transparent" />
      ) : null}
      {children}
    </button>
  );
});
