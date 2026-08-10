import React from "react";
import { Input } from "@/@/components/ui/input";
import ReactQuill from "react-quill-new";
import "quill/dist/quill.snow.css";
import {
  Download,
  Loader2,
  Paperclip,
  X,
} from "lucide-react";
import { SectionWrapper, FormField } from "./ticket-form-components";
import TicketScreenshotUpload from "./ScreenshotReport";
// Import the new component

interface TicketContentSectionProps {
  summary: string;
  description: string;

  setSummary: (value: string) => void;
  setDescription: (value: string) => void;

  uploadedFiles: File[];
  imagePreviews: string[];
  existingAttachments: {
    paths: string[];
    names: string[];
    ids: string[];
  };
  existingImagePreviews: Record<string, string>;
  imageErrors: Record<string, boolean>;
  previewImage: { src: string; alt: string } | null;

  // Handlers
  handleImageChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  removeFile: (index: number) => void;
  removeExistingAttachment: (index: number) => void;
  handleDownload: (id: string, filename: string) => Promise<void>;
  setPreviewImage: (image: { src: string; alt: string } | null) => void;
  isImageFile: (filename: string) => boolean;
  getFileExtension: (filename: string) => string;

  // State
  isEditMode: boolean;
  initialData?: any;
  formElementsDisabled: boolean;
}

export const TicketContentSection: React.FC<TicketContentSectionProps> = ({
  summary,
  description,
  setSummary,
  setDescription,
  uploadedFiles,
  imagePreviews,
  existingAttachments,
  existingImagePreviews,
  imageErrors,
  previewImage,
  handleImageChange,
  removeFile,
  removeExistingAttachment: _removeExistingAttachment,
  handleDownload,
  setPreviewImage,
  isImageFile,
  getFileExtension,
  isEditMode,
  initialData,
  formElementsDisabled,
}) => {
  // Handler for screenshot upload component
  const handleScreenshotFiles = (files: File[]) => {
    if (files.length > 0) {
      // Create a synthetic event to pass to handleImageChange
      const dataTransfer = new DataTransfer();
      files.forEach(file => dataTransfer.items.add(file));

      const syntheticEvent = {
        target: {
          files: dataTransfer.files,
          value: ''
        }
      } as React.ChangeEvent<HTMLInputElement>;

      handleImageChange(syntheticEvent);
    }
  };

  return (
    <>
      <SectionWrapper title="">
        <div className="-mt-3 mb-3">
          <FormField label="Summary (Subject)" required>
            <Input
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Enter ticket summary"
              className="h-8 text-xs"
              disabled={formElementsDisabled}
            />
          </FormField>

        </div>
        <FormField label="Description" required>
          <div className={formElementsDisabled ? "opacity-60 pointer-events-none" : ""}>
            <ReactQuill
              theme="snow"
              value={description}
              onChange={setDescription}
              placeholder="Provide detailed description ..."
              className="text-xs [&_.ql-editor]:min-h-[100px]"
              modules={{
                toolbar: [
                  ["bold", "italic", "underline", "strike"],
                  [{ list: "ordered" }, { list: "bullet" }],
                  [{ header: [1, 2, 3, false] }],
                  ["link", "image"],
                  ["clean"],
                ],
              }}
            />
          </div>
        </FormField>
      </SectionWrapper>

      <SectionWrapper title="Attachments (upload max 5 MB images)">
        <FormField label="Upload Images" required>
          <div className="space-y-4">
            {/* Replace the old Input with TicketScreenshotUpload component */}
            {/* <div className="flex gap-2"> */}
            <div className="w-full">
              <TicketScreenshotUpload
                onFilesSelected={handleScreenshotFiles}
                disabled={formElementsDisabled}
                existingFiles={uploadedFiles}
              />

              {/* Optional: Keep a hidden traditional file input as backup */}
              {/* <Input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageChange}
                className="h-8 text-xs flex-1"
                disabled={formElementsDisabled}
              /> */}
            </div>

            {isEditMode && existingAttachments.paths.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-medium text-gray-700">
                  Existing Attachments ({existingAttachments.paths.length})
                </div>

                <div className="grid grid-cols-5 gap-2">
                  {existingAttachments.paths.map((path, idx) => {
                    const filename =
                      existingAttachments.names[idx] ||
                      `Attachment ${idx + 1}`;
                    const isImage = isImageFile(filename);
                    const previewSrc = existingImagePreviews[path];
                    const hasError = imageErrors[path];

                    return (
                      <div
                        key={`existing-${idx}`}
                        className="relative group border border-gray-300 rounded"
                      >
                        {isImage ? (
                          <button
                            type="button"
                            className="w-full h-24"
                            onClick={() =>
                              previewSrc &&
                              setPreviewImage({
                                src: previewSrc,
                                alt: filename,
                              })
                            }
                            disabled={!previewSrc || hasError}
                          >
                            <div className="relative h-full w-full">
                              {hasError || !previewSrc ? (
                                <div className="h-full w-full bg-gray-100 rounded flex items-center justify-center flex-col">
                                  {hasError ? (
                                    <>
                                      <Paperclip className="h-8 w-8 text-gray-400" />
                                      <span className="text-xs text-gray-500 mt-1">
                                        Error
                                      </span>
                                    </>
                                  ) : (
                                    <Loader2 className="h-6 w-6 text-gray-400 animate-spin" />
                                  )}
                                </div>
                              ) : (
                                <img
                                  src={previewSrc}
                                  alt={filename}
                                  className="h-full w-full object-cover rounded"
                                />
                              )}
                            </div>
                          </button>
                        ) : (
                          <div className="h-24 w-full bg-gray-100 rounded flex items-center justify-center flex-col">
                            <Paperclip className="h-8 w-8 text-gray-400" />
                            <span className="text-xs text-gray-500 mt-1">
                              {getFileExtension(filename).toUpperCase()}
                            </span>
                          </div>
                        )}

                        <div className="absolute top-1 right-1 flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownload(
                                String(initialData!.id),
                                filename
                              );
                            }}
                            className="bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-blue-600"
                            title="Download attachment"
                          >
                            <Download className="h-3 w-3" />
                          </button>
                        </div>

                        <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 truncate rounded-b">
                          {filename}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {uploadedFiles.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-medium text-gray-700">
                  File Uploaded ({uploadedFiles.length})
                </div>

                <div className="grid grid-cols-5 gap-2">
                  {imagePreviews.map((src, idx) => (
                    <div key={`new-${idx}`} className="relative group">
                      <button
                        type="button"
                        className="w-full h-24"
                        onClick={() =>
                          setPreviewImage({
                            src: src,
                            alt:
                              uploadedFiles[idx]?.name ||
                              `Preview ${idx + 1}`,
                          })
                        }
                      >
                        <img
                          src={src}
                          alt={`Preview ${idx + 1}`}
                          className="h-full w-full object-cover rounded border border-gray-300"
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeFile(idx)}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                        title="Remove file"
                      >
                        <X className="h-3 w-3" />
                      </button>
                      <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 truncate rounded-b">
                        {uploadedFiles[idx]?.name}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {existingAttachments.paths.length === 0 &&
              uploadedFiles.length === 0 && (
                <div className="text-xs text-gray-500">
                  No files attached
                </div>
              )}
          </div>
        </FormField>
      </SectionWrapper>
    </>
  );
};
