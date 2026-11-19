import { type EpubPreview, type Lang, defaultSelectedIds } from "@glyphfern/core";
import { useEffect, useRef, useState } from "react";
import { Button } from "../ui";

const LANGUAGE_NAMES: Record<Lang, string> = { es: "Tiếng Tây Ban Nha" };

export interface ImportPreviewDialogProps {
  preview: EpubPreview;
  busy: boolean;
  onImport: (chapterIds: readonly string[]) => void;
  onCancel: () => void;
}

export function ImportPreviewDialog({
  preview,
  busy,
  onImport,
  onCancel,
}: ImportPreviewDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState<ReadonlySet<string>>(
    () => new Set(defaultSelectedIds(preview)),
  );

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) {
      element.showModal();
    }
  }, []);

  const toggle = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (!next.delete(id)) {
        next.add(id);
      }
      return next;
    });
  };

  const orderedIds = preview.chapters.filter((c) => selected.has(c.id)).map((c) => c.id);

  return (
    <dialog
      ref={dialog}
      className="cfm ipv"
      aria-label="Xem trước sách sắp thêm"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
    >
      <p className="cfm-title ipv-title">{preview.title || "Sách chưa có tên"}</p>
      <p className="ipv-meta">
        {`Ngôn ngữ: ${LANGUAGE_NAMES[preview.lang]} · Đã chọn ${selected.size}/${preview.chapters.length} chương`}
      </p>
      <ul className="ipv-list">
        {preview.chapters.map((chapter) => (
          <li key={chapter.id}>
            <label className="ipv-row">
              <input
                type="checkbox"
                checked={selected.has(chapter.id)}
                onChange={() => toggle(chapter.id)}
              />
              <span className="ipv-name">
                {chapter.title}
                {chapter.frontBackMatter ? <span className="ipv-tag">đầu/cuối sách</span> : null}
              </span>
              <span className="ipv-count">{`${chapter.wordCount} từ`}</span>
            </label>
          </li>
        ))}
      </ul>
      <div className="cfm-actions">
        <Button className="cfm-btn" onClick={onCancel} disabled={busy}>
          Huỷ
        </Button>
        <Button
          className="cfm-btn ipv-go"
          disabled={busy || orderedIds.length === 0}
          onClick={() => onImport(orderedIds)}
        >
          Thêm sách
        </Button>
      </div>
    </dialog>
  );
}
