import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { motion } from "motion/react";
import {
  Search,
  X,
  Inbox,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  LoaderCircle,
} from "lucide-react";

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return (
    <span className={`badge ${tone}`}>
      <i />
      {children}
    </span>
  );
}
export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`panel ${className}`}>{children}</section>;
}
export function Button({
  children,
  onClick,
  variant = "primary",
  disabled = false,
  type = "button",
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: string;
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`button ${variant} ${className}`}
    >
      {children}
    </button>
  );
}
export function Empty({
  title = "没有符合条件的记录",
  text = "试试其他关键词，或清除筛选。",
  action,
}: {
  title?: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Inbox size={25} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
export function SearchBox({
  value,
  onChange,
  placeholder = "搜索记录",
  label = "搜索记录",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  label?: string;
}) {
  return (
    <label className="searchbox">
      <Search size={17} />
      <input
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button aria-label="清除搜索" onClick={() => onChange("")}>
          <X size={15} />
        </button>
      )}
    </label>
  );
}
export function Modal({
  title,
  subtitle,
  children,
  footer,
  onClose,
  drawer = false,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  drawer?: boolean;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const el = ref.current!,
      previous = document.activeElement as HTMLElement | null;
    el.showModal();
    const y = window.scrollY,
      old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const cancel = (e: Event) => {
      e.preventDefault();
      closeRef.current();
    };
    el.addEventListener("cancel", cancel);
    return () => {
      el.removeEventListener("cancel", cancel);
      el.close();
      document.body.style.overflow = old;
      window.scrollTo(0, y);
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby="dialog-title"
      className={`dialog ${drawer ? "drawer" : ""} ${wide ? "wide" : ""}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const r = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            onClose();
        }
      }}
    >
      <motion.div
        initial={
          drawer ? { opacity: 0, x: 24 } : { opacity: 0, y: 12, scale: 0.98 }
        }
        animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
      >
        <div className="dialog-head">
          <div>
            <h2 id="dialog-title">{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button
            className="icon-button"
            aria-label="关闭面板"
            onClick={onClose}
          >
            <X size={21} />
          </button>
        </div>
        <div className="dialog-body">{children}</div>
        {footer && <div className="dialog-footer">{footer}</div>}
      </motion.div>
    </dialog>
  );
}
export function Pager({
  page,
  total,
  pageSize = 8,
  onChange,
}: {
  page: number;
  total: number;
  pageSize?: number;
  onChange: (n: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="pager">
      <span>
        共 {total} 条
        {total > 0 &&
          `，显示 ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} 条`}
      </span>
      <div>
        <button
          className="icon-button"
          aria-label="上一页"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          <ChevronLeft size={17} />
        </button>
        <span>
          {page} / {pages}
        </span>
        <button
          className="icon-button"
          aria-label="下一页"
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
        >
          <ChevronRight size={17} />
        </button>
      </div>
    </div>
  );
}
export function SortButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button className="sort" onClick={onClick}>
      {children}
      <ArrowUpDown size={13} />
    </button>
  );
}
export function Busy() {
  return <LoaderCircle className="spin" size={17} />;
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
