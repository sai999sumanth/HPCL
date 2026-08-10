
import React, { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/@/components/ui/dialog";
import { Card, CardContent } from "@/@/components/ui/card";
import { Label } from "@/@/components/ui/label";
import { Input } from "@/@/components/ui/input";
import {
  Camera,
  Undo,
  Redo,
  Type,
  Pen,
  Square,
  Circle,
  ArrowRight,
  Download,
  Command,
  Upload,
  Clipboard,
  X,
  Paperclip,
  Move
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/@/components/ui/select";
import { Separator } from "@/@/components/ui/separator";
import { toast } from "sonner";

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

interface TicketScreenshotUploadProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
  existingFiles?: File[];
  buttonText?: string;
  buttonClassName?: string;
}

type CaptureMode = "full" | "selection" | "paste";
type EditTool = "pen" | "text" | "rectangle" | "circle" | "arrow" | "select";

interface DrawingAction {
  id: string;
  tool: EditTool;
  color: string;
  size: number;
  points?: { x: number; y: number }[];
  text?: string;
  startX?: number;
  startY?: number;
  endX?: number;
  endY?: number;
}

interface TextInput {
  x: number;
  y: number;
  text: string;
  show: boolean;
}

interface DragState {
  isDragging: boolean;
  actionId: string | null;
  offsetX: number;
  offsetY: number;
}

export default function TicketScreenshotUpload({
  onFilesSelected,
  disabled = false,
  existingFiles = [],
  buttonText = "Upload Document",
  buttonClassName = "h-8 text-xs w-full"
}: TicketScreenshotUploadProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<"capture" | "edit">("capture");
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const [isWaitingForPaste, setIsWaitingForPaste] = useState(false);

  // Editing state
  const [currentTool, setCurrentTool] = useState<EditTool>("pen");
  const [currentColor, setCurrentColor] = useState("#ff0000");
  const [currentSize, setCurrentSize] = useState(3);
  const [actions, setActions] = useState<DrawingAction[]>([]);
  const [redoStack, setRedoStack] = useState<DrawingAction[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentAction, setCurrentAction] = useState<DrawingAction | null>(null);
  const [textInput, setTextInput] = useState<TextInput>({ x: 0, y: 0, text: "", show: false });
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    actionId: null,
    offsetX: 0,
    offsetY: 0,
  });

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Canvas dimensions
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 0, height: 0 });
  const [scale, setScale] = useState(1);

  const isMac = typeof navigator !== "undefined" && navigator.userAgent.indexOf("Mac") !== -1;

  const resetComponent = () => {
    setStep("capture");
    setScreenshot(null);
    setActions([]);
    setRedoStack([]);
    setShowInstructions(false);
    setIsWaitingForPaste(false);
    setTextInput({ x: 0, y: 0, text: "", show: false });
    setCurrentAction(null);
    setIsDrawing(false);
    setSelectedActionId(null);
    setDragState({ isDragging: false, actionId: null, offsetX: 0, offsetY: 0 });
  };

  const handleNativeScreenshot = () => {
    setShowInstructions(true);
    setIsWaitingForPaste(true);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      // If only one file is selected and it's an image, use the editor
      if (files.length === 1 && files[0].type.startsWith("image/")) {
        const file = files[0];
        if (file.size > MAX_ATTACHMENT_BYTES) {
          toast.error(`"${file.name}" exceeds the 5 MB maximum upload size.`);
          event.target.value = "";
          return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
          setScreenshot(e.target?.result as string);
          setStep("edit");
          setShowInstructions(false);
          setIsWaitingForPaste(false);
        };
        reader.readAsDataURL(file);
      } else {
        // Multiple files or non-image files - pass all files directly
        const fileArray = Array.from(files);
        const oversized = fileArray.filter((f) => f.size > MAX_ATTACHMENT_BYTES);
        oversized.forEach((f) =>
          toast.error(`"${f.name}" exceeds the 5 MB maximum upload size.`)
        );
        const allowed = fileArray.filter((f) => f.size <= MAX_ATTACHMENT_BYTES);
        if (allowed.length === 0) {
          event.target.value = "";
          return;
        }
        onFilesSelected(allowed);
        setIsOpen(false);
        resetComponent();
      }
    }
  };

  const handlePaste = useCallback(
    async (e: ClipboardEvent) => {
      if (!isWaitingForPaste) return;

      e.preventDefault();
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf("image") !== -1) {
          const blob = item.getAsFile();
          if (blob) {
            if (blob.size > MAX_ATTACHMENT_BYTES) {
              toast.error("Pasted image exceeds the 5 MB maximum upload size.");
              setIsWaitingForPaste(false);
              setShowInstructions(false);
              break;
            }
            const reader = new FileReader();
            reader.onload = (event) => {
              setScreenshot(event.target?.result as string);
              setStep("edit");
              setShowInstructions(false);
              setIsWaitingForPaste(false);
            };
            reader.readAsDataURL(blob);
          }
          break;
        }
      }
    },
    [isWaitingForPaste]
  );

  useEffect(() => {
    if (isWaitingForPaste) {
      document.addEventListener("paste", handlePaste);
      return () => document.removeEventListener("paste", handlePaste);
    }
  }, [isWaitingForPaste, handlePaste]);

  useEffect(() => {
    if (screenshot && step === "edit" && canvasRef.current && overlayCanvasRef.current) {
      const canvas = canvasRef.current;
      const overlayCanvas = overlayCanvasRef.current;
      const ctx = canvas.getContext("2d");
      const img = new Image();

      img.onload = () => {
        const container = containerRef.current;
        if (!container) return;

        const maxWidth = Math.min(800, container.clientWidth - 40);
        const maxHeight = Math.min(500, window.innerHeight * 0.5);

        const imgAspect = img.width / img.height;
        const containerAspect = maxWidth / maxHeight;

        let displayWidth, displayHeight;

        if (imgAspect > containerAspect) {
          displayWidth = maxWidth;
          displayHeight = maxWidth / imgAspect;
        } else {
          displayHeight = maxHeight;
          displayWidth = maxHeight * imgAspect;
        }

        canvas.width = img.width;
        canvas.height = img.height;
        canvas.style.width = `${displayWidth}px`;
        canvas.style.height = `${displayHeight}px`;

        overlayCanvas.width = img.width;
        overlayCanvas.height = img.height;
        overlayCanvas.style.width = `${displayWidth}px`;
        overlayCanvas.style.height = `${displayHeight}px`;

        setCanvasDimensions({ width: img.width, height: img.height });
        setScale(img.width / displayWidth);

        ctx?.drawImage(img, 0, 0);
        redrawCanvas();
      };

      img.src = screenshot;
    }
  }, [screenshot, step]);

  // Redraw when selection changes
  useEffect(() => {
    if (step === "edit" && screenshot) {
      redrawCanvas();
    }
  }, [selectedActionId]);

  const redrawCanvas = () => {
    if (!canvasRef.current || !overlayCanvasRef.current) return;

    const canvas = canvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    const ctx = canvas.getContext("2d");
    const overlayCtx = overlayCanvas.getContext("2d");

    if (!ctx || !overlayCtx || !screenshot) return;

    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      actions.forEach((action) => {
        drawAction(overlayCtx, action);

        // Draw selection indicator for selected text
        if (action.id === selectedActionId && action.tool === "text") {
          const bbox = getTextBoundingBox(action);
          if (bbox) {
            overlayCtx.strokeStyle = "#0066ff";
            overlayCtx.lineWidth = 2;
            overlayCtx.setLineDash([5, 3]);
            overlayCtx.strokeRect(bbox.x - 4, bbox.y - 4, bbox.width + 8, bbox.height + 8);
            overlayCtx.setLineDash([]);
          }
        }
      });
    };
    img.src = screenshot;
  };

  const drawAction = (ctx: CanvasRenderingContext2D, action: DrawingAction) => {
    ctx.strokeStyle = action.color;
    ctx.fillStyle = action.color;
    ctx.lineWidth = action.size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    switch (action.tool) {
      case "pen":
        if (action.points && action.points.length > 1) {
          ctx.beginPath();
          ctx.moveTo(action.points[0].x, action.points[0].y);
          action.points.forEach((point) => {
            ctx.lineTo(point.x, point.y);
          });
          ctx.stroke();
        }
        break;

      case "rectangle":
        if (
          action.startX !== undefined &&
          action.startY !== undefined &&
          action.endX !== undefined &&
          action.endY !== undefined
        ) {
          const width = action.endX - action.startX;
          const height = action.endY - action.startY;
          ctx.strokeRect(action.startX, action.startY, width, height);
        }
        break;

      case "circle":
        if (
          action.startX !== undefined &&
          action.startY !== undefined &&
          action.endX !== undefined &&
          action.endY !== undefined
        ) {
          const radius = Math.sqrt(
            Math.pow(action.endX - action.startX, 2) + Math.pow(action.endY - action.startY, 2)
          );
          ctx.beginPath();
          ctx.arc(action.startX, action.startY, radius, 0, 2 * Math.PI);
          ctx.stroke();
        }
        break;

      case "arrow":
        if (
          action.startX !== undefined &&
          action.startY !== undefined &&
          action.endX !== undefined &&
          action.endY !== undefined
        ) {
          drawArrow(ctx, action.startX, action.startY, action.endX, action.endY, action.size);
        }
        break;

      case "text":
        if (action.text && action.startX !== undefined && action.startY !== undefined) {
          ctx.font = `bold ${action.size * 6}px Arial`;
          ctx.fillText(action.text, action.startX, action.startY);
        }
        break;
    }
  };

  const drawArrow = (
    ctx: CanvasRenderingContext2D,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    lineWidth: number
  ) => {
    const headLength = Math.max(15, lineWidth * 3);
    const angle = Math.atan2(endY - startY, endX - startX);

    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(
      endX - headLength * Math.cos(angle - Math.PI / 6),
      endY - headLength * Math.sin(angle - Math.PI / 6)
    );
    ctx.moveTo(endX, endY);
    ctx.lineTo(
      endX - headLength * Math.cos(angle + Math.PI / 6),
      endY - headLength * Math.sin(angle + Math.PI / 6)
    );
    ctx.stroke();
  };

  const getCanvasPosition = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!overlayCanvasRef.current) return { x: 0, y: 0 };

    const canvas = overlayCanvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * scale;
    const y = (e.clientY - rect.top) * scale;

    return { x, y };
  };

  // Get text bounding box for hit detection
  const getTextBoundingBox = (action: DrawingAction) => {
    if (action.tool !== "text" || !action.text || action.startX === undefined || action.startY === undefined) {
      return null;
    }

    const fontSize = action.size * 6;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.font = `bold ${fontSize}px Arial`;
    const metrics = ctx.measureText(action.text);
    const textWidth = metrics.width;
    const textHeight = fontSize;

    return {
      x: action.startX,
      y: action.startY - textHeight + fontSize * 0.2, // Adjust for baseline
      width: textWidth,
      height: textHeight,
    };
  };

  // Check if a point is inside a text element
  const findTextAtPosition = (x: number, y: number): DrawingAction | null => {
    // Check in reverse order (top elements first)
    for (let i = actions.length - 1; i >= 0; i--) {
      const action = actions[i];
      if (action.tool === "text") {
        const bbox = getTextBoundingBox(action);
        if (bbox && x >= bbox.x && x <= bbox.x + bbox.width && y >= bbox.y && y <= bbox.y + bbox.height) {
          return action;
        }
      }
    }
    return null;
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (textInput.show) return;

    const { x, y } = getCanvasPosition(e);

    // Check if clicking on existing text - allow dragging regardless of tool
    const clickedText = findTextAtPosition(x, y);
    if (clickedText) {
      // If clicking on existing text, select it for dragging
      setSelectedActionId(clickedText.id);
      setDragState({
        isDragging: true,
        actionId: clickedText.id,
        offsetX: x - (clickedText.startX || 0),
        offsetY: y - (clickedText.startY || 0),
      });
      return;
    }

    // If select tool is active and not clicking on text, just deselect
    if (currentTool === "select") {
      setSelectedActionId(null);
      return;
    }

    setIsDrawing(true);
    setRedoStack([]);

    if (currentTool === "text") {
      setTextInput({ x, y, text: "", show: true });
      setIsDrawing(false);
      setTimeout(() => textInputRef.current?.focus(), 100);
      return;
    }

    const action: DrawingAction = {
      id: Date.now().toString(),
      tool: currentTool,
      color: currentColor,
      size: currentSize,
      startX: x,
      startY: y,
      points: currentTool === "pen" ? [{ x, y }] : undefined,
    };

    setCurrentAction(action);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getCanvasPosition(e);

    // Handle dragging text
    if (dragState.isDragging && dragState.actionId) {
      const newX = x - dragState.offsetX;
      const newY = y - dragState.offsetY;

      setActions((prev) =>
        prev.map((action) =>
          action.id === dragState.actionId
            ? { ...action, startX: newX, startY: newY }
            : action
        )
      );

      // Redraw canvas with updated positions
      if (overlayCanvasRef.current) {
        const overlayCtx = overlayCanvasRef.current.getContext("2d");
        if (overlayCtx) {
          overlayCtx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
          actions.forEach((action) => {
            if (action.id === dragState.actionId) {
              drawAction(overlayCtx, { ...action, startX: newX, startY: newY });
            } else {
              drawAction(overlayCtx, action);
            }
          });
          // Draw selection indicator
          const selectedAction = actions.find((a) => a.id === dragState.actionId);
          if (selectedAction) {
            const bbox = getTextBoundingBox({ ...selectedAction, startX: newX, startY: newY });
            if (bbox) {
              overlayCtx.strokeStyle = "#0066ff";
              overlayCtx.lineWidth = 2;
              overlayCtx.setLineDash([5, 3]);
              overlayCtx.strokeRect(bbox.x - 4, bbox.y - 4, bbox.width + 8, bbox.height + 8);
              overlayCtx.setLineDash([]);
            }
          }
        }
      }
      return;
    }

    if (!isDrawing || !currentAction || !overlayCanvasRef.current) return;

    let updatedAction: DrawingAction;

    if (currentTool === "pen") {
      updatedAction = {
        ...currentAction,
        points: [...(currentAction.points || []), { x, y }],
      };
    } else {
      updatedAction = {
        ...currentAction,
        endX: x,
        endY: y,
      };
    }

    setCurrentAction(updatedAction);

    const overlayCtx = overlayCanvasRef.current.getContext("2d");
    if (overlayCtx) {
      overlayCtx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);

      actions.forEach((action) => {
        drawAction(overlayCtx, action);
      });

      drawAction(overlayCtx, updatedAction);
    }
  };

  const handleMouseUp = () => {
    // End drag operation
    if (dragState.isDragging) {
      setDragState({ isDragging: false, actionId: null, offsetX: 0, offsetY: 0 });
      setTimeout(redrawCanvas, 0);
      return;
    }

    if (!isDrawing || !currentAction) return;

    setActions((prev) => [...prev, currentAction]);
    setCurrentAction(null);
    setIsDrawing(false);
  };

  const handleTextSubmit = () => {
    if (textInput.text.trim()) {
      const action: DrawingAction = {
        id: Date.now().toString(),
        tool: "text",
        color: currentColor,
        size: currentSize,
        text: textInput.text,
        startX: textInput.x,
        startY: textInput.y,
      };
      setActions((prev) => [...prev, action]);

      // Immediately draw the text on the overlay canvas
      if (overlayCanvasRef.current) {
        const overlayCtx = overlayCanvasRef.current.getContext("2d");
        if (overlayCtx) {
          drawAction(overlayCtx, action);
        }
      }
    }
    setTextInput({ x: 0, y: 0, text: "", show: false });
  };

  const handleTextCancel = () => {
    setTextInput({ x: 0, y: 0, text: "", show: false });
  };

  const undo = () => {
    if (actions.length > 0) {
      const lastAction = actions[actions.length - 1];
      setRedoStack((prev) => [...prev, lastAction]);
      setActions((prev) => prev.slice(0, -1));
      setTimeout(redrawCanvas, 0);
    }
  };

  const redo = () => {
    if (redoStack.length > 0) {
      const actionToRedo = redoStack[redoStack.length - 1];
      setActions((prev) => [...prev, actionToRedo]);
      setRedoStack((prev) => prev.slice(0, -1));
      setTimeout(redrawCanvas, 0);
    }
  };

  const getFinalImage = (): string => {
    if (!canvasRef.current || !overlayCanvasRef.current) return "";

    const finalCanvas = document.createElement("canvas");
    const finalCtx = finalCanvas.getContext("2d");

    if (!finalCtx) return "";

    finalCanvas.width = canvasRef.current.width;
    finalCanvas.height = canvasRef.current.height;

    // Draw the base image first
    finalCtx.drawImage(canvasRef.current, 0, 0);

    // Draw the overlay canvas (for shapes like pen, rectangle, circle, arrow)
    finalCtx.drawImage(overlayCanvasRef.current, 0, 0);

    // Also redraw all actions directly on the final canvas to ensure text is included
    // This fixes the issue where text might not be rendered on the overlay canvas yet
    actions.forEach((action) => {
      drawAction(finalCtx, action);
    });

    return finalCanvas.toDataURL("image/jpeg", 0.9);
  };

  const handleConfirm = async () => {
    const finalImageUrl = getFinalImage();

    // Convert to blob and then to File
    const response = await fetch(finalImageUrl);
    const blob = await response.blob();
    if (blob.size > MAX_ATTACHMENT_BYTES) {
      toast.error("Edited image exceeds the 5 MB maximum upload size. Reduce image size or detail and try again.");
      return;
    }
    const file = new File([blob], `screenshot-${Date.now()}.jpg`, { type: "image/jpeg" });

    // Call parent callback with the file
    onFilesSelected([file]);

    // Close dialog and reset
    setIsOpen(false);
    resetComponent();
  };

  const downloadImage = () => {
    const finalImageUrl = getFinalImage();
    const link = document.createElement("a");
    link.download = `screenshot-${Date.now()}.jpg`;
    link.href = finalImageUrl;
    link.click();
  };

  const colors = ["#ff0000", "#00ff00", "#0000ff", "#ffff00", "#ff00ff", "#00ffff", "#ffffff", "#000000"];

  const handleOpenDialog = () => {
    setIsOpen(true);
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) resetComponent();
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          type="button"
          disabled={disabled}
          className={buttonClassName}
          onClick={handleOpenDialog}
        >
          <Upload className="w-4 h-4 mr-2" />
          {buttonText}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto z-[999999999] left-[54%] translate-x-[-50%]">
        <DialogHeader>
          <DialogTitle>
            {step === "capture" && "Capture Screenshot"}
            {step === "edit" && "Edit Screenshot"}
          </DialogTitle>
        </DialogHeader>

        {/* Hidden file input - always rendered so it's available from any screen */}
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*,.pdf,.xlsx,.xls,.csv,text/csv,application/csv,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,.doc,.docx,.txt"
          onChange={handleFileUpload}
          className="hidden"
          multiple={true}
        />

        {step === "capture" && !showInstructions && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={handleNativeScreenshot}
              >
                <CardContent className="p-6 text-center">
                  <div className="flex items-center justify-center mb-2">
                    <Camera className="w-6 h-6 mr-2" />
                    {isMac && <Command className="w-4 h-4 mr-1" />}
                  </div>
                  <h3 className="font-semibold">Screenshot</h3>
                  <p className="text-sm text-muted-foreground">
                    {isMac ? "Cmd+Shift+3 or Cmd+Shift+4" : "Use system screenshot options"}
                  </p>
                </CardContent>
              </Card>

              <Card
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <CardContent className="p-6 text-center">
                  <Upload className="w-6 h-6 mx-auto mb-2" />
                  <h3 className="font-semibold">Upload File</h3>
                  <p className="text-sm text-muted-foreground">Image, PDF, Excel, CSV</p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {showInstructions && (
          <div className="space-y-6 text-center">
            <div
              className="border-2 border-dashed border-gray-300 dark:border-gray-600 p-8 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              onClick={() => navigator.clipboard && navigator.clipboard.read()}
              tabIndex={0}
            >
              <Clipboard className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="text-lg font-medium mb-2">Paste Your Screenshot Here</p>
              <p className="text-sm text-muted-foreground">
                After taking the screenshot, click here and paste with Ctrl+V (or Cmd+V on Mac)
              </p>
            </div>

            <div className="flex justify-center gap-4">
              <Button variant="outline" onClick={() => setShowInstructions(false)}>
                Back
              </Button>
              <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                <Upload className="w-4 h-4 mr-2" />
                Upload Instead
              </Button>
            </div>
          </div>
        )}

        {step === "edit" && screenshot && (
          <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <div className="flex items-center gap-1">
                <Button
                  variant={currentTool === "select" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentTool("select")}
                  className="h-10 w-10 p-0"
                  type="button"
                  title="Move Text"
                >
                  <Move className="w-4 h-4" />
                </Button>
                <Button
                  variant={currentTool === "pen" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentTool("pen")}
                  className="h-10 w-10 p-0"
                  type="button"
                >
                  <Pen className="w-4 h-4" />
                </Button>
                <Button
                  variant={currentTool === "text" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentTool("text")}
                  className="h-10 w-10 p-0"
                  type="button"
                >
                  <Type className="w-4 h-4" />
                </Button>
                <Button
                  variant={currentTool === "rectangle" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentTool("rectangle")}
                  className="h-10 w-10 p-0"
                  type="button"
                >
                  <Square className="w-4 h-4" />
                </Button>
                <Button
                  variant={currentTool === "circle" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentTool("circle")}
                  className="h-10 w-10 p-0"
                  type="button"
                >
                  <Circle className="w-4 h-4" />
                </Button>
                <Button
                  variant={currentTool === "arrow" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentTool("arrow")}
                  className="h-10 w-10 p-0"
                  type="button"
                >
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>

              <Separator orientation="vertical" className="h-8" />

              <div className="flex items-center gap-2">
                <Label className="text-sm whitespace-nowrap">Size:</Label>
                <select
                  value={currentSize}
                  onChange={(e) => setCurrentSize(Number(e.target.value))}
                  className="w-16 h-10 px-2 py-1 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {Array.from({ length: 20 }, (_, i) => i + 1).map((size) => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1">
                {colors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`w-8 h-8 rounded-full border-2 ${currentColor === color
                        ? "border-gray-800 dark:border-gray-200 ring-2 ring-gray-400"
                        : "border-gray-300 dark:border-gray-600"
                      } transition-all`}
                    style={{ backgroundColor: color }}
                    onClick={() => setCurrentColor(color)}
                  />
                ))}
              </div>

              <Separator orientation="vertical" className="h-8" />

              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" onClick={undo} disabled={actions.length === 0} type="button">
                  <Undo className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={redo} disabled={redoStack.length === 0} type="button">
                  <Redo className="w-4 h-4" />
                </Button>
              </div>

              <Button variant="outline" size="sm" onClick={downloadImage} type="button">
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
            </div>

            {/* Canvas Container */}
            <div
              ref={containerRef}
              className="w-full flex justify-center items-center p-4 bg-gray-50 dark:bg-gray-900 rounded-lg"
            >
              <div className="relative inline-block">
                <canvas
                  ref={canvasRef}
                  className="absolute top-0 left-0 border border-gray-200 dark:border-gray-700 rounded"
                  width={400}
                  height={300}
                />
                <canvas
                  ref={overlayCanvasRef}
                  className={`relative border border-gray-200 dark:border-gray-700 rounded ${currentTool === "select" ? "cursor-move" : "cursor-crosshair"
                    }`}
                  width={400}
                  height={300}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={() => {
                    setIsDrawing(false);
                    if (dragState.isDragging) {
                      setDragState({ isDragging: false, actionId: null, offsetX: 0, offsetY: 0 });
                    }
                  }}
                />

                {/* Text Input Overlay */}
                {textInput.show && (
                  <div
                    className="absolute z-10"
                    style={{
                      left: `${textInput.x / scale}px`,
                      top: `${textInput.y / scale}px`,
                      transform: "translate(-50%, -50%)",
                    }}
                  >
                    <div className="flex items-center gap-2 bg-white dark:bg-gray-800 p-2 rounded-md shadow-lg border">
                      <input
                        ref={textInputRef}
                        type="text"
                        value={textInput.text}
                        onChange={(e) => setTextInput((prev) => ({ ...prev, text: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleTextSubmit();
                          if (e.key === "Escape") handleTextCancel();
                        }}
                        placeholder="Enter text..."
                        className="px-2 py-1 text-sm border rounded min-w-[120px]"
                        style={{ color: currentColor }}
                        autoFocus
                      />
                      <Button size="sm" onClick={handleTextSubmit} className="h-6 w-6 p-0" type="button">
                        ✓
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleTextCancel}
                        className="h-6 w-6 p-0"
                        type="button"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Button Container */}
            <div className="flex justify-between items-center pt-4 border-t">
              <Button variant="outline" onClick={() => setStep("capture")} type="button">
                Back
              </Button>
              <Button onClick={handleConfirm} type="button">
                <Upload className="w-4 h-4 mr-2" />
                Add to Ticket
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}