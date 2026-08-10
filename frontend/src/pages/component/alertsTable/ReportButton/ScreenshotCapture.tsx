import type React from "react"
import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/@/components/ui/dialog"
import { Card, CardContent } from "@/@/components/ui/card"
import { Label } from "@/@/components/ui/label"
import { Textarea } from "@/@/components/ui/textarea"
import { Input } from "@/@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/@/components/ui/select"
import { Separator } from "@/@/components/ui/separator"
import { Camera, Send, Undo, Redo, Type, Pen, Square, Circle, ArrowRight, Download, Command, Upload, Clipboard, X } from 'lucide-react'
import { useToast } from "@/@/components/ui/use-toast"
import { TbMessageReportFilled } from "react-icons/tb"
import { SearchableSelect } from "./SearchableSelect"
import { apiClient } from "@/services/apiClient"
import { Add } from "@mui/icons-material"

interface ScreenshotReportProps {
    onSubmit?: (data: { imageUrl: string; description: string; metadata: any }) => Promise<void>
    apiEndpoint?: string
}

type CaptureMode = "full" | "selection" | "paste"
type EditTool = "pen" | "text" | "rectangle" | "circle" | "arrow"

interface DrawingAction {
    id: string
    tool: EditTool
    color: string
    size: number
    points?: { x: number; y: number }[]
    text?: string
    startX?: number
    startY?: number
    endX?: number
    endY?: number
}

interface TextInput {
    x: number
    y: number
    text: string
    show: boolean
}

interface FormData {
    subject: string
    description: string
    bu: string
    location_id: string
}  const businessUnitOptions = [
    { id: 'TAS', name: 'TAS' },
    { id: 'RO', name: 'RO' },
    { id: 'LPG', name: 'LPG' },
    // Add more options as needed
];

