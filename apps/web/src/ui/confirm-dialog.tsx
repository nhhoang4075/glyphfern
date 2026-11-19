import { useEffect, useRef } from "react";
import { Button } from "./button";
import { cx } from "./cx";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  className?: string;
}

export function ConfirmDialog({
  open,
  title,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  className,
}: ConfirmDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (!element) {
      return;
    }
    if (open && !element.open) {
      element.showModal();
    } else if (!open && element.open) {
      element.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialog}
      className={cx("cfm", className)}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
    >
      <p className="cfm-title">{title}</p>
      <div className="cfm-actions">
        <Button className="cfm-btn" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button className="cfm-btn danger" onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
