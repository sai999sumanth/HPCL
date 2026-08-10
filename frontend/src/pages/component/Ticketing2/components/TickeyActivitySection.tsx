import React, { useState, useMemo, useEffect, useCallback, useRef, useLayoutEffect } from "react";
import ReactQuill from "react-quill-new";
import "quill/dist/quill.snow.css";
import { Settings, MessageCircle, Clock, Pencil, Trash2, Download } from "lucide-react";
import { Button } from "@/@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/@/components/ui/alert-dialog";
import { apiClient } from "@/services/apiClient";
import { toast } from "sonner";
import useAuthStore from "@/store/authStore";
import { config } from "@/configs/excrypt.config";
import { registerCommentFileCardBlot } from "./commentFileCardBlot";

registerCommentFileCardBlot();

const COMMENT_QUILL_FORMATS = [
  "bold",
  "italic",
  "underline",
  "strike",
  "list",
  "image",
  "commentFileCard",
] as const;

export interface SavedComment {
  id: string;
  body: string;
  authorName: string;
  authorInitials: string;
  createdAt: string;
  /** Employee ID of the author (from /api/session/me or API) */
  employeeId?: string;
}

/** Single edit entry in update_history (JSON string from API) */
export interface UpdateHistoryEntry {
  old_content: string;
  updated_by: string;
  updated_time: string;
}

/** Comment from API with full fields for History display */
export interface HistoryComment extends SavedComment {
  updatedAt?: string;
  updateHistory?: string[]; // JSON strings: { old_content, updated_by, updated_time }
  documents?: string[]; // Image/file URLs associated with this comment (from API)
}

export interface TicketActivitySectionProps {
  /** Draft comment (controlled by parent for form submit) */
  comment: string;
  setComment: (value: string) => void;
  /** Ticket history from API (kept for future use but not shown in UI now) */
  ticketHistory?: any[];
  /** Ticket ID for persisting comments via API */
  ticketId?: string;
  /** Current user display name for new comments */
  currentUserName?: string;
  formElementsDisabled?: boolean;
  isEditMode?: boolean;
  /** Optional initial saved comments (e.g. from API); otherwise in-component state */
  initialSavedComments?: SavedComment[];
  /** Callback when user saves a new comment (parent can persist if needed) */
  onSaveComment?: (comment: SavedComment) => void;
  /** Re-assignee employee ids from get_ticket_by_id payload */
  reAssigneeEmployeeIds?: string[];
}

const getAttachmentCacheKey = (
  commentId: string | null | undefined,
  fileAttachmentName: string
): string =>
  commentId != null && String(commentId).length > 0
    ? `${commentId}::${fileAttachmentName}`
    : fileAttachmentName;

const ticketCommentsInFlightByTicketId = new Map<string, Promise<HistoryComment[]>>();

const getInitials = (name: string): string => {
  if (!name || !name.trim()) return "?";
  const trimmed = name.trim();
  const parts = trimmed.split(/\s+/);

  // Handle usernames/ids like `9000_g1m` -> `9g`
  const idParts = trimmed.split(/[_-]+/).filter(Boolean);
  if (idParts.length >= 2) {
    const first = idParts[0][0] || "";
    const second = idParts[1][0] || "";
    const combined = `${first}${second}`.trim();
    if (combined) return combined;
  }

  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
};

const normalizeHistoryAuthor = (value: string): string =>
  (value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

const HISTORY_HIGHLIGHT_AUTHORS = [
  "HQO HSE LPG",
  "HQO HSE SOD",
  "HQO TICKETING",
].map(normalizeHistoryAuthor);

const COMMENT_ALLOWED_ROLES = [
  "HQO HSE LPG",
  "HQO HSE SOD",
  "HQO TICKETING",
  "location- Location In-Charge SOD",
  "Plant In-Charge SOD",
  "Zonal SOD Ticketing",
  "Zonal Head  SOD Ticketing",
];

/** Matches ticket attachment limit — image, PDF, Excel, or CSV in comments */
const MAX_COMMENT_ATTACHMENT_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_COMMENT_ATTACHMENT_COUNT = 1;

const COMMENT_FILE_INPUT_ACCEPT =
  "image/*,.pdf,.xlsx,.xls,.csv,text/csv,application/csv,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel";

const isSupportedNonImageDataUrl = (href: string): boolean => {
  const h = (href || "").toLowerCase();
  if (!h.startsWith("data:")) return false;
  return (
    h.includes("application/pdf") ||
    h.includes("spreadsheetml.sheet") ||
    h.includes("application/vnd.ms-excel") ||
    h.includes("text/csv") ||
    h.includes("application/csv")
  );
};

const isAllowedActivityUploadFile = (file: File): boolean => {
  const t = (file.type || "").toLowerCase();
  if (t.startsWith("image/")) return true;
  if (
    t === "application/pdf" ||
    t === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    t === "application/vnd.ms-excel" ||
    t === "text/csv" ||
    t === "application/csv"
  ) {
    return true;
  }
  const name = file.name || "";
  if (/\.(pdf|xlsx|xls|csv)$/i.test(name)) return true;
  if (/\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name)) return true;
  return false;
};

