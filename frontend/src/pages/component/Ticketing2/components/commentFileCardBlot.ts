import Quill from "quill";
import { BlockEmbed } from "quill/blots/block.js";

export type CommentFileCardValue = {
  url: string;
  name: string;
  size: number;
};

function formatCommentFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function commentFileKindLabel(name: string, url: string): string {
  const n = (name || "").toLowerCase();
  const u = (url || "").toLowerCase();
  if (n.endsWith(".pdf") || u.includes("application/pdf")) return "PDF";
  if (n.endsWith(".xlsx") || u.includes("spreadsheetml.sheet")) return "XLSX";
  if (n.endsWith(".xls") || u.includes("application/vnd.ms-excel")) return "XLS";
  if (n.endsWith(".csv") || u.includes("text/csv") || u.includes("application/csv")) return "CSV";
  return "FILE";
}

function commentFileIconColors(kind: string): { bg: string; fg: string } {
  if (kind === "PDF") return { bg: "#dc2626", fg: "#ffffff" };
  if (kind === "XLSX" || kind === "XLS" || kind === "CSV") return { bg: "#16a34a", fg: "#ffffff" };
  return { bg: "#64748b", fg: "#ffffff" };
}

function isDarkUiPreferred(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains("dark");
}

function populateCommentFileCardNode(node: HTMLDivElement, value: CommentFileCardValue): void {
  const name = value.name || "Attachment";
  const url = value.url;
  const size = value.size ?? 0;
  const kind = commentFileKindLabel(name, url);
  const { bg, fg } = commentFileIconColors(kind);
  const meta = `${kind}${size > 0 ? ` • ${formatCommentFileSize(size)}` : ""}`;
  const dark = isDarkUiPreferred();

  node.textContent = "";
  node.style.cssText = [
    "display:flex",
    "align-items:center",
    "gap:12px",
    "padding:8px 12px",
    "margin:6px 0",
    "border-radius:12px",
    "width:100%",
    "max-width:340px",
    "min-height:56px",
    dark ? "background:rgba(6,78,59,0.34)" : "background:#d1fae5",
    dark ? "border:1px solid rgba(16,185,129,0.35)" : "border:1px solid #a7f3d0",
    "box-sizing:border-box",
    "font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
  ].join(";");

  const iconBox = document.createElement("div");
  iconBox.style.cssText =
    "flex-shrink:0;width:40px;height:40px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:11px;letter-spacing:0.02em;";
  iconBox.style.background = bg;
  iconBox.style.color = fg;
  iconBox.textContent = kind === "FILE" ? "DOC" : kind;

  const textCol = document.createElement("div");
  textCol.style.cssText =
    "flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;";
  const title = document.createElement("div");
  title.style.cssText = [
    "font-size:14px;font-weight:600;line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;",
    dark ? "color:#e5e7eb" : "color:#111827",
  ].join("");
  title.textContent = name;
  const sub = document.createElement("div");
  sub.style.cssText = dark ? "font-size:12px;color:#9ca3af;" : "font-size:12px;color:#6b7280;";
  sub.textContent = meta;
  textCol.appendChild(title);
  textCol.appendChild(sub);

  const dlBtn = document.createElement("button");
  dlBtn.type = "button";
  dlBtn.setAttribute("aria-label", "Download file");
  dlBtn.style.cssText = dark
    ? "flex-shrink:0;width:32px;height:32px;border-radius:9999px;border:none;background:rgba(255,255,255,0.12);cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;color:#e5e7eb;"
    : "flex-shrink:0;width:32px;height:32px;border-radius:9999px;border:none;background:rgba(0,0,0,0.08);cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;color:#334155;";
  dlBtn.innerHTML =
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>';

  dlBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  });

  node.appendChild(iconBox);
  node.appendChild(textCol);
  node.appendChild(dlBtn);
}

class CommentFileCardBlot extends BlockEmbed {
  static blotName = "commentFileCard";
  static tagName = "div";
  static className = "ql-comment-file-card";

  static create(value: CommentFileCardValue | string) {
    const node = super.create() as HTMLDivElement;
    const parsed: CommentFileCardValue =
      typeof value === "string"
        ? { url: value, name: "Attachment", size: 0 }
        : {
            url: value?.url ?? "",
            name: value?.name ?? "Attachment",
            size: Number(value?.size ?? 0),
          };
    node.setAttribute("data-url", parsed.url);
    node.setAttribute("data-name", parsed.name);
    node.setAttribute("data-size", String(parsed.size));
    // Keep attachment card immutable inside Quill editor.
    node.setAttribute("contenteditable", "false");
    node.setAttribute("spellcheck", "false");
    node.setAttribute("draggable", "false");
    populateCommentFileCardNode(node, parsed);
    return node;
  }

  static value(node: HTMLElement): CommentFileCardValue {
    return {
      url: node.getAttribute("data-url") || "",
      name: node.getAttribute("data-name") || "",
      size: Number(node.getAttribute("data-size") || 0),
    };
  }

  attach() {
    super.attach();
    const node = this.domNode as HTMLDivElement;
    if (
      node &&
      node.childNodes.length === 0 &&
      (node.getAttribute("data-url") || "").trim() !== ""
    ) {
      populateCommentFileCardNode(node, CommentFileCardBlot.value(node));
    }
  }
}

let registered = false;

export function registerCommentFileCardBlot(): void {
  if (registered) return;
  Quill.register(CommentFileCardBlot, true);
  registered = true;
}
