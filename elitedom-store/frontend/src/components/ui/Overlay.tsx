"use client";

import { useEffect, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";

type OverlayProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
};

function useEscapeToClose(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);
}

export function Modal({ children, description, footer, onClose, open, title }: OverlayProps) {
  useEscapeToClose(open, onClose);
  if (!open) return null;

  return (
    <div aria-modal="true" className="fixed inset-0 z-[110] grid place-items-center bg-overlay p-4" role="dialog">
      <button aria-label="Close modal" className="absolute inset-0 cursor-default" onClick={onClose} type="button" />
      <section className="relative z-10 w-full max-w-lg rounded-xl border border-border bg-surface p-5 text-foreground shadow-2xl sm:p-6">
        <OverlayHeader description={description} onClose={onClose} title={title} />
        <div className="mt-5">{children}</div>
        {footer ? <footer className="mt-6 flex flex-wrap justify-end gap-2 border-t border-border pt-4">{footer}</footer> : null}
      </section>
    </div>
  );
}

export function Drawer({ children, description, footer, onClose, open, title }: OverlayProps) {
  useEscapeToClose(open, onClose);
  if (!open) return null;

  return (
    <div aria-modal="true" className="fixed inset-0 z-[110] bg-overlay" role="dialog">
      <button aria-label="Close drawer" className="absolute inset-0 cursor-default" onClick={onClose} type="button" />
      <section className="relative z-10 ms-auto flex h-full w-full max-w-md flex-col border-s border-border bg-surface p-5 text-foreground shadow-2xl sm:p-6">
        <OverlayHeader description={description} onClose={onClose} title={title} />
        <div className="mt-5 flex-1 overflow-y-auto overscroll-contain">{children}</div>
        {footer ? <footer className="mt-5 flex flex-wrap justify-end gap-2 border-t border-border pt-4">{footer}</footer> : null}
      </section>
    </div>
  );
}

function OverlayHeader({ description, onClose, title }: { description?: string; onClose: () => void; title: string }) {
  return (
    <header className="flex items-start justify-between gap-4 border-b border-border pb-4">
      <div className="min-w-0">
        <h2 className="text-lg font-black tracking-tight">{title}</h2>
        {description ? <p className="mt-1 text-sm leading-6 text-muted">{description}</p> : null}
      </div>
      <Button aria-label="Close" className="h-9 w-9 shrink-0 px-0 text-lg" onClick={onClose} size="sm" variant="ghost">×</Button>
    </header>
  );
}