export default function ScreenshotReport({
    onSubmit,
    apiEndpoint = "/api/ticketing/create_ticket",
}: ScreenshotReportProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [step, setStep] = useState<"capture" | "edit" | "submit">("capture")
    const [captureMode, setCaptureMode] = useState<CaptureMode>("full")
    const [screenshot, setScreenshot] = useState<string | null>(null)
    const [isCapturing, setIsCapturing] = useState(false)
    const [showInstructions, setShowInstructions] = useState(false)
    const [isWaitingForPaste, setIsWaitingForPaste] = useState(false)

    // Editing state
    const [currentTool, setCurrentTool] = useState<EditTool>("pen")
    const [currentColor, setCurrentColor] = useState("#ff0000")
    const [currentSize, setCurrentSize] = useState(3)
    const [actions, setActions] = useState<DrawingAction[]>([])
    const [redoStack, setRedoStack] = useState<DrawingAction[]>([])
    const [isDrawing, setIsDrawing] = useState(false)
    const [currentAction, setCurrentAction] = useState<DrawingAction | null>(null)
    const [textInput, setTextInput] = useState<TextInput>({ x: 0, y: 0, text: "", show: false })

    // Location options state
    const [locationOptions, setLocationOptions] = useState<Array<{ name: string, id: string }>>([])
    const [isLoadingLocations, setIsLoadingLocations] = useState(false)

    // Form state
    const [formData, setFormData] = useState<FormData>({
        subject: "",
        description: "",
        bu: "",
        location_id: "",
    })
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [formErrors, setFormErrors] = useState<Partial<FormData>>({})

    // Refs
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const overlayCanvasRef = useRef<HTMLCanvasElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const textInputRef = useRef<HTMLInputElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    // Canvas dimensions
    const [canvasDimensions, setCanvasDimensions] = useState({ width: 0, height: 0 })
    const [scale, setScale] = useState(1)

    // Toast hook
    const { toast } = useToast()

    // Detect if user is on macOS
    const isMac = typeof navigator !== "undefined" && navigator.userAgent.indexOf("Mac") !== -1

    // Reset component state
    const resetComponent = () => {
        setStep("capture")
        setScreenshot(null)
        setActions([])
        setRedoStack([])
        setFormData({
            subject: "",
            description: "",
            bu: "",
            location_id: "",
        })
        setFormErrors({})
        setLocationOptions([])
        setShowInstructions(false)
        setIsWaitingForPaste(false)
        setTextInput({ x: 0, y: 0, text: "", show: false })
        setCurrentAction(null)
        setIsDrawing(false)
    }

    // Validate form
    const validateForm = (): boolean => {
        const errors: Partial<FormData> = {}

        if (!formData.subject.trim()) {
            errors.subject = "subject field is required"
        }

        if (!formData.description.trim()) {
            errors.description = "Description is required"
        }

        if (!screenshot) {
            toast({
                title: "Error",
                description: "Screenshot is required",
                variant: "destructive",
            })
            return false
        }

        setFormErrors(errors)
        return Object.keys(errors).length === 0
    }

   
const fetchLocationDetails = async (selectedBu: string) => {
  if (!selectedBu) return;

  setIsLoadingLocations(true);
  try {
    const response = await apiClient.post(
      "/api/indentdryout/get_distinct_location_details",
      {
        bu: selectedBu,
        zone: [],
        plant: [],
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    const result = response.data;
    if (result.status && result.data && result.data.plant) {
      setLocationOptions(result.data.plant);
    }
  } catch (error: any) {
    console.error("Error fetching location details:", error);
    toast({
      title: "Error",
      description: "Failed to load location options",
      variant: "destructive",
    });
  } finally {
    setIsLoadingLocations(false);
  }
};


    // Handle form input changes
    const handleFormChange = (field: keyof FormData, value: string) => {
        setFormData((prev) => ({ ...prev, [field]: value }))

        // Clear location when BU changes and fetch new locations
        if (field === 'bu') {
            setFormData((prev) => ({ ...prev, location_id: '' }))
            fetchLocationDetails(value)
        }

        // Clear error when user starts typing
        if (formErrors[field]) {
            setFormErrors((prev) => ({ ...prev, [field]: undefined }))
        }
    }

    // Handle native screenshot instructions
    const handleNativeScreenshot = (mode: CaptureMode) => {
        setCaptureMode(mode)
        setShowInstructions(true)
        setIsWaitingForPaste(true)
    }

    // Handle file upload
    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (file && file.type.startsWith("image/")) {
            const reader = new FileReader()
            reader.onload = (e) => {
                setScreenshot(e.target?.result as string)
                setStep("edit")
                setShowInstructions(false)
                setIsWaitingForPaste(false)
            }
            reader.readAsDataURL(file)
        }
    }

    // Handle paste from clipboard
    const handlePaste = useCallback(
        async (e: ClipboardEvent) => {
            if (!isWaitingForPaste) return

            e.preventDefault()
            const items = e.clipboardData?.items
            if (!items) return

            for (let i = 0; i < items.length; i++) {
                const item = items[i]
                if (item.type.indexOf("image") !== -1) {
                    const blob = item.getAsFile()
                    if (blob) {
                        const reader = new FileReader()
                        reader.onload = (event) => {
                            setScreenshot(event.target?.result as string)
                            setStep("edit")
                            setShowInstructions(false)
                            setIsWaitingForPaste(false)
                        }
                        reader.readAsDataURL(blob)
                    }
                    break
                }
            }
        },
        [isWaitingForPaste],
    )

    // Add paste event listener
    useEffect(() => {
        if (isWaitingForPaste) {
            document.addEventListener("paste", handlePaste)
            return () => document.removeEventListener("paste", handlePaste)
        }
    }, [isWaitingForPaste, handlePaste])

    // Initialize canvas for editing
    useEffect(() => {
        if (screenshot && step === "edit" && canvasRef.current && overlayCanvasRef.current) {
            const canvas = canvasRef.current
            const overlayCanvas = overlayCanvasRef.current
            const ctx = canvas.getContext("2d")
            const img = new Image()

            img.onload = () => {
                // Calculate canvas size to fit container while maintaining aspect ratio
                const container = containerRef.current
                if (!container) return

                // Use available space more effectively - account for toolbar and padding
                const maxWidth = Math.min(800, container.clientWidth - 40)
                const maxHeight = Math.min(500, window.innerHeight * 0.5)

                const imgAspect = img.width / img.height
                const containerAspect = maxWidth / maxHeight

                let displayWidth, displayHeight

                if (imgAspect > containerAspect) {
                    displayWidth = maxWidth
                    displayHeight = maxWidth / imgAspect
                } else {
                    displayHeight = maxHeight
                    displayWidth = maxHeight * imgAspect
                }

                // Set canvas dimensions
                canvas.width = img.width
                canvas.height = img.height
                canvas.style.width = `${displayWidth}px`
                canvas.style.height = `${displayHeight}px`

                overlayCanvas.width = img.width
                overlayCanvas.height = img.height
                overlayCanvas.style.width = `${displayWidth}px`
                overlayCanvas.style.height = `${displayHeight}px`

                setCanvasDimensions({ width: img.width, height: img.height })
                setScale(img.width / displayWidth)

                // Draw the base image
                ctx?.drawImage(img, 0, 0)
                redrawCanvas()
            }

            img.src = screenshot
        }
    }, [screenshot, step])

    // Redraw canvas with all actions
    const redrawCanvas = () => {
        if (!canvasRef.current || !overlayCanvasRef.current) return

        const canvas = canvasRef.current
        const overlayCanvas = overlayCanvasRef.current
        const ctx = canvas.getContext("2d")
        const overlayCtx = overlayCanvas.getContext("2d")

        if (!ctx || !overlayCtx || !screenshot) return

        // Clear overlay canvas
        overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height)

        // Redraw base image
        const img = new Image()
        img.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height)
            ctx.drawImage(img, 0, 0)

            // Draw all actions on overlay
            actions.forEach((action) => {
                drawAction(overlayCtx, action)
            })
        }
        img.src = screenshot
    }

    // Draw action on canvas
    const drawAction = (ctx: CanvasRenderingContext2D, action: DrawingAction) => {
        ctx.strokeStyle = action.color
        ctx.fillStyle = action.color
        ctx.lineWidth = action.size
        ctx.lineCap = "round"
        ctx.lineJoin = "round"

        switch (action.tool) {
            case "pen":
                if (action.points && action.points.length > 1) {
                    ctx.beginPath()
                    ctx.moveTo(action.points[0].x, action.points[0].y)
                    action.points.forEach((point) => {
                        ctx.lineTo(point.x, point.y)
                    })
                    ctx.stroke()
                }
                break

            case "rectangle":
                if (
                    action.startX !== undefined &&
                    action.startY !== undefined &&
                    action.endX !== undefined &&
                    action.endY !== undefined
                ) {
                    const width = action.endX - action.startX
                    const height = action.endY - action.startY
                    ctx.strokeRect(action.startX, action.startY, width, height)
                }
                break

            case "circle":
                if (
                    action.startX !== undefined &&
                    action.startY !== undefined &&
                    action.endX !== undefined &&
                    action.endY !== undefined
                ) {
                    const radius = Math.sqrt(Math.pow(action.endX - action.startX, 2) + Math.pow(action.endY - action.startY, 2))
                    ctx.beginPath()
                    ctx.arc(action.startX, action.startY, radius, 0, 2 * Math.PI)
                    ctx.stroke()
                }
                break

            case "arrow":
                if (
                    action.startX !== undefined &&
                    action.startY !== undefined &&
                    action.endX !== undefined &&
                    action.endY !== undefined
                ) {
                    drawArrow(ctx, action.startX, action.startY, action.endX, action.endY, action.size)
                }
                break

            case "text":
                if (action.text && action.startX !== undefined && action.startY !== undefined) {
                    ctx.font = `bold ${action.size * 6}px Arial`
                    ctx.fillText(action.text, action.startX, action.startY)
                }
                break
        }
    }

    // Draw arrow helper
    const drawArrow = (
        ctx: CanvasRenderingContext2D,
        startX: number,
        startY: number,
        endX: number,
        endY: number,
        lineWidth: number,
    ) => {
        const headLength = Math.max(15, lineWidth * 3)
        const angle = Math.atan2(endY - startY, endX - startX)

        // Draw line
        ctx.beginPath()
        ctx.moveTo(startX, startY)
        ctx.lineTo(endX, endY)
        ctx.stroke()

        // Draw arrowhead
        ctx.beginPath()
        ctx.moveTo(endX, endY)
        ctx.lineTo(endX - headLength * Math.cos(angle - Math.PI / 6), endY - headLength * Math.sin(angle - Math.PI / 6))
        ctx.moveTo(endX, endY)
        ctx.lineTo(endX - headLength * Math.cos(angle + Math.PI / 6), endY - headLength * Math.sin(angle + Math.PI / 6))
        ctx.stroke()
    }

    // Get mouse position relative to canvas
    const getCanvasPosition = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!overlayCanvasRef.current) return { x: 0, y: 0 }

        const canvas = overlayCanvasRef.current
        const rect = canvas.getBoundingClientRect()
        const x = (e.clientX - rect.left) * scale
        const y = (e.clientY - rect.top) * scale

        return { x, y }
    }

    // Canvas mouse events
    const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (textInput.show) return

        const { x, y } = getCanvasPosition(e)

        setIsDrawing(true)
        setRedoStack([]) // Clear redo stack when starting new action

        if (currentTool === "text") {
            setTextInput({ x, y, text: "", show: true })
            setIsDrawing(false)
            setTimeout(() => textInputRef.current?.focus(), 100)
            return
        }

        const action: DrawingAction = {
            id: Date.now().toString(),
            tool: currentTool,
            color: currentColor,
            size: currentSize,
            startX: x,
            startY: y,
            points: currentTool === "pen" ? [{ x, y }] : undefined,
        }

        setCurrentAction(action)
    }

    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDrawing || !currentAction || !overlayCanvasRef.current) return

        const { x, y } = getCanvasPosition(e)

        let updatedAction: DrawingAction

        if (currentTool === "pen") {
            updatedAction = {
                ...currentAction,
                points: [...(currentAction.points || []), { x, y }],
            }
        } else {
            updatedAction = {
                ...currentAction,
                endX: x,
                endY: y,
            }
        }

        setCurrentAction(updatedAction)

        // Draw preview on overlay canvas
        const overlayCtx = overlayCanvasRef.current.getContext("2d")
        if (overlayCtx) {
            // Clear and redraw all actions plus current action
            overlayCtx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height)

            actions.forEach((action) => {
                drawAction(overlayCtx, action)
            })

            drawAction(overlayCtx, updatedAction)
        }
    }

    const handleMouseUp = () => {
        if (!isDrawing || !currentAction) return

        setActions((prev) => [...prev, currentAction])
        setCurrentAction(null)
        setIsDrawing(false)
    }

    // Handle text input
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
            }
            setActions((prev) => [...prev, action])
            setTimeout(redrawCanvas, 0)
        }
        setTextInput({ x: 0, y: 0, text: "", show: false })
    }

    const handleTextCancel = () => {
        setTextInput({ x: 0, y: 0, text: "", show: false })
    }

    // Undo/Redo
    const undo = () => {
        if (actions.length > 0) {
            const lastAction = actions[actions.length - 1]
            setRedoStack((prev) => [...prev, lastAction])
            setActions((prev) => prev.slice(0, -1))
            setTimeout(redrawCanvas, 0)
        }
    }

    const redo = () => {
        if (redoStack.length > 0) {
            const actionToRedo = redoStack[redoStack.length - 1]
            setActions((prev) => [...prev, actionToRedo])
            setRedoStack((prev) => prev.slice(0, -1))
            setTimeout(redrawCanvas, 0)
        }
    }

    // Combine canvases for final image
    const getFinalImage = (): string => {
        if (!canvasRef.current || !overlayCanvasRef.current) return ""

        const finalCanvas = document.createElement("canvas")
        const finalCtx = finalCanvas.getContext("2d")

        if (!finalCtx) return ""

        finalCanvas.width = canvasRef.current.width
        finalCanvas.height = canvasRef.current.height

        // Draw base image
        finalCtx.drawImage(canvasRef.current, 0, 0)

        // Draw overlay
        finalCtx.drawImage(overlayCanvasRef.current, 0, 0)

        return finalCanvas.toDataURL("image/jpeg", 0.9)
    }

    // Convert canvas to blob and upload
    const saveAndSubmit = async () => {
        if (!validateForm()) return

        setIsSubmitting(true)
        try {
            const finalImageUrl = getFinalImage()

            // Convert to blob
            const response = await fetch(finalImageUrl)
            const blob = await response.blob()

            // Create FormData for upload
            const formDataToSend = new FormData()
            formDataToSend.append("subject", formData.subject)
            formDataToSend.append("description", formData.description)
            formDataToSend.append("bu", formData.bu)
            formDataToSend.append("location_id", formData.location_id)
            formDataToSend.append("upload_file", blob, "screenshot.jpg")

            // Upload to API
            const uploadResponse = await apiClient.post(apiEndpoint, formDataToSend,{
                headers: {
        // "Content-Type": "multipart/form-data",
         "Content-Type": "application/json",
      },
            })

        

            const result =  uploadResponse.data

            // Check if response format is [true, "/reports/ticketing/newplot.png"]
            if (Array.isArray(result) && result[0] === true) {
                toast({
                    title: "Success",
                    description: "Ticket is created",
                })

                // Call custom onSubmit if provided
                if (onSubmit) {
                    await onSubmit({
                        imageUrl: result[1] || "",
                        description: formData.description,
                        metadata: {
                            subject: formData.subject,
                            bu: formData.bu,
                            location_id: formData.location_id,
                            timestamp: new Date().toISOString(),
                            userAgent: navigator.userAgent,
                            url: window.location.href,
                        },
                    })
                }

                // Reset component
                setIsOpen(false)
                resetComponent()
            } else {
                throw new Error("Unexpected response format")
            }
        } catch (error) {
            console.error("Failed to submit report:", error)
            toast({
                title: "Error",
                description: "Failed to submit ticket. Please try again.",
                variant: "destructive",
            })
        } finally {
            setIsSubmitting(false)
        }
    }

    // Download edited image
    const downloadImage = () => {
        const finalImageUrl = getFinalImage()
        const link = document.createElement("a")
        link.download = `screenshot-${Date.now()}.jpg`
        link.href = finalImageUrl
        link.click()
    }

    const colors = ["#ff0000", "#00ff00", "#0000ff", "#ffff00", "#ff00ff", "#00ffff", "#ffffff", "#000000"]

    return (
        <Dialog
            open={isOpen}
            onOpenChange={(open) => {
                setIsOpen(open)
                if (!open) resetComponent()
            }}
        >
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" >
                    <TbMessageReportFilled className="w-5 h-5 text-red-500 hover:text-red-600" />
                </Button>

            </DialogTrigger>

            <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {step === "capture" && "Capture Screenshot"}
                        {step === "edit" && "Edit Screenshot"}
                        {step === "submit" && "Submit Report"}
                    </DialogTitle>
                </DialogHeader>

                {step === "capture" && !showInstructions && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Card
                                className="cursor-pointer hover:bg-muted/50 transition-colors"
                                onClick={() => handleNativeScreenshot("full")}
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
                                    <h3 className="font-semibold">Upload Image</h3>
                                    <p className="text-sm text-muted-foreground">Select from files</p>
                                </CardContent>
                            </Card>
                        </div>

                        <input type="file" ref={fileInputRef} accept="image/*" onChange={handleFileUpload} className="hidden" />
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
                                    variant={currentTool === "pen" ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setCurrentTool("pen")}
                                    className="h-10 w-10 p-0"
                                >
                                    <Pen className="w-4 h-4" />
                                </Button>
                                <Button
                                    variant={currentTool === "text" ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setCurrentTool("text")}
                                    className="h-10 w-10 p-0"
                                >
                                    <Type className="w-4 h-4" />
                                </Button>
                                <Button
                                    variant={currentTool === "rectangle" ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setCurrentTool("rectangle")}
                                    className="h-10 w-10 p-0"
                                >
                                    <Square className="w-4 h-4" />
                                </Button>
                                <Button
                                    variant={currentTool === "circle" ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setCurrentTool("circle")}
                                    className="h-10 w-10 p-0"
                                >
                                    <Circle className="w-4 h-4" />
                                </Button>
                                <Button
                                    variant={currentTool === "arrow" ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setCurrentTool("arrow")}
                                    className="h-10 w-10 p-0"
                                >
                                    <ArrowRight className="w-4 h-4" />
                                </Button>
                            </div>

                            <Separator orientation="vertical" className="h-8" />

                            <div className="flex items-center gap-2">
                                <Label className="text-sm whitespace-nowrap">Size:</Label>
                                <Select value={currentSize.toString()} onValueChange={(value) => setCurrentSize(Number(value))}>
                                    <SelectTrigger className="w-16">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="2">2</SelectItem>
                                        <SelectItem value="4">4</SelectItem>
                                        <SelectItem value="6">6</SelectItem>
                                        <SelectItem value="8">8</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex items-center gap-1">
                                {colors.map((color) => (
                                    <button
                                        key={color}
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
                                <Button variant="outline" size="sm" onClick={undo} disabled={actions.length === 0}>
                                    <Undo className="w-4 h-4" />
                                </Button>
                                <Button variant="outline" size="sm" onClick={redo} disabled={redoStack.length === 0}>
                                    <Redo className="w-4 h-4" />
                                </Button>
                            </div>

                            <Button variant="outline" size="sm" onClick={downloadImage}>
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
                                    className="relative cursor-crosshair border border-gray-200 dark:border-gray-700 rounded"
                                    width={400}
                                    height={300}
                                    onMouseDown={handleMouseDown}
                                    onMouseMove={handleMouseMove}
                                    onMouseUp={handleMouseUp}
                                    onMouseLeave={() => setIsDrawing(false)}
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
                                                    if (e.key === "Enter") handleTextSubmit()
                                                    if (e.key === "Escape") handleTextCancel()
                                                }}
                                                placeholder="Enter text..."
                                                className="px-2 py-1 text-sm border rounded min-w-[120px]"
                                                style={{ color: currentColor }}
                                                autoFocus
                                            />
                                            <Button size="sm" onClick={handleTextSubmit} className="h-6 w-6 p-0">
                                                ✓
                                            </Button>
                                            <Button size="sm" variant="outline" onClick={handleTextCancel} className="h-6 w-6 p-0">
                                                <X className="w-3 h-3" />
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Fixed Button Container with proper spacing and visibility */}
                        <div className="flex justify-between items-center pt-4 border-t">
                            <Button variant="outline" onClick={() => setStep("capture")}>
                                Back
                            </Button>
                            <Button variant="outline" onClick={() => setStep("submit")} className="ml-auto">
                                Continue
                                <ArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                        </div>
                    </div>
                )}

                {step === "submit" && (
                    <div className="space-y-6">
                        {/* Form Fields */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="subject">
                                    subject <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="subject"
                                    placeholder="Enter subject term..."
                                    value={formData.subject}
                                    onChange={(e) => handleFormChange("subject", e.target.value)}
                                    className={formErrors.subject ? "border-red-500" : ""}
                                />
                                {formErrors.subject && <p className="text-sm text-red-500">{formErrors.subject}</p>}
                            </div>


                            <div className="space-y-2">
                                <Label htmlFor="bu">bu</Label>

                                <SearchableSelect
                                    options={businessUnitOptions}
                                    value={formData.bu}
                                    onValueChange={(value) => handleFormChange("bu", value)}
                                    placeholder="Select business unit..."
                                    maxInitialDisplay={100}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="location">
                                    Location
                                </Label>

                                <SearchableSelect
                                    options={locationOptions}
                                    value={formData.location_id}
                                    onValueChange={(value) => handleFormChange("location_id", value)}
                                    placeholder={
                                        !formData.bu
                                            ? "Select business unit first..."
                                            : isLoadingLocations
                                                ? "Loading locations..."
                                                : "Select location..."
                                    }
                                    disabled={!formData.bu || isLoadingLocations}
                                    maxInitialDisplay={100}
                                />
                            </div>

                            <div className="space-y-2 md:col-span-3">
                                <Label htmlFor="description">
                                    Description <span className="text-red-500">*</span>
                                </Label>
                                <Textarea
                                    id="description"
                                    placeholder="Describe the issue or feedback..."
                                    value={formData.description}
                                    onChange={(e) => handleFormChange("description", e.target.value)}
                                    rows={4}
                                    className={formErrors.description ? "border-red-500" : ""}
                                />
                                {formErrors.description && <p className="text-sm text-red-500">{formErrors.description}</p>}
                            </div>

                        </div>

                        {/* Screenshot Preview */}
                        <div className="space-y-2">
                            <Label>
                                Upload File (Screenshot) <span className="text-red-500">*</span>
                            </Label>
                            {screenshot && (
                                <div className="border rounded-lg p-2 bg-gray-50 dark:bg-gray-900">
                                    <img
                                        src={getFinalImage() || "/placeholder.svg"}
                                        alt="Screenshot preview"
                                        className="max-w-full h-auto rounded max-h-96 mx-auto"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Required Fields Note
            <div className="text-sm text-muted-foreground">
              <span className="text-red-500">*</span> Required fields
            </div> */}

                        {/* Fixed Button Container with proper spacing and visibility */}
                        <div className="flex justify-between items-center pt-4 border-t">
                            <Button variant="outline" onClick={() => setStep("edit")}>
                                Back to Edit
                            </Button>
                            <Button variant="outline" onClick={saveAndSubmit} disabled={isSubmitting} className="ml-auto">
                                {isSubmitting ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                        Submitting...
                                    </>
                                ) : (
                                    <>
                                        <Add className="w-4 h-4 mr-2" />
                                        create Ticket
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