const normalizeRoleName = (value: string): string =>
  (value || "")
    .toUpperCase()
    .replace(/[_-]+/g, " ")
    .replace(/[^A-Z0-9 ]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

const hasInChargeSodCommentAccess = (normalizedRole: string): boolean => {
  if (!normalizedRole) return false;
  const containsInChargeSod =
    normalizedRole.includes("IN CHARGE SOD") ||
    normalizedRole.includes("INCHARGE SOD");
  const isScopedToLocationOrPlant =
    normalizedRole.includes("LOCATION") || normalizedRole.includes("PLANT");
  return containsInChargeSod && isScopedToLocationOrPlant;
};

const fetchTicketCommentsWithDedup = (
  ticketId: string,
  currentUserName: string
): Promise<HistoryComment[]> => {
  const existingRequest = ticketCommentsInFlightByTicketId.get(ticketId);
  if (existingRequest) return existingRequest;

  const request = (async (): Promise<HistoryComment[]> => {
    const response = await apiClient.get("/api/ticketcomment", {
      params: {
        q: `ticket_id='${ticketId}'`,
      },
    });

    const raw =
      Array.isArray(response.data)
        ? response.data
        : Array.isArray(response.data?.data)
          ? response.data.data
          : [];

    return raw.map((item: any, index: number) => {
      const author =
        item.created_by ??
        item.employee_id ??
        item.authorName ??
        currentUserName;

      const documents = Array.isArray(item.documents) ? item.documents : undefined;
      const rawBody = item.content ?? item.comment ?? item.body ?? "";
      const body = cleanApiCommentContent(rawBody, documents);
      const createdAt =
        item.created_at ??
        item.processed_time ??
        item.allocated_time ??
        new Date().toISOString();
      const updateHistory = Array.isArray(item.update_history) ? item.update_history : [];
      const updatedAt = item.updated_at ?? undefined;

      return {
        id: String(item.id ?? item.comment_id ?? index),
        body,
        authorName: author,
        authorInitials: getInitials(author),
        createdAt,
        employeeId: item.employee_id ?? undefined,
        updatedAt,
        updateHistory,
        documents,
      };
    });
  })();

  ticketCommentsInFlightByTicketId.set(ticketId, request);

  request.finally(() => {
    const current = ticketCommentsInFlightByTicketId.get(ticketId);
    if (current === request) {
      ticketCommentsInFlightByTicketId.delete(ticketId);
    }
  });

  return request;
};

const isHighlightedHistoryAuthor = (authorName: string): boolean => {
  const normalizedAuthor = normalizeHistoryAuthor(authorName);
  return HISTORY_HIGHLIGHT_AUTHORS.some(
    (role) =>
      normalizedAuthor === role ||
      normalizedAuthor.startsWith(`${role} `) ||
      normalizedAuthor.includes(` ${role}`)
  );
};

const formatActivityDate = (timestamp: string) => {
  try {
    const originalDate = new Date(timestamp);
    if (Number.isNaN(originalDate.getTime())) {
      return timestamp;
    }

    // Add 5 hours 30 minutes to align with desired offset
    const offsetMinutes = 5 * 60 + 30;
    const shiftedDate = new Date(originalDate.getTime() + offsetMinutes * 60 * 1000);

    return shiftedDate.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return timestamp;
  }
};

const parseUpdateHistoryEntry = (jsonStr: string): UpdateHistoryEntry | null => {
  try {
    const parsed = JSON.parse(jsonStr) as UpdateHistoryEntry;
    return parsed?.old_content != null ? parsed : null;
  } catch {
    return null;
  }
};

const extractImageSources = (html: string): string[] => {
  if (!html) return [];
  if (typeof document === "undefined") return [];

  const container = document.createElement("div");
  container.innerHTML = html;
  const imgs = Array.from(container.getElementsByTagName("img"));

  const allSrcs = imgs
    .map((img) => img.getAttribute("src") || "")
    .filter((src) => !!src && src.trim() !== "");

  // Ensure uniqueness
  const uniqueSrcs = Array.from(new Set(allSrcs));

  // If we have any non-data URLs (e.g. already-uploaded files like "novex/...")
  // prefer those and drop data URLs to avoid sending duplicates.
  const nonDataSrcs = uniqueSrcs.filter((src) => !src.startsWith("data:"));

  return nonDataSrcs.length > 0 ? nonDataSrcs : uniqueSrcs;
};

/** Image srcs plus PDF/Excel attachment links (data URLs) for upload */
const extractAttachmentSources = (html: string): string[] => {
  const fromImages = extractImageSources(html);
  if (typeof document === "undefined") return fromImages;

  const container = document.createElement("div");
  container.innerHTML = html || "";
  const linkHrefs = Array.from(container.querySelectorAll("a[href]"))
    .map((a) => a.getAttribute("href") || "")
    .filter((href) => isSupportedNonImageDataUrl(href));

  const fileCardUrls = Array.from(
    container.querySelectorAll(".ql-comment-file-card[data-url]")
  )
    .map((el) => el.getAttribute("data-url") || "")
    .filter((href) => isSupportedNonImageDataUrl(href));

  const merged = [...fromImages, ...linkHrefs, ...fileCardUrls];
  return Array.from(new Set(merged));
};

/** Remove embedded attachments from HTML before sending comment text to the API */
const stripCommentAttachmentsForApi = (html: string): string => {
  if (!html) return "";
  if (typeof document === "undefined") {
    return html.replace(/<img[^>]*>/gi, "");
  }

  const container = document.createElement("div");
  container.innerHTML = html;
  Array.from(container.getElementsByTagName("img")).forEach((img) =>
    img.parentNode?.removeChild(img)
  );
  Array.from(container.querySelectorAll("a[href]")).forEach((a) => {
    const href = a.getAttribute("href") || "";
    if (!isSupportedNonImageDataUrl(href)) return;
    const label = (a.textContent || "").trim();
    const textNode = document.createTextNode(label ? `${label} ` : "");
    a.parentNode?.replaceChild(textNode, a);
  });
  Array.from(container.querySelectorAll(".ql-comment-file-card")).forEach((el) => {
    const label = (el.getAttribute("data-name") || "").trim();
    const textNode = document.createTextNode(label ? `${label} ` : "");
    el.parentNode?.replaceChild(textNode, el);
  });
  return container.innerHTML;
};

const resolveDocumentUrl = (path: string): string => {
  if (!path) return "";
  const trimmed = path.trim();
  if (!trimmed) return "";

  // Already absolute URL
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  const baseUrl = config.api?.baseUrl ?? "";

  if (baseUrl) {
    const normalizedBase = baseUrl.endsWith("/")
      ? baseUrl.slice(0, -1)
      : baseUrl;
    const normalizedPath = trimmed.startsWith("/")
      ? trimmed
      : `/${trimmed}`;
    return `${normalizedBase}${normalizedPath}`;
  }

  // Fallback: treat as app-relative path
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
};

const cleanApiCommentContent = (
  html: string,
  documents?: string[]
): string => {
  const source = html || "";
  if (!source) return "";

  const normalizeAttachmentName = (value: string): string => {
    const raw = value || "";
    let decoded = raw;
    try {
      decoded = decodeURIComponent(raw);
    } catch {
      decoded = raw;
    }
    return decoded.replace(/\+/g, " ").trim();
  };

  const attachmentNames = (documents || [])
    .map((src) => (src || "").split("?")[0].split("/").pop() || "")
    .map(normalizeAttachmentName)
    .filter(Boolean);

  // Fallback pattern for APIs that append filename text directly in content.
  const trailingAttachmentPattern =
    /(?:^|\s)([A-Za-z0-9._\- ()]+\.(?:pdf|xlsx|xls|csv|docx?|pptx?|txt|zip|rar))(?:\s|$)/gi;

  if (typeof document === "undefined") {
    let cleaned = source;
    attachmentNames.forEach((name) => {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      cleaned = cleaned.replace(new RegExp(escaped, "g"), "");
    });
    cleaned = cleaned.replace(trailingAttachmentPattern, " ");
    cleaned = cleaned.replace(/<p><br><\/p>\s*$/gi, "");
    return cleaned.trim();
  }

  const container = document.createElement("div");
  container.innerHTML = source;
  attachmentNames.forEach((name) => {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(escaped, "g");
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];
    let node = walker.nextNode();
    while (node) {
      textNodes.push(node as Text);
      node = walker.nextNode();
    }
    textNodes.forEach((textNode) => {
      textNode.nodeValue = (textNode.nodeValue || "").replace(pattern, "");
    });
  });

  // Remove remaining standalone filename artifacts from text nodes.
  {
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const textNode = node as Text;
      textNode.nodeValue = (textNode.nodeValue || "").replace(
        trailingAttachmentPattern,
        " "
      );
      node = walker.nextNode();
    }
  }

  Array.from(container.querySelectorAll("p")).forEach((p) => {
    if ((p.textContent || "").trim() === "" && p.querySelector("img") == null) {
      p.remove();
    }
  });

  return container.innerHTML.replace(/\s{2,}/g, " ").trim();
};

/**
 * Enhance plain update-history content so that bare image paths like
 * "novex/ticket_comments/....png" render as inline image previews.
 */
const enhanceOldContentWithImagePreviews = (oldContent: string): string => {
  if (!oldContent) return "";

  // If there are already <img> tags, keep as-is.
  if (/<img[^>]+src=/.test(oldContent)) {
    return oldContent;
  }

  const imagePathRegex =
    /((?:[A-Za-z0-9._-]+\/)+[A-Za-z0-9._-]+\.(?:png|jpe?g|gif|bmp|webp|svg))/gi;

  return oldContent.replace(imagePathRegex, (match) => {
    const trimmed = match.trim();
    const normalizedSrc =
      trimmed.startsWith("http://") ||
        trimmed.startsWith("https://") ||
        trimmed.startsWith("/")
        ? trimmed
        : `/${trimmed}`;
    return `<img src="${normalizedSrc}" alt="Attachment" />`;
  });
};

type ActivityTab = "COMMENTS" | "HISTORY";

