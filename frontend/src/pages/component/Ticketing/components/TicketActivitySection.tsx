import React, { useState, useMemo, useEffect } from "react";
import ReactQuill from "react-quill-new";
import "quill/dist/quill.snow.css";
import { Settings, MessageCircle, Clock, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/@/components/ui/button";
import { apiClient } from "@/services/apiClient";
import { toast } from "sonner";

export interface SavedComment {
  id: string;
  body: string;
  authorName: string;
  authorInitials: string;
  createdAt: string;
}

export interface UpdateHistoryEntry {
  old_content: string;
  updated_by: string;
  updated_time: string;
}

export interface HistoryComment extends SavedComment {
  updatedAt?: string;
  updateHistory?: string[];
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
}

const getInitials = (name: string): string => {
  if (!name || !name.trim()) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

const formatActivityDate = (timestamp: string) => {
  try {
    const d = new Date(timestamp);
    return d.toLocaleDateString("en-US", {
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
  return imgs
    .map((img) => img.getAttribute("src") || "")
    .filter((src) => !!src && src.trim() !== "");
};

const stripImages = (html: string): string => {
  if (!html) return "";
  if (typeof document === "undefined") {
    return html.replace(/<img[^>]*>/gi, "");
  }

  const container = document.createElement("div");
  container.innerHTML = html;
  const imgs = Array.from(container.getElementsByTagName("img"));
  imgs.forEach((img) => img.parentNode?.removeChild(img));
  return container.innerHTML;
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
}) => {
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

  // Load existing comments for this ticket from /api/ticketcomment
  useEffect(() => {
    if (!isEditMode || !ticketId) return;

    let cancelled = false;

    const fetchComments = async () => {
      setLoadingComments(true);
      try {
        const response = await apiClient.get("/api/ticketcomment", {
          params: { ticket_id: ticketId },
        });

        const raw =
          Array.isArray(response.data)
            ? response.data
            : Array.isArray(response.data?.data)
            ? response.data.data
            : [];

        if (!cancelled) {
          const mapped: HistoryComment[] = raw.map((item: any, index: number) => {
            const author =
              item.created_by ??
              item.employee_id ??
              item.authorName ??
              currentUserName;

            const body = item.content ?? item.comment ?? item.body ?? "";
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
              updatedAt,
              updateHistory,
            };
          });
          setHistoryComments(mapped);
        }
      } catch (error) {
        console.error("Failed to load ticket comments:", error);
      } finally {
        if (!cancelled) {
          setLoadingComments(false);
        }
      }
    };

    fetchComments();

    return () => {
      cancelled = true;
    };
  }, [isEditMode, ticketId, currentUserName]);

  const handleSaveComment = async () => {
    const trimmed = (comment || "").replace(/<[^>]*>/g, "").trim();
    if (!trimmed) return;

    if (isEditMode && !ticketId) {
      toast.error("Cannot add comment: missing ticket id.");
      return;
    }

    if (isEditMode && ticketId) {
      try {
        const documents = extractImageSources(comment);
        const contentWithoutImages = stripImages(comment);
        await apiClient.post("/api/ticketcomment/add_comment_to_ticket", {
          ticket_id: ticketId,
          content: contentWithoutImages,
          documents,
        });
      } catch (error: any) {
        console.error("Failed to add comment to ticket:", error);
        toast.error(error?.response?.data?.message || "Failed to add comment to ticket.");
        return;
      }
    }

    const newComment: SavedComment = {
      id: `comment-${Date.now()}`,
      body: comment,
      authorName: currentUserName,
      authorInitials: getInitials(currentUserName),
      createdAt: new Date().toISOString(),
    };
    setNewComments((prev) => [newComment, ...prev]);
    setComment("");
    onSaveComment?.(newComment);
  };

  const handleUpdateComment = async (commentId: string, newBody: string) => {
    const trimmed = (newBody || "").replace(/<[^>]*>/g, "").trim();
    if (!trimmed) return;
    if (!ticketId) {
      toast.error("Cannot update comment: missing ticket id.");
      return;
    }

    try {
      setUpdatingCommentId(commentId);
      const documents = extractImageSources(newBody);
      const contentWithoutImages = stripImages(newBody);
      await apiClient.post("/api/ticketcomment/edit_comment", {
        ticket_id: ticketId,
        content: contentWithoutImages,
        comment_id: commentId,
        documents,
      });

      setHistoryComments((prev) =>
        prev.map((c) => (c.id === commentId ? { ...c, body: newBody } : c))
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
    if (!ticketId) {
      toast.error("Cannot delete comment: missing ticket id.");
      return;
    }

    try {
      setDeletingCommentId(commentId);
      await apiClient.post("/api/ticketcomment/delete_comment", {
        ticket_id: ticketId,
        comment_id: commentId,
      });

      setHistoryComments((prev) => prev.filter((c) => c.id !== commentId));

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

  const handleCancelComment = () => {
    setComment("");
  };

  const commentFeedItems = useMemo(
    () =>
      newComments.map((c) => ({
        id: c.id,
        type: "comment" as const,
        authorName: c.authorName,
        authorInitials: c.authorInitials,
        message: c.body,
        timestamp: c.createdAt,
      })),
    [newComments]
  );

  const historyFeedItems = useMemo(
    () =>
      historyComments.map((c) => ({
        id: c.id,
        type: "comment" as const,
        authorName: c.authorName,
        authorInitials: c.authorInitials,
        message: c.body,
        timestamp: c.createdAt,
        updatedAt: (c as HistoryComment).updatedAt,
        updateHistory: (c as HistoryComment).updateHistory ?? [],
      })),
    [historyComments]
  );

  const tabs: { id: ActivityTab; label: string; icon: React.ReactNode }[] = [
    { id: "COMMENTS", label: "COMMENTS", icon: <MessageCircle className="h-3.5 w-3.5" /> },
    { id: "HISTORY", label: "HISTORY", icon: <Clock className="h-3.5 w-3.5" /> },
  ];

  const renderFeedItem = (
    item: {
      id: string;
      type: "history" | "comment";
      authorName: string;
      authorInitials: string;
      message: string;
      timestamp: string;
      updatedAt?: string;
      updateHistory?: string[];
    },
    showClockIcon?: boolean,
    allowActions: boolean = false,
    allowDelete: boolean = true
  ) => {
    const isEditing =
      allowActions && item.type === "comment" && item.id === editingCommentId;

    return (
      <div
        key={item.id}
        className="flex gap-3 py-3 border-b border-slate-200 dark:border-slate-700 last:border-b-0"
      >
        <div className="relative flex-shrink-0">
          <div className="h-8 w-8 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs font-semibold">
            {item.authorInitials}
          </div>
          {showClockIcon && (
            <div className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-emerald-400 flex items-center justify-center">
              <Clock className="h-2 w-2 text-white" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-800 dark:text-slate-200">
            <span className="font-semibold inline-flex items-center gap-1">
              {item.authorName}
              {allowActions && item.type === "comment" && !isEditing && (
                <span className="inline-flex items-center gap-1 ml-1">
                  <button
                    type="button"
                    className="inline-flex items-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                    onClick={() => {
                      setEditingCommentId(item.id);
                      setEditingValue(item.message);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  {allowDelete && (
                    <button
                      type="button"
                      className="inline-flex items-center text-slate-400 hover:text-red-600 dark:hover:text-red-400"
                      disabled={deletingCommentId === item.id}
                      onClick={() => {
                        void handleDeleteComment(item.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </span>
              )}
            </span>
            {item.type === "history" ? (
              <> {item.message}</>
            ) : isEditing ? (
              <div className="mt-2 space-y-2">
                <ReactQuill
                  theme="snow"
                  value={editingValue}
                  onChange={setEditingValue}
                  className="[&_.ql-container]:rounded-b-lg [&_.ql-toolbar]:rounded-t-lg [&_.ql-editor]:min-h-[60px] text-sm bg-slate-50 dark:bg-slate-800 [&_.ql-toolbar]:bg-white dark:[&_.ql-toolbar]:bg-slate-800 [&_.ql-toolbar]:border-slate-200 dark:[&_.ql-toolbar]:border-slate-700 [&_.ql-editor]:bg-transparent"
                  modules={{
                    toolbar: [
                      ["bold", "italic", "underline", "strike"],
                      [{ list: "ordered" }, { list: "bullet" }],
                      ["link", "image"],
                      ["clean"],
                    ],
                  }}
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
                {" "}
                <span
                  className="font-normal"
                  dangerouslySetInnerHTML={{ __html: item.message }}
                />
              </>
            )}
          </p>
          {item.updateHistory && item.updateHistory.length > 0 && (
            <div className="mt-3 space-y-2">
              {item.updateHistory.map((jsonStr, idx) => {
                const entry = parseUpdateHistoryEntry(jsonStr);
                if (!entry) return null;
                return (
                  <div key={idx} className="text-sm">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      Edited
                    </p>
                    <p className="text-slate-600 dark:text-slate-300 mt-0.5">
                      <span
                        className="font-normal"
                        dangerouslySetInnerHTML={{ __html: entry.old_content }}
                      />
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {formatActivityDate(entry.updated_time)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex-shrink-0 flex items-start text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
          <span>{formatActivityDate(item.timestamp)}</span>
        </div>
      </div>
    );
  };

  return (
    <section data-section="activity">
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
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border text-xs font-medium transition-colors ${
                    activeTab === tab.id
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

        {/* COMMENTS tab: show Add a comment field + newly created comments */}
        {activeTab === "COMMENTS" && (
          <div className="space-y-3 pt-2">
            <div className={formElementsDisabled ? "opacity-60 pointer-events-none" : ""}>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                Add a comment
              </label>
              <ReactQuill
                theme="snow"
                value={comment}
                onChange={setComment}
                placeholder="Write a comment..."
                className="[&_.ql-container]:rounded-b-lg [&_.ql-toolbar]:rounded-t-lg [&_.ql-editor]:min-h-[80px] text-sm bg-slate-50 dark:bg-slate-800 [&_.ql-toolbar]:bg-white dark:[&_.ql-toolbar]:bg-slate-800 [&_.ql-toolbar]:border-slate-200 dark:[&_.ql-toolbar]:border-slate-700 [&_.ql-editor]:bg-transparent"
                modules={{
                  toolbar: [
                    ["bold", "italic", "underline", "strike"],
                    [{ list: "ordered" }, { list: "bullet" }],
                    ["link", "image"],
                    ["clean"],
                  ],
                }}
              />
              <div className="flex gap-2 mt-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={formElementsDisabled || !(comment || "").replace(/<[^>]*>/g, "").trim()}
                  onClick={handleSaveComment}
                >
                  Save
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={formElementsDisabled}
                  onClick={handleCancelComment}
                >
                  Cancel
                </Button>
              </div>
            </div>
            <div className="border-t border-slate-200 dark:border-slate-700 pt-3">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
                Comments
              </p>
              {commentFeedItems.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 py-4">
                  No comments yet.
                </p>
              ) : (
                <div className="space-y-0">
                  {commentFeedItems.map((item) => renderFeedItem(item, false, false))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* HISTORY tab: show existing comments loaded from API */}
        {activeTab === "HISTORY" && (
          <div className="space-y-3 pt-2">
            <div className="border-t border-slate-200 dark:border-slate-700 pt-3">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
                History
              </p>
              {loadingComments && historyFeedItems.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 py-4">
                  Loading comments...
                </p>
              ) : historyFeedItems.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 py-4">
                  No comments yet.
                </p>
              ) : (
                <div className="space-y-0">
                  {historyFeedItems.map((item) => renderFeedItem(item, true, true, false))}
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </section>
  );
};