export const TicketActivitySection: React.FC<TicketActivitySectionProps> = ({
  comment,
  setComment,
  ticketId,
  currentUserName = "Current User",
  formElementsDisabled = false,
  isEditMode = false,
  initialSavedComments = [],
  onSaveComment,
  ticketHistory = [],
  reAssigneeEmployeeIds = [],
}) => {
  const authUser = useAuthStore((state) => state.user);
  const currentEmployeeId = authUser?.employee_id ?? null;
  const normalizedAllowedCommentRoles = COMMENT_ALLOWED_ROLES.map((allowedRole) =>
    normalizeRoleName(allowedRole)
  );
  const normalizedUserRoles = Array.isArray(authUser?.novex_role)
    ? authUser.novex_role.map((role) => normalizeRoleName(String(role)))
    : [];
  const canAddComment = normalizedUserRoles.some(
    (role) =>
      normalizedAllowedCommentRoles.includes(role) ||
      hasInChargeSodCommentAccess(role)
  );
  const isEditReassigneeMatch =
    Boolean(isEditMode) &&
    Boolean(currentEmployeeId) &&
    reAssigneeEmployeeIds.some(
      (employeeId) => String(employeeId ?? "").trim() === String(currentEmployeeId ?? "").trim()
    );
  const canAccessComments = canAddComment || isEditReassigneeMatch;
  const hasHighlightedNovexRole = Array.isArray(authUser?.novex_role)
    ? authUser.novex_role
      .map((role) => normalizeRoleName(String(role)))
      .some((role) => HISTORY_HIGHLIGHT_AUTHORS.includes(role))
    : false;
  const [activeTab, setActiveTab] = useState<ActivityTab>("COMMENTS");
  const [historyComments, setHistoryComments] = useState<HistoryComment[]>(
    initialSavedComments.map((c) => ({ ...c, updateHistory: [], updatedAt: undefined }))
  );
  const [newComments, setNewComments] = useState<SavedComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>("");
  const [updatingCommentId, setUpdatingCommentId] = useState<string | null>(null);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [pendingDeleteCommentId, setPendingDeleteCommentId] = useState<string | null>(null);
  const [previewImageSrc, setPreviewImageSrc] = useState<string | null>(null);
  const [previewImageName, setPreviewImageName] = useState<string>("attachment");
  const [attachmentUrlByName, setAttachmentUrlByName] = useState<Record<string, string>>({});
  const fetchedCommentsTicketIdRef = useRef<string | null>(null);
  const commentsFetchInFlightTicketIdRef = useRef<string | null>(null);

  const enforceSingleAttachmentCommentHtml = useCallback((value: string) => {
    if (typeof window === "undefined") return value;
    const parser = new DOMParser();
    const doc = parser.parseFromString(value || "", "text/html");
    const body = doc.body;
    if (!body) return value;

    const iterator = doc.createTreeWalker(body, NodeFilter.SHOW_ELEMENT, {
      acceptNode(node) {
        const el = node as Element;
        if (el.tagName === "IMG" && (el.getAttribute("src") || "").trim()) {
          return NodeFilter.FILTER_ACCEPT;
        }
        if (el.tagName === "A") {
          const href = el.getAttribute("href") || "";
          if (isSupportedNonImageDataUrl(href)) return NodeFilter.FILTER_ACCEPT;
        }
        if (el.classList.contains("ql-comment-file-card")) {
          const href = el.getAttribute("data-url") || "";
          if (isSupportedNonImageDataUrl(href)) return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_SKIP;
      },
    });

    const attachmentEls: Element[] = [];
    let n: Node | null = iterator.nextNode();
    while (n) {
      attachmentEls.push(n as Element);
      n = iterator.nextNode();
    }

    if (attachmentEls.length <= MAX_COMMENT_ATTACHMENT_COUNT) return value;

    attachmentEls.slice(MAX_COMMENT_ATTACHMENT_COUNT).forEach((el) => el.remove());
    toast.error("Only one attachment is allowed per comment (image, PDF, Excel, or CSV).");
    return body.innerHTML;
  }, []);

  const commentQuillModules = useMemo(
    () => ({
      toolbar: {
        container: [
          ["bold", "italic", "underline", "strike"],
          [{ list: "ordered" }, { list: "bullet" }],
          ["image"],
        ],
        handlers: {
          image: function (this: { quill: any }) {
            const quill = this.quill;
            const ops = quill.getContents()?.ops ?? [];
            let imageCount = 0;
            let fileLinkCount = 0;
            let fileCardCount = 0;
            for (const op of ops) {
              if (op?.insert && typeof op.insert === "object" && (op.insert as { image?: string }).image) {
                imageCount += 1;
              }
              if (
                op?.insert &&
                typeof op.insert === "object" &&
                (op.insert as { commentFileCard?: unknown }).commentFileCard != null
              ) {
                fileCardCount += 1;
              }
              if (typeof op?.insert === "string" && op?.attributes?.link) {
                const link = String(op.attributes.link);
                if (isSupportedNonImageDataUrl(link)) fileLinkCount += 1;
              }
            }
            if (imageCount + fileLinkCount + fileCardCount >= MAX_COMMENT_ATTACHMENT_COUNT) {
              toast.error("Only one attachment is allowed per comment (image, PDF, Excel, or CSV).");
              return;
            }
            const input = document.createElement("input");
            input.setAttribute("type", "file");
            input.setAttribute("accept", COMMENT_FILE_INPUT_ACCEPT);
            input.click();
            input.onchange = () => {
              const file = input.files?.[0];
              if (!file) return;
              if (!isAllowedActivityUploadFile(file)) {
                toast.error("Only images, PDF, Excel, or CSV files are allowed.");
                return;
              }
              if (file.size > MAX_COMMENT_ATTACHMENT_UPLOAD_BYTES) {
                toast.error(`"${file.name}" exceeds the 5 MB maximum upload size.`);
                return;
              }
              const reader = new FileReader();
              reader.onload = () => {
                const dataUrl = reader.result as string;
                const range = quill.getSelection(true);
                const index = range ? range.index : quill.getLength();
                const mime = (file.type || "").toLowerCase();
                const treatAsImage =
                  mime.startsWith("image/") ||
                  (!mime && /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(file.name || ""));
                if (treatAsImage) {
                  quill.insertEmbed(index, "image", dataUrl);
                } else {
                  quill.insertEmbed(index, "commentFileCard", {
                    url: dataUrl,
                    name: file.name || "Attachment",
                    size: file.size,
                  });
                }
              };
              reader.readAsDataURL(file);
            };
          },
        },
      },
    }),
    []
  );

  const activitySectionRef = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const root = activitySectionRef.current;
    if (!root) return;

    const imageHintText = "(Max 5 MB: image, PDF, Excel, or CSV — one file)";
    const hintClass = "ticket-activity-ql-image-hint";

    const applyImageButtonHints = () => {
      root.querySelectorAll<HTMLButtonElement>(".ql-toolbar button.ql-image").forEach((btn) => {
        btn.removeAttribute("title");
        btn.setAttribute("aria-label", imageHintText);
        const next = btn.nextElementSibling;
        if (next?.classList.contains(hintClass)) {
          if (next.textContent !== imageHintText) next.textContent = imageHintText;
          return;
        }
        const hint = document.createElement("span");
        hint.className = `${hintClass} text-[10px] leading-none text-slate-500 dark:text-slate-400 ml-1 whitespace-nowrap shrink-0`;
        hint.textContent = imageHintText;
        btn.insertAdjacentElement("afterend", hint);
      });
    };

    applyImageButtonHints();
    const observer = new MutationObserver(applyImageButtonHints);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [activeTab, editingCommentId, canAccessComments]);

  useEffect(() => {
    return () => {
      // Cleanup any created object URLs to avoid memory leaks
      Object.values(attachmentUrlByName).forEach((url) => {
        if (url && url.startsWith("blob:")) URL.revokeObjectURL(url);
      });
    };
    // Intentionally run only on unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getAttachmentName = (src: string): string => {
    const trimmed = (src || "").trim();
    if (!trimmed) return "";
    const withoutQuery = trimmed.split("?")[0];
    const name = withoutQuery.split("/").pop() || "";
    return name;
  };

  const isImageFilename = (nameOrPath: string): boolean => {
    const base = (nameOrPath || "").split("?")[0];
    return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(base);
  };

  const getAttachmentTypeLabel = (nameOrPath: string): string => {
    const base = (nameOrPath || "").split("?")[0].toLowerCase();
    if (base.endsWith(".pdf")) return "PDF";
    if (base.endsWith(".xlsx")) return "XLSX";
    if (base.endsWith(".xls")) return "XLS";
    if (base.endsWith(".csv")) return "CSV";
    return (base.split(".").pop() || "FILE").toUpperCase();
  };

  const getAttachmentTypeBadgeClass = (label: string): string => {
    if (label === "PDF") return "bg-red-600 text-white";
    if (label === "XLSX" || label === "XLS") return "bg-emerald-600 text-white";
    return "bg-slate-500 text-white";
  };

  const ensureAttachmentObjectUrl = useCallback(
    async (
      fileAttachmentName: string,
      commentId?: string | null
    ): Promise<string | null> => {
      if (
        !fileAttachmentName ||
        commentId == null ||
        String(commentId).length === 0
      ) {
        return null;
      }
      const cacheKey = getAttachmentCacheKey(commentId, fileAttachmentName);
      if (attachmentUrlByName[cacheKey]) return attachmentUrlByName[cacheKey];

      try {
        const res = await apiClient.post(
          "/api/ticketcomment/download_attachment",
          {
            ticket_id: String(commentId),
            file_attachment_name: fileAttachmentName,
          },
          {
            responseType: "blob",
          }
        );

        const blob: Blob = res?.data;
        const objectUrl = URL.createObjectURL(blob);
        setAttachmentUrlByName((prev) => ({ ...prev, [cacheKey]: objectUrl }));
        return objectUrl;
      } catch (e: any) {
        console.error("Failed to download comment attachment:", e);
        toast.error(e?.response?.data?.message || "Failed to load attachment.");
        return null;
      }
    },
    [attachmentUrlByName]
  );

  const downloadAttachment = useCallback(
    async (fileAttachmentName: string, commentId?: string | null) => {
      if (!fileAttachmentName) return;
      const url = await ensureAttachmentObjectUrl(fileAttachmentName, commentId);
      if (!url) return;

      const a = document.createElement("a");
      a.href = url;
      a.download = fileAttachmentName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    },
    [ensureAttachmentObjectUrl]
  );

  const downloadImageAttachment = useCallback(
    async (
      fileAttachmentName: string,
      commentId?: string | null,
      directUrl?: string
    ) => {
      const url = (directUrl || "").trim();
      if (url) {
        const a = document.createElement("a");
        a.href = url;
        a.download = fileAttachmentName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return;
      }
      await downloadAttachment(fileAttachmentName, commentId);
    },
    [downloadAttachment]
  );

  const handleInlineAttachmentCardClick = useCallback(
    async (event: React.MouseEvent<HTMLElement>, commentId?: string) => {
      const target = event.target as HTMLElement | null;
      const card = target?.closest(".ql-comment-file-card") as HTMLElement | null;
      if (!card) return;

      event.preventDefault();
      event.stopPropagation();

      const fileName =
        card.getAttribute("data-name") ||
        card.getAttribute("data-filename") ||
        "Attachment";
      const dataUrl = card.getAttribute("data-url") || "";

      // Newly-added local comments keep data URL in HTML until persisted.
      if (dataUrl.startsWith("data:")) {
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return;
      }

      if (fileName && commentId) {
        await downloadAttachment(fileName, commentId);
      }
    },
    [downloadAttachment]
  );

  const downloadPreviewImage = useCallback(() => {
    if (!previewImageSrc) return;
    const a = document.createElement("a");
    a.href = previewImageSrc;
    a.download = previewImageName || "attachment";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [previewImageName, previewImageSrc]);

  const fetchComments = useCallback(async (options?: { force?: boolean }) => {
    if (!isEditMode || !ticketId) return;
    const force = options?.force === true;
    if (
      !force &&
      (fetchedCommentsTicketIdRef.current === ticketId ||
        commentsFetchInFlightTicketIdRef.current === ticketId)
    ) {
      return;
    }

    commentsFetchInFlightTicketIdRef.current = ticketId;
    setLoadingComments(true);
    try {
      const mapped = await fetchTicketCommentsWithDedup(ticketId, currentUserName);
      setHistoryComments(mapped);
      fetchedCommentsTicketIdRef.current = ticketId;
    } catch (error) {
      console.error("Failed to load ticket comments:", error);
    } finally {
      if (commentsFetchInFlightTicketIdRef.current === ticketId) {
        commentsFetchInFlightTicketIdRef.current = null;
      }
      setLoadingComments(false);
    }
  }, [isEditMode, ticketId, currentUserName]);

  // Load existing comments for this ticket from /api/ticketcomment
  useEffect(() => {
    void fetchComments();
  }, [fetchComments]);

  useEffect(() => {
    if (!canAccessComments && activeTab === "COMMENTS") {
      setActiveTab("HISTORY");
    }
  }, [canAccessComments, activeTab]);

  const handleSaveComment = async () => {
    if (!canAccessComments) {
      toast.error("You do not have permission to add comments.");
      return;
    }
    const trimmed = (comment || "").replace(/<[^>]*>/g, "").trim();
    if (!trimmed) return;

    if (isEditMode && !ticketId) {
      toast.error("Cannot add comment: missing ticket id.");
      return;
    }

    const commentForApi = stripCommentAttachmentsForApi(comment);
    let persistedCommentId: string | null = null;
    let persistedCreatedAt: string | null = null;

    if (isEditMode && ticketId) {
      try {
        const documents = extractAttachmentSources(comment);
        const response = await apiClient.post("/api/ticketcomment/add_comment_to_ticket", {
          ticket_id: ticketId,
          content: commentForApi,
          // Intentionally NOT sending `documents` in this payload
        });

        const apiComment = (response as any)?.data?.data ?? (response as any)?.data;
        if (apiComment) {
          if (apiComment.id != null || apiComment.comment_id != null) {
            persistedCommentId = String(apiComment.id ?? apiComment.comment_id);
          }
          if (apiComment.created_at) {
            persistedCreatedAt = String(apiComment.created_at);
          }

          // If there are any embedded images/documents, attach them explicitly to the new comment
          if (
            Array.isArray(documents) &&
            documents.length > 0 &&
            persistedCommentId &&
            ticketId
          ) {
            try {
              const formData = new FormData();
              // Add required IDs as form fields in the multipart body
              formData.append("ticket_id", ticketId);
              formData.append("comment_id", persistedCommentId);

              const src = documents[0];
              if (src) {
                try {
                  const response = await fetch(src);
                  const blob = await response.blob();
                  const mimeType = (blob.type || "application/octet-stream").toLowerCase();
                  let ext = "bin";
                  if (mimeType.includes("pdf")) ext = "pdf";
                  else if (mimeType.includes("spreadsheetml.sheet")) ext = "xlsx";
                  else if (mimeType.includes("ms-excel")) ext = "xls";
                  else if (mimeType.includes("text/csv") || mimeType.includes("application/csv")) ext = "csv";
                  else if (mimeType.startsWith("image/")) {
                    ext = mimeType.split("/")[1]?.split(";")[0] || "png";
                  }
                  const filename = `comment-attachment-${persistedCommentId}.${ext}`;
                  formData.append("upload_files", blob, filename);
                } catch (blobError) {
                  console.error("Failed to convert attachment src to Blob:", blobError);
                }
              }

              await apiClient.post("/api/ticketcomment/attach_file_to_comment", formData, {
              });
            } catch (attachError: any) {
              console.error("Failed to attach files to comment:", attachError);
              toast.error(
                attachError?.response?.data?.message ||
                "Comment saved but failed to upload attachments."
              );
            }
          }
        }
      } catch (error: any) {
        console.error("Failed to add comment to ticket:", error);
        toast.error(error?.response?.data?.message || "Failed to add comment to ticket.");
        return;
      }
    }

    const nowIso = new Date().toISOString();
    const newComment: SavedComment = {
      id: persistedCommentId ?? `comment-${Date.now()}`,
      body: comment,
      authorName: currentUserName,
      authorInitials: getInitials(currentUserName),
      createdAt: persistedCreatedAt ?? nowIso,
      employeeId: currentEmployeeId ?? undefined,
    };
    setNewComments((prev) => [newComment, ...prev]);
    setComment("");
    onSaveComment?.(newComment);
  };

  const handleUpdateComment = async (commentId: string, newBody: string) => {
    const trimmed = (newBody || "").replace(/<[^>]*>/g, "").trim();
    if (!trimmed) return;

    // If ticket is not yet saved (no ticketId or not in edit mode),
    // update only local comments without calling the API.
    if (!isEditMode || !ticketId) {
      setNewComments((prev) =>
        prev.map((c) => (c.id === commentId ? { ...c, body: trimmed } : c))
      );
      setEditingCommentId(null);
      setEditingValue("");
      return;
    }

    try {
      setUpdatingCommentId(commentId);
      const contentStripped = stripCommentAttachmentsForApi(newBody);
      const plainTextContent = (contentStripped || "").replace(/<[^>]*>/g, "").trim();
      await apiClient.post("/api/ticketcomment/edit_comment", {
        ticket_id: ticketId,
        content: plainTextContent,
        comment_id: commentId,
        // Intentionally NOT sending `documents` in this payload
      });

      setHistoryComments((prev) =>
        prev.map((c) => (c.id === commentId ? { ...c, body: plainTextContent } : c))
      );
      setNewComments((prev) =>
        prev.map((c) => (c.id === commentId ? { ...c, body: plainTextContent } : c))
      );
      setEditingCommentId(null);
      setEditingValue("");
      toast.success("Comment updated.");
    } catch (error: any) {
      console.error("Failed to update comment:", error);
      toast.error(error?.response?.data?.message || "Failed to update comment.");
    } finally {
      setUpdatingCommentId(null);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    // If ticket is not yet saved (no ticketId or not in edit mode),
    // remove only from local comments without calling the API.
    if (!isEditMode || !ticketId) {
      setNewComments((prev) => prev.filter((c) => c.id !== commentId));

      if (editingCommentId === commentId) {
        setEditingCommentId(null);
        setEditingValue("");
      }

      toast.success("Comment removed.");
      return;
    }

    try {
      setDeletingCommentId(commentId);
      await apiClient.post("/api/ticketcomment/delete_comment", {
        ticket_id: ticketId,
        comment_id: commentId,
      });

      // Remove from both history and local new comments to keep UI in sync
      setHistoryComments((prev) => prev.filter((c) => c.id !== commentId));
      setNewComments((prev) => prev.filter((c) => c.id !== commentId));

      if (editingCommentId === commentId) {
        setEditingCommentId(null);
        setEditingValue("");
      }

      toast.success("Comment deleted.");
    } catch (error: any) {
      console.error("Failed to delete comment:", error);
      toast.error(error?.response?.data?.message || "Failed to delete comment.");
    } finally {
      setDeletingCommentId(null);
    }
  };

  const openDeleteConfirm = (commentId: string) => {
    setPendingDeleteCommentId(commentId);
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteComment = async () => {
    if (!pendingDeleteCommentId) return;
    await handleDeleteComment(pendingDeleteCommentId);
    setDeleteConfirmOpen(false);
    setPendingDeleteCommentId(null);
  };

  const handleCancelComment = () => {
    setComment("");
  };

  const commentFeedItems = useMemo(
    () =>
      [...newComments]
        .slice()
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        .map((c) => ({
          id: c.id,
          type: "comment" as const,
          authorName: c.authorName,
          authorInitials: c.authorInitials,
          message: c.body,
          timestamp: c.createdAt,
          employeeId: c.employeeId,
        })),
    [newComments]
  );

  const historyFeedItems = useMemo(() => {
    type HistoryFeedItem = {
      id: string;
      type: "history";
      authorName: string;
      authorInitials: string;
      message: string;
      timestamp: string;
      employeeId?: string;
      updatedAt?: string;
      updateHistory?: string[];
      documents?: string[];
      source?: "comment" | "ticket";
      statusFrom?: string;
      statusTo?: string;
    };

    const getLastActivityTime = (c: HistoryComment): number => {
      let maxTime = new Date(c.createdAt).getTime();
      if (c.updatedAt) {
        const updated = new Date(c.updatedAt).getTime();
        if (!Number.isNaN(updated) && updated > maxTime) {
          maxTime = updated;
        }
      }
      if (Array.isArray(c.updateHistory) && c.updateHistory.length > 0) {
        c.updateHistory.forEach((jsonStr) => {
          const entry = parseUpdateHistoryEntry(jsonStr);
          if (entry?.updated_time) {
            const t = new Date(entry.updated_time).getTime();
            if (!Number.isNaN(t) && t > maxTime) {
              maxTime = t;
            }
          }
        });
      }
      return maxTime;
    };

    const items: (HistoryFeedItem & { _lastActivityTime: number })[] = [];

    // Existing comment-based history (from /api/ticketcomment)
    historyComments.forEach((c) => {
      items.push({
        id: c.id,
        type: "history",
        authorName: c.authorName,
        authorInitials: c.authorInitials,
        // Enhance body so bare image paths render as previews
        message: enhanceOldContentWithImagePreviews(c.body),
        timestamp: c.createdAt,
        employeeId: c.employeeId,
        updatedAt: c.updatedAt,
        updateHistory: c.updateHistory ?? [],
        documents: c.documents ?? [],
        source: "comment",
        _lastActivityTime: getLastActivityTime(c),
      });
    });

    // Ticket-level status history from comment_history (updated_by, ticket_msg, updated_time)
    if (Array.isArray(ticketHistory)) {
      ticketHistory
        // Only accept entries that look like comment_history, not ticket_history
        .filter((h) => h && h.ticket_msg && h.updated_time)
        .forEach((h, index) => {
          const author = h.updated_by || "System";
          const timestamp = String(h.updated_time || new Date().toISOString());
          const message = String(h.ticket_msg ?? "");

          let statusFrom: string | undefined;
          let statusTo: string | undefined;

          const parts = String(h.ticket_msg).split("->");
          if (parts.length === 2) {
            statusFrom = parts[0]?.trim() || undefined;
            statusTo = parts[1]?.trim() || undefined;
          } else if (parts.length === 1) {
            statusTo = parts[0]?.trim() || undefined;
          }

          items.push({
            id: `ticket-history-${index}-${timestamp}`,
            type: "history",
            authorName: author,
            authorInitials: getInitials(author),
            message,
            timestamp,
            employeeId: undefined,
            updatedAt: undefined,
            updateHistory: [],
            documents: [],
            source: "ticket",
            statusFrom,
            statusTo,
            _lastActivityTime: new Date(timestamp).getTime(),
          });
        });
    }

    // Sort by latest date first (descending)
    items.sort((a, b) => b._lastActivityTime - a._lastActivityTime);

    return items.map(({ _lastActivityTime, ...rest }) => rest);
  }, [historyComments, ticketHistory]);

  // Prefetch image attachments for history so thumbnails render
  useEffect(() => {
    if (!isEditMode || !ticketId) return;
    const jobs: { name: string; commentId?: string }[] = [];
    historyFeedItems.forEach((item) => {
      if (!item.documents?.length || item.source === "ticket") return;
      const sc = item.id;
      item.documents.forEach((src) => {
        const filename = getAttachmentName(src || "");
        if (filename && isImageFilename(filename)) {
          jobs.push({ name: filename, commentId: sc });
        }
      });
    });

    void Promise.all(
      jobs
        .filter(
          ({ name, commentId }) =>
            !attachmentUrlByName[getAttachmentCacheKey(commentId, name)]
        )
        .map(({ name, commentId }) => ensureAttachmentObjectUrl(name, commentId))
    );
  }, [
    historyFeedItems,
    isEditMode,
    ticketId,
    attachmentUrlByName,
    ensureAttachmentObjectUrl,
  ]);

  const latestCommentsWithHistory = useMemo(
    () => {
      const allItems = [
        ...commentFeedItems,
        ...historyFeedItems,
      ];

      const sorted = allItems
        .slice()
        .sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );

      // De-duplicate same persisted comment shown from local + fetched sources.
      const unique: typeof sorted = [];
      const seen = new Set<string>();
      sorted.forEach((item) => {
        const itemSource = "source" in item ? item.source : "comment";
        const key = `${item.id}::${itemSource ?? "comment"}`;
        if (seen.has(key)) return;
        seen.add(key);
        unique.push(item);
      });
      return unique;
    },
    [commentFeedItems, historyFeedItems]
  );

  const tabs: { id: ActivityTab; label: string; icon: React.ReactNode }[] = canAccessComments
    ? [
      { id: "COMMENTS", label: "COMMENTS", icon: <MessageCircle className="h-3.5 w-3.5" /> },
      { id: "HISTORY", label: "HISTORY", icon: <Clock className="h-3.5 w-3.5" /> },
    ]
    : [{ id: "HISTORY", label: "HISTORY", icon: <Clock className="h-3.5 w-3.5" /> }];

  const renderFeedItem = (
    item: {
      id: string;
      type: "history" | "comment";
      authorName: string;
      authorInitials: string;
      message: string;
      timestamp: string;
      employeeId?: string;
      updatedAt?: string;
      updateHistory?: string[];
      documents?: string[];
      source?: "comment" | "ticket";
      statusFrom?: string;
      statusTo?: string;
    },
    showClockIcon?: boolean,
    allowActions: boolean = false,
    allowDelete: boolean = true
  ) => {
    const attachmentCommentId =
      item.documents && item.documents.length > 0 && item.source !== "ticket"
        ? item.id
        : undefined;
    const normalizedAuthorName = normalizeHistoryAuthor(item.authorName);
    const normalizedCurrentEmployeeId = normalizeHistoryAuthor(currentEmployeeId ?? "");
    const isCurrentUserHistoryEntry =
      !!currentEmployeeId &&
      (item.employeeId === currentEmployeeId ||
        normalizedAuthorName === normalizedCurrentEmployeeId);
    const canEditOrDelete =
      allowActions &&
      item.type === "comment" &&
      !!item.employeeId &&
      !!currentEmployeeId &&
      item.employeeId === currentEmployeeId;
    const isEditing = canEditOrDelete && item.id === editingCommentId;
    const enableHistoryStyling = activeTab === "HISTORY" || activeTab === "COMMENTS";
    const highlightHistoryEntry =
      enableHistoryStyling &&
      item.type === "history" &&
      (isHighlightedHistoryAuthor(item.authorName) ||
        (hasHighlightedNovexRole && isCurrentUserHistoryEntry));
    const isHistoryItem = item.type === "history";
    const isCommentItem = item.type === "comment";
    const isOutgoingHistory = (isHistoryItem || isCommentItem) && (highlightHistoryEntry || isCurrentUserHistoryEntry);
    const useHistoryChatLayout =
      (isHistoryItem || isCommentItem) &&
      (activeTab === "HISTORY" || activeTab === "COMMENTS");
    const reverseHistoryRow = false;

    if (useHistoryChatLayout) {
      return (
        <div key={item.id} className={`py-2 ${isOutgoingHistory ? "flex justify-end" : "flex justify-start"}`}>
          <div className={`max-w-[88%] ${isOutgoingHistory ? "items-end" : "items-start"} flex flex-col gap-1`}>
            <div className={`flex items-end gap-2 ${reverseHistoryRow ? "flex-row-reverse" : "flex-row"}`}>
              {(
                <div className="relative flex-shrink-0">
                  <div
                    className={`h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-semibold ${highlightHistoryEntry
                        ? "bg-emerald-600 dark:bg-emerald-500"
                        : "bg-emerald-500"
                      }`}
                  >
                    {item.authorInitials}
                  </div>
                  {/* {showClockIcon && (
                    <div className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-emerald-400 flex items-center justify-center">
                      <Clock className="h-2 w-2 text-white" />
                    </div>
                  )} */}
                </div>
              )}

              <div
                className={`rounded-2xl px-4 py-3 shadow-sm ${isOutgoingHistory
                    ? "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                    : "bg-blue-500/50 text-slate-900"
                  }`}
              >
                <p
                  className={`text-xs font-semibold mb-1 ${isOutgoingHistory ? "text-slate-600 dark:text-slate-300" : "text-slate-900"
                    }`}
                >
                  {item.authorName}
                </p>

                {item.source === "ticket" && (item.statusFrom || item.statusTo) ? (
                  <>
                    <p className="text-sm">
                      <span>Changed the </span>
                      <span className="font-semibold">Status</span>
                    </p>
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      {item.statusFrom && (
                        <span className="inline-flex items-center rounded-full border border-slate-300 dark:border-slate-600 bg-white/80 dark:bg-slate-900 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:text-slate-200">
                          {item.statusFrom}
                        </span>
                      )}
                      {item.statusFrom && item.statusTo && (
                        <span className={`text-xs ${isOutgoingHistory ? "text-slate-500" : "text-slate-900"}`}>
                          →
                        </span>
                      )}
                      {item.statusTo && (
                        <span className="inline-flex items-center rounded-full border border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/40 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:text-blue-200">
                          {item.statusTo}
                        </span>
                      )}
                    </div>
                  </>
                ) : (() => {
                  const imageDocs =
                    item.documents?.filter((src) =>
                      isImageFilename(getAttachmentName(src || "") || src || "")
                    ) ?? [];
                  const fileDocs =
                    item.documents?.filter(
                      (src) =>
                        !isImageFilename(getAttachmentName(src || "") || src || "")
                    ) ?? [];

                  const messageImgClass =
                    "text-sm font-normal [&_img]:max-w-full [&_img]:w-full [&_img]:h-auto [&_img]:max-h-[min(28rem,85vh)] [&_img]:object-contain [&_img]:rounded-md [&_img]:block";

                  return (
                    <>
                      {imageDocs.length > 0 && (
                        <div className="mb-2 space-y-2 w-full min-w-0">
                          {imageDocs.map((src, idx) => {
                            const filename =
                              getAttachmentName(src || "") || `Attachment ${idx + 1}`;
                            const cacheKey = getAttachmentCacheKey(
                              attachmentCommentId,
                              filename
                            );
                            const objectUrl = attachmentUrlByName[cacheKey] || "";
                            return (
                              <div
                                key={`img-doc-${idx}`}
                                className="relative group rounded-lg overflow-hidden border border-slate-200/80 dark:border-slate-600 bg-white/60 dark:bg-slate-900/60"
                              >
                                <div className="flex items-center justify-between px-2 py-1 border-b border-slate-200/70 dark:border-slate-700">
                                  {/* <span className="text-[11px] text-slate-600 dark:text-slate-300 truncate">
                                    {filename}
                                  </span> */}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      void downloadImageAttachment(
                                        filename,
                                        attachmentCommentId,
                                        objectUrl
                                      );
                                    }}
                                    className="ml-auto inline-flex items-center justify-center h-7 w-7 rounded-full text-slate-700 hover:text-slate-900 hover:bg-slate-200/70 dark:text-slate-200 dark:hover:text-white dark:hover:bg-slate-700/70"
                                    title="Download attachment"
                                  >
                                    <Download className="h-4 w-4" />
                                  </button>
                                </div>
                                <button
                                  type="button"
                                  className="w-full block"
                                  onClick={async () => {
                                    const url = await ensureAttachmentObjectUrl(
                                      filename,
                                      attachmentCommentId
                                    );
                                    if (url) {
                                      setPreviewImageSrc(url);
                                      setPreviewImageName(filename);
                                    }
                                  }}
                                  title="Preview attachment"
                                >
                                  {objectUrl ? (
                                    <img
                                      src={objectUrl}
                                      alt={filename}
                                      className="w-full max-h-[min(28rem,85vh)] h-auto object-contain"
                                    />
                                  ) : (
                                    <div className="h-32 w-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                      <span className="text-[11px] text-slate-500">Loading...</span>
                                    </div>
                                  )}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      <div
                        className={messageImgClass}
                        onClick={(e) => {
                          void handleInlineAttachmentCardClick(e, attachmentCommentId);
                        }}
                        dangerouslySetInnerHTML={{ __html: item.message }}
                      />
                      {fileDocs.length > 0 && (
                        <div className="mt-2 space-y-2">
                          {fileDocs.map((src, idx) => {
                            const filename =
                              getAttachmentName(src || "") || `Attachment ${idx + 1}`;
                            const typeLabel = getAttachmentTypeLabel(filename);
                            return (
                              <button
                                key={`file-doc-${idx}`}
                                type="button"
                                onClick={async () => {
                                  await downloadAttachment(filename, attachmentCommentId);
                                }}
                                className="w-full max-w-[340px] rounded-xl border border-emerald-200 dark:border-emerald-700/40 bg-emerald-100 dark:bg-emerald-900/30 px-3 py-2 text-left flex items-center gap-3 hover:opacity-95 transition-opacity"
                                title="Download attachment"
                              >
                                <div className={`h-10 w-10 rounded-md text-[11px] font-bold flex items-center justify-center ${getAttachmentTypeBadgeClass(typeLabel)}`}>
                                  {typeLabel}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                                    {filename}
                                  </p>
                                  <p className="text-xs text-slate-500 dark:text-slate-400">
                                    {typeLabel}
                                  </p>
                                </div>
                                <span className="h-8 w-8 rounded-full bg-black/10 dark:bg-white/10 flex items-center justify-center">
                                  <Download className="h-4 w-4 text-slate-700 dark:text-slate-200" />
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>

            <span className="text-xs text-slate-500 dark:text-slate-400 px-1">
              {formatActivityDate(
                (() => {
                  let latest = new Date(item.timestamp).getTime();
                  if (item.updatedAt) {
                    const updated = new Date(item.updatedAt).getTime();
                    if (!Number.isNaN(updated) && updated > latest) {
                      latest = updated;
                    }
                  }
                  return new Date(latest).toISOString();
                })()
              )}
            </span>
          </div>
        </div>
      );
    }

    return (
      <div
        key={item.id}
        className="flex gap-3 py-3 border-b border-slate-200 dark:border-slate-700 last:border-b-0"
      >
        <div className={`flex gap-3 flex-1 min-w-0 ${highlightHistoryEntry ? "ml-40" : ""}`}>
          <div className="relative flex-shrink-0">
            <div
              className={`h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-semibold ${highlightHistoryEntry
                  ? "bg-emerald-600 dark:bg-emerald-500"
                  : "bg-emerald-500"
                }`}
            >
              {item.authorInitials}
            </div>
            {showClockIcon && (
              <div className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-emerald-400 flex items-center justify-center">
                <Clock className="h-2 w-2 text-white" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p
              className={`text-sm font-semibold ${highlightHistoryEntry
                  ? "text-amber-700 dark:text-amber-300"
                  : "text-slate-800 dark:text-slate-200"
                }`}
            >
              {item.authorName}
            </p>
            {item.type === "history" && item.source === "ticket" ? (
              item.statusFrom || item.statusTo ? (
                <>
                  <p
                    className={`text-sm mt-0.5 ${highlightHistoryEntry
                        ? "text-amber-800 dark:text-amber-200"
                        : "text-slate-800 dark:text-slate-200"
                      }`}
                  >
                    <span>Changed the</span>{" "}
                    <span className="font-semibold">
                      Status
                    </span>
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    {item.statusFrom && (
                      <span className="inline-flex items-center rounded-full border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:text-slate-200">
                        {item.statusFrom}
                      </span>
                    )}
                    {item.statusFrom && item.statusTo && (
                      <span className="text-xs text-slate-500">→</span>
                    )}
                    {item.statusTo && (
                      <span className="inline-flex items-center rounded-full border border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/40 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:text-blue-200">
                        {item.statusTo}
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <p
                  className={`text-sm mt-0.5 ${highlightHistoryEntry
                      ? "text-amber-800 dark:text-amber-200"
                      : "text-slate-800 dark:text-slate-200"
                    }`}
                >
                  <span
                    className="font-normal [&_img]:max-w-full [&_img]:w-full [&_img]:h-auto [&_img]:max-h-[min(28rem,85vh)] [&_img]:object-contain [&_img]:rounded-md [&_img]:block"
                    onClick={(e) => {
                      void handleInlineAttachmentCardClick(e, attachmentCommentId);
                    }}
                    dangerouslySetInnerHTML={{ __html: item.message }}
                  />
                </p>
              )
            ) : item.type === "history" ? (
              <p
                className={`text-sm mt-0.5 ${highlightHistoryEntry
                    ? "text-amber-800 dark:text-amber-200"
                    : "text-slate-800 dark:text-slate-200"
                  }`}
              > 
                <span
                  className="font-normal [&_img]:max-w-full [&_img]:w-full [&_img]:h-auto [&_img]:max-h-[min(28rem,85vh)] [&_img]:object-contain [&_img]:rounded-md [&_img]:block"
                  onClick={(e) => {
                    void handleInlineAttachmentCardClick(e, attachmentCommentId);
                  }}
                  dangerouslySetInnerHTML={{ __html: item.message }}
                />
              </p>
            ) : isEditing ? (
              <div className="mt-2 space-y-2">
                <span className="block text-xs font-normal text-slate-500 dark:text-slate-500">
                  (max 5 MB: image, PDF, Excel, or CSV — one file)
                </span>
                <ReactQuill
                  theme="snow"
                  value={editingValue}
                  onChange={(value) => {
                    setEditingValue(enforceSingleAttachmentCommentHtml(value));
                  }}
                  formats={[...COMMENT_QUILL_FORMATS]}
                  className="[&_.ql-container]:rounded-b-lg [&_.ql-toolbar]:rounded-t-lg [&_.ql-editor]:min-h-[60px] text-sm bg-slate-50 dark:bg-slate-800 [&_.ql-toolbar]:bg-white dark:[&_.ql-toolbar]:bg-slate-800 [&_.ql-toolbar]:border-slate-200 dark:[&_.ql-toolbar]:border-slate-700 [&_.ql-editor]:bg-transparent [&_.ql-editor img]:max-w-full [&_.ql-editor img]:w-full [&_.ql-editor img]:h-auto [&_.ql-editor img]:max-h-[min(20rem,70vh)] [&_.ql-editor img]:object-contain [&_.ql-editor img]:block [&_.ql-editor_.ql-comment-file-card]:max-w-full"
                  modules={commentQuillModules}
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={
                      updatingCommentId === item.id ||
                      !(editingValue || "").replace(/<[^>]*>/g, "").trim()
                    }
                    onClick={() => {
                      void handleUpdateComment(item.id, editingValue);
                    }}
                  >
                    {updatingCommentId === item.id ? "Updating..." : "Update"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditingCommentId(null);
                      setEditingValue("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {(() => {
                  const imageDocs =
                    item.documents?.filter((src) =>
                      isImageFilename(getAttachmentName(src || "") || src || "")
                    ) ?? [];
                  const fileDocs =
                    item.documents?.filter(
                      (src) =>
                        !isImageFilename(getAttachmentName(src || "") || src || "")
                    ) ?? [];
                  return (
                    <>
                      {imageDocs.length > 0 && (
                        <div className="mt-2 space-y-2 w-full min-w-0">
                          {imageDocs.map((src, idx) => {
                            const filename =
                              getAttachmentName(src || "") || `Attachment ${idx + 1}`;
                            const cacheKey = getAttachmentCacheKey(
                              attachmentCommentId,
                              filename
                            );
                            const objectUrl = attachmentUrlByName[cacheKey] || "";
                            return (
                              <div
                                key={`list-img-${idx}`}
                                className="relative group rounded-lg overflow-hidden border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900"
                              >
                                <div className="flex items-center justify-between px-2 py-1 border-b border-slate-200/70 dark:border-slate-700">
                                  <span className="text-[11px] text-slate-600 dark:text-slate-300 truncate">
                                    {filename}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      void downloadImageAttachment(
                                        filename,
                                        attachmentCommentId,
                                        objectUrl
                                      );
                                    }}
                                    className="ml-auto inline-flex items-center justify-center h-7 w-7 rounded-full text-slate-700 hover:text-slate-900 hover:bg-slate-200/70 dark:text-slate-200 dark:hover:text-white dark:hover:bg-slate-700/70"
                                    title="Download attachment"
                                  >
                                    <Download className="h-4 w-4" />
                                  </button>
                                </div>
                                <button
                                  type="button"
                                  className="w-full block"
                                  onClick={async () => {
                                    const url = await ensureAttachmentObjectUrl(
                                      filename,
                                      attachmentCommentId
                                    );
                                    if (url) {
                                      setPreviewImageSrc(url);
                                      setPreviewImageName(filename);
                                    }
                                  }}
                                  title="Preview attachment"
                                >
                                  {objectUrl ? (
                                    <img
                                      src={objectUrl}
                                      alt={filename}
                                      className="w-full max-h-[min(28rem,85vh)] h-auto object-contain"
                                    />
                                  ) : (
                                    <div className="h-32 w-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                      <span className="text-[11px] text-slate-500">Loading…</span>
                                    </div>
                                  )}
                                </button>
                                <div className="absolute top-1 right-1 flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      void downloadImageAttachment(
                                        filename,
                                        attachmentCommentId,
                                        objectUrl
                                      );
                                    }}
                                    className="bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-blue-600"
                                    title="Download attachment"
                                  >
                                    <Download className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      <p className="text-sm text-slate-800 dark:text-slate-200 mt-0.5">
                        <span
                          className="font-normal [&_img]:max-w-full [&_img]:w-full [&_img]:h-auto [&_img]:max-h-[min(28rem,85vh)] [&_img]:object-contain [&_img]:rounded-md [&_img]:block"
                          onClick={(e) => {
                            void handleInlineAttachmentCardClick(e, attachmentCommentId);
                          }}
                          dangerouslySetInnerHTML={{ __html: item.message }}
                        />
                      </p>
                      {fileDocs.length > 0 && (
                        <div className="mt-2 space-y-2">
                          {fileDocs.map((src, idx) => {
                            const filename =
                              getAttachmentName(src || "") || `Attachment ${idx + 1}`;
                            const typeLabel = getAttachmentTypeLabel(filename);
                            return (
                              <button
                                key={`list-file-${idx}`}
                                type="button"
                                onClick={async () => {
                                  await downloadAttachment(filename, attachmentCommentId);
                                }}
                                className="w-full max-w-[340px] rounded-xl border border-emerald-200 dark:border-emerald-700/40 bg-emerald-100 dark:bg-emerald-900/30 px-3 py-2 text-left flex items-center gap-3 hover:opacity-95 transition-opacity"
                                title="Download attachment"
                              >
                                <div className={`h-10 w-10 rounded-md text-[11px] font-bold flex items-center justify-center ${getAttachmentTypeBadgeClass(typeLabel)}`}>
                                  {typeLabel}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                                    {filename}
                                  </p>
                                  <p className="text-xs text-slate-500 dark:text-slate-400">
                                    {typeLabel}
                                  </p>
                                </div>
                                <span className="h-8 w-8 rounded-full bg-black/10 dark:bg-white/10 flex items-center justify-center">
                                  <Download className="h-4 w-4 text-slate-700 dark:text-slate-200" />
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </>
                  );
                })()}
              </>
            )}
            {canEditOrDelete && !isEditing && (
              <div className="mt-1 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  onClick={() => {
                    setEditingCommentId(item.id);
                    setEditingValue(item.message);
                  }}
                >
                  {/* <Pencil className="h-3.5 w-3.5" /> */}
                  <span>Edit</span>
                </button>
                {/* {allowDelete && (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-slate-400 hover:text-red-600 dark:hover:text-red-400"
                  disabled={deletingCommentId === item.id}
                  onClick={() => {
                    openDeleteConfirm(item.id);
                  }}
                >
                  {/* <Trash2 className="h-3.5 w-3.5" /> */}
                {/* <span>Delete</span>
                </button>
              )} */}
              </div>
            )}
            {item.updateHistory && item.updateHistory.length > 0 && (
              <div className="mt-3 space-y-2">
                {item.updateHistory
                  .map((jsonStr) => parseUpdateHistoryEntry(jsonStr))
                  .filter((entry): entry is UpdateHistoryEntry => !!entry)
                  .sort((a, b) => {
                    const aTime = new Date(a.updated_time).getTime();
                    const bTime = new Date(b.updated_time).getTime();
                    return bTime - aTime;
                  })
                  .map((entry, idx) => {
                    const oldHtml = enhanceOldContentWithImagePreviews(
                      entry.old_content || ""
                    );
                    return (
                      <div key={idx} className="text-sm">
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 flex w-full items-center justify-between gap-2">
                          <span className="flex-1 inline-flex items-baseline gap-1 min-w-0">
                            <span className="font-semibold whitespace-nowrap">Edited</span>
                            <span className="text-slate-600 truncate">
                              <span
                                className="font-normal [&_img]:max-w-full [&_img]:w-full [&_img]:h-auto [&_img]:max-h-[min(28rem,85vh)] [&_img]:object-contain [&_img]:rounded-md [&_img]:block"
                                dangerouslySetInnerHTML={{ __html: oldHtml }}
                              />
                            </span>
                          </span>
                          <span className="whitespace-nowrap">
                            {formatActivityDate(item.timestamp)}
                          </span>
                        </p>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
        <div className="flex-shrink-0 flex items-start text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
          <span>
            {formatActivityDate(
              (() => {
                let latest = new Date(item.timestamp).getTime();
                if (item.updatedAt) {
                  const updated = new Date(item.updatedAt).getTime();
                  if (!Number.isNaN(updated) && updated > latest) {
                    latest = updated;
                  }
                }
                if (item.updateHistory && item.updateHistory.length > 0) {
                  item.updateHistory.forEach((jsonStr) => {
                    const entry = parseUpdateHistoryEntry(jsonStr);
                    if (entry?.updated_time) {
                      const t = new Date(entry.updated_time).getTime();
                      if (!Number.isNaN(t) && t > latest) {
                        latest = t;
                      }
                    }
                  });
                }
                return new Date(latest).toISOString();
              })()
            )}
          </span>
        </div>
      </div>
    );
  };

  return (
    <section ref={activitySectionRef} data-section="activity">
      <div className="p-3 sm:p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Activity
          </h3>

          {/* Show: ALL | WORKLOG | COMMENTS | HISTORY */}
          <div className="flex flex-wrap items-center gap-2">
            {/* <span className="text-xs text-slate-500 dark:text-slate-400">Show:</span> */}
            <div className="flex flex-wrap gap-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id);
                    if (tab.id === "HISTORY") {
                      void fetchComments({ force: true });
                    }
                  }}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border text-xs font-medium transition-colors ${activeTab === tab.id
                      ? "bg-slate-100 dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-200"
                      : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700"
                    }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        {/* <div className="px-0 py-0 text-[10px] flex justify-end">
          <div className="flex items-center gap-5 whitespace-nowrap overflow-x-auto">
          <p className="flex items-center gap-2 text-slate-700 dark:text-slate-200 shrink-0">
            <span className="inline-block h-2 w-2 rounded-full bg-violet-600 dark:bg-violet-500" />
            <span>commented by assingned user</span>
          </p>
          <p className="flex items-center gap-2 text-slate-700 dark:text-slate-200 shrink-0">
            <span className="inline-block h-2 w-2 rounded-full bg-slate-400 dark:bg-slate-500" />
            <span>commented by OCC users</span>
          </p>
          </div>
        </div> */}

        {/* COMMENTS tab: show Add a comment field + last 2 comments + history section */}
        {activeTab === "COMMENTS" && canAccessComments && (
          <div className="space-y-3 pt-2">
            <div className={formElementsDisabled && !isEditMode ? "opacity-60 pointer-events-none" : ""}>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                Add a comment
                {/* <span className="block font-normal text-slate-500 dark:text-slate-500 mt-0.5">
                  (max 5 MB: image, PDF, Excel, or CSV — one file)
                </span> */}
              </label>
              <ReactQuill
                theme="snow"
                value={comment}
                onChange={(value) => {
                  setComment(enforceSingleAttachmentCommentHtml(value));
                }}
                placeholder="Write a comment..."
                formats={[...COMMENT_QUILL_FORMATS]}
                className="[&_.ql-container]:rounded-b-lg [&_.ql-toolbar]:rounded-t-lg [&_.ql-editor]:min-h-[80px] text-sm bg-slate-50 dark:bg-slate-800 [&_.ql-toolbar]:bg-white dark:[&_.ql-toolbar]:bg-slate-800 [&_.ql-toolbar]:border-slate-200 dark:[&_.ql-toolbar]:border-slate-700 [&_.ql-editor]:bg-transparent [&_.ql-editor img]:max-w-full [&_.ql-editor img]:w-full [&_.ql-editor img]:h-auto [&_.ql-editor img]:max-h-[min(20rem,70vh)] [&_.ql-editor img]:object-contain [&_.ql-editor img]:block [&_.ql-editor_.ql-comment-file-card]:max-w-full"
                modules={commentQuillModules}
              />
              <div className="flex gap-2 mt-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={(formElementsDisabled && !isEditMode) || !(comment || "").replace(/<[^>]*>/g, "").trim()}
                  onClick={handleSaveComment}
                >
                  Save
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={formElementsDisabled && !isEditMode}
                  onClick={handleCancelComment}
                >
                  Cancel
                </Button>
              </div>
            </div>

            {/* Latest 2 comments - shown in COMMENTS tab */}
            <div className="border-t border-slate-200 dark:border-slate-700 pt-3">
              {loadingComments && historyFeedItems.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 py-4">
                  Loading comments...
                </p>
              ) : latestCommentsWithHistory.length === 0 ? null : (
                <div className="space-y-0">
                  {latestCommentsWithHistory.slice(0, 3).map((item) =>
                    renderFeedItem(item, true, false, false)
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* HISTORY tab: show existing comments loaded from API */}
        {activeTab === "HISTORY" && (
          <div className="space-y-3 pt-2">
            <div className="border-t border-slate-200 dark:border-slate-700 pt-3">
              {loadingComments && historyFeedItems.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 py-4">
                  Loading comments...
                </p>
              ) : historyFeedItems.length > 0 ? (
                <div className="space-y-0 max-h-[540px] overflow-y-auto pr-1">
                  {historyFeedItems.map((item) => renderFeedItem(item, true, false, false))}
                </div>
              ) : null}
            </div>
          </div>
        )}

      </div>

      {/* Preview popup for history/comment attachments */}
      <AlertDialog
        open={!!previewImageSrc}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewImageSrc(null);
            setPreviewImageName("attachment");
          }
        }}
      >
        <AlertDialogContent className="sm:max-w-xl">
          <AlertDialogHeader>
            <div className="flex items-center justify-between gap-2">
              <AlertDialogTitle>Attachment preview</AlertDialogTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!previewImageSrc}
                onClick={downloadPreviewImage}
                className="inline-flex items-center gap-1"
              >
                <Download className="h-4 w-4" />
                {/* <span>Download</span> */}
              </Button>
            </div>
            <AlertDialogDescription>
              Click close to return to the activity timeline.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {previewImageSrc && (
            <div className="mt-2 flex items-center justify-center">
              <img
                src={previewImageSrc}
                alt="Attachment preview"
                className="max-h-[70vh] w-full object-contain rounded border border-slate-200 bg-slate-50 cursor-pointer"
                onClick={downloadPreviewImage}
                title="Click to download"
              />
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => {
                setPreviewImageSrc(null);
                setPreviewImageName("attachment");
              }}
            >
              Close
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={deleteConfirmOpen}
        onOpenChange={(open) => {
          setDeleteConfirmOpen(open);
          if (!open) {
            setPendingDeleteCommentId(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete comment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure to you want to delete this item? This action can not be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setDeleteConfirmOpen(false);
                setPendingDeleteCommentId(null);
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                void confirmDeleteComment();
              }}
              disabled={
                !pendingDeleteCommentId ||
                (pendingDeleteCommentId != null && deletingCommentId === pendingDeleteCommentId)
              }
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </section>
  );
};
