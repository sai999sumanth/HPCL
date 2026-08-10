import React from "react"
import { Dialog, DialogContent } from "@/@/components/ui/dialog"
import { Button } from "@/@/components/ui/button"
import { Input } from "@/@/components/ui/input"
import { Textarea } from "@/@/components/ui/textarea"
import { Lock, MessageSquare, Calendar } from "lucide-react"

interface BlockDialogsProps {
  // Block Dialog
  isBlockDialogOpen: boolean
  setIsBlockDialogOpen: (open: boolean) => void
  blockRemark: string
  setBlockRemark: (remark: string) => void
  onConfirmBlock: () => void

  // Unblock Dialog
  isUnblockDialogOpen: boolean
  setIsUnblockDialogOpen: (open: boolean) => void
  unblockRemark: string
  setUnblockRemark: (remark: string) => void
  onConfirmUnblock: () => void

  // Block RO Dialog
  isBlockRODialogOpen: boolean
  setIsBlockRODialogOpen: (open: boolean) => void
  blockROId: string
  setBlockROId: (id: string) => void
  blockRORemark: string
  setBlockRORemark: (remark: string) => void
  onConfirmBlockRO: () => void

  // Comments Dialog
  isCommentsDialogOpen: boolean
  setIsCommentsDialogOpen: (open: boolean) => void
  comment: string
  setComment: (comment: string) => void
  onConfirmComments: () => void

  // Day End Dialog
  isDayEndDialogOpen: boolean
  setIsDayEndDialogOpen: (open: boolean) => void
  onConfirmDayEnd: () => void
}

const BlockDialogs: React.FC<BlockDialogsProps> = ({
  isBlockDialogOpen,
  setIsBlockDialogOpen,
  blockRemark,
  setBlockRemark,
  onConfirmBlock,
  isUnblockDialogOpen,
  setIsUnblockDialogOpen,
  unblockRemark,
  setUnblockRemark,
  onConfirmUnblock,
  isBlockRODialogOpen,
  setIsBlockRODialogOpen,
  blockROId,
  setBlockROId,
  blockRORemark,
  setBlockRORemark,
  onConfirmBlockRO,
  isCommentsDialogOpen,
  setIsCommentsDialogOpen,
  comment,
  setComment,
  onConfirmComments,
  isDayEndDialogOpen,
  setIsDayEndDialogOpen,
  onConfirmDayEnd,
}) => {
  return (
    <>
      {/* Block Confirmation Dialog */}
      <Dialog open={isBlockDialogOpen} onOpenChange={setIsBlockDialogOpen}>
        <DialogContent className="sm:max-w-[450px] border-0 shadow-2xl">
          <div className="space-y-0">
            <div className="flex items-center gap-3 p-6 border-b border-gray-100">
              <div className="flex items-center justify-center w-10 h-10 bg-red-50 rounded-lg">
                <Lock className="h-5 w-5 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">Block Retail Outlet</h3>
                <p className="text-sm text-gray-600 mt-1">Add remarks to confirm blocking this location</p>
              </div>
            </div>

            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label htmlFor="block-remark" className="block text-sm font-medium text-gray-700 mb-2">
                    Remarks <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Textarea
                      id="block-remark"
                      placeholder="Enter blocking reason and details..."
                      value={blockRemark}
                      onChange={(e) => {
                        if (e.target.value.length <= 500) {
                          setBlockRemark(e.target.value)
                        }
                      }}
                      maxLength={500}
                      className="min-h-[120px] resize-none border-gray-200 focus:border-red-500 focus:ring-red-500 rounded-lg text-sm"
                    />
                    <div className="absolute bottom-3 right-3 text-xs text-gray-400 bg-white px-1 rounded">
                      {blockRemark.length}/500
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50 rounded-b-lg border-t border-gray-100">
              <Button
                variant="ghost"
                onClick={() => setIsBlockDialogOpen(false)}
                className="px-4 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              >
                Cancel
              </Button>
              <Button
                onClick={onConfirmBlock}
                disabled={!blockRemark.trim()}
                className="px-6 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 disabled:text-gray-500 text-white font-medium"
              >
                <Lock className="h-4 w-4 mr-2" />
                Block Outlet
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Unblock Confirmation Dialog */}
      <Dialog open={isUnblockDialogOpen} onOpenChange={setIsUnblockDialogOpen}>
        <DialogContent className="sm:max-w-[450px] border-0 shadow-2xl">
          <div className="space-y-0">
            <div className="flex items-center gap-3 p-6 border-b border-gray-100">
              <div className="flex items-center justify-center w-10 h-10 bg-green-50 rounded-lg">
                <Lock className="h-5 w-5 text-green-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">Unblock Retail Outlet</h3>
                <p className="text-sm text-gray-600 mt-1">Add remarks to confirm unblocking this location</p>
              </div>
            </div>

            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label htmlFor="unblock-remark" className="block text-sm font-medium text-gray-700 mb-2">
                    Remarks <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Textarea
                      id="unblock-remark"
                      placeholder="Enter unblocking reason and details..."
                      value={unblockRemark}
                      onChange={(e) => {
                        if (e.target.value.length <= 500) {
                          setUnblockRemark(e.target.value)
                        }
                      }}
                      maxLength={500}
                      className="min-h-[120px] resize-none border-gray-200 focus:border-green-500 focus:ring-green-500 rounded-lg text-sm"
                    />
                    <div className="absolute bottom-3 right-3 text-xs text-gray-400 bg-white px-1 rounded">
                      {unblockRemark.length}/500
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50 rounded-b-lg border-t border-gray-100">
              <Button
                variant="ghost"
                onClick={() => setIsUnblockDialogOpen(false)}
                className="px-4 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              >
                Cancel
              </Button>
              <Button
                onClick={onConfirmUnblock}
                disabled={!unblockRemark.trim()}
                className="px-6 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:text-gray-500 text-white font-medium"
              >
                <Lock className="h-4 w-4 mr-2" />
                Unblock Outlet
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Block RO Dialog */}
      <Dialog open={isBlockRODialogOpen} onOpenChange={setIsBlockRODialogOpen}>
        <DialogContent className="sm:max-w-[450px] border-0 shadow-2xl">
          <div className="space-y-0">
            <div className="flex items-center gap-3 p-6 border-b border-gray-100">
              <div className="flex items-center justify-center w-10 h-10 bg-red-50 rounded-lg">
                <Lock className="h-5 w-5 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">Block Retail Outlet (RO)</h3>
                <p className="text-sm text-gray-600 mt-1">Provide RO ID and remarks to block</p>
              </div>
            </div>

            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label htmlFor="ro-id" className="block text-sm font-medium text-gray-700 mb-2">
                    RO ID (Location Code) <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="ro-id"
                    placeholder="Enter RO ID / Location Code"
                    value={blockROId}
                    onChange={(e) => setBlockROId(e.target.value)}
                    className="border-gray-200 focus:border-red-500 focus:ring-red-500 rounded-lg"
                  />
                </div>

                <div>
                  <label htmlFor="ro-remarks" className="block text-sm font-medium text-gray-700 mb-2">
                    Remarks <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Textarea
                      id="ro-remarks"
                      placeholder="Enter blocking reason and details..."
                      value={blockRORemark}
                      onChange={(e) => {
                        if (e.target.value.length <= 500) {
                          setBlockRORemark(e.target.value)
                        }
                      }}
                      maxLength={500}
                      className="min-h-[120px] resize-none border-gray-200 focus:border-red-500 focus:ring-red-500 rounded-lg text-sm"
                    />
                    <div className="absolute bottom-3 right-3 text-xs text-gray-400 bg-white px-1 rounded">
                      {blockRORemark.length}/500
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50 rounded-b-lg border-t border-gray-100">
              <Button
                variant="ghost"
                onClick={() => setIsBlockRODialogOpen(false)}
                className="px-4 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              >
                Cancel
              </Button>
              <Button
                onClick={onConfirmBlockRO}
                disabled={!blockROId.trim() || !blockRORemark.trim()}
                className="px-6 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 disabled:text-gray-500 text-white font-medium"
              >
                <Lock className="h-4 w-4 mr-2" />
                Block RO
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Comments Dialog */}
      <Dialog open={isCommentsDialogOpen} onOpenChange={setIsCommentsDialogOpen}>
        <DialogContent className="sm:max-w-[450px] border-0 shadow-2xl">
          <div className="space-y-0">
            <div className="flex items-center gap-3 p-6 border-b border-gray-100">
              <div className="flex items-center justify-center w-10 h-10 bg-blue-50 rounded-lg">
                <MessageSquare className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">Add Comment</h3>
                <p className="text-sm text-gray-600 mt-1">Enter your comment for this alert</p>
              </div>
            </div>

            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label htmlFor="comment-text" className="block text-sm font-medium text-gray-700 mb-2">
                    Comment <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Textarea
                      id="comment-text"
                      placeholder="Enter your comment..."
                      value={comment}
                      onChange={(e) => {
                        if (e.target.value.length <= 500) {
                          setComment(e.target.value)
                        }
                      }}
                      maxLength={500}
                      className="min-h-[120px] resize-none border-gray-200 focus:border-blue-500 focus:ring-blue-500 rounded-lg text-sm"
                    />
                    <div className="absolute bottom-3 right-3 text-xs text-gray-400 bg-white px-1 rounded">
                      {comment.length}/500
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50 rounded-b-lg border-t border-gray-100">
              <Button
                variant="ghost"
                onClick={() => setIsCommentsDialogOpen(false)}
                className="px-4 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              >
                Cancel
              </Button>
              <Button
                onClick={onConfirmComments}
                disabled={!comment.trim()}
                className="px-6 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-500 text-white font-medium"
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Submit Comment
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Day End Dialog */}
      <Dialog open={isDayEndDialogOpen} onOpenChange={setIsDayEndDialogOpen}>
        <DialogContent className="sm:max-w-[450px] border-0 shadow-2xl">
          <div className="space-y-0">
            <div className="flex items-center gap-3 p-6 border-b border-gray-100">
              <div className="flex items-center justify-center w-10 h-10 bg-purple-50 rounded-lg">
                <Calendar className="h-5 w-5 text-purple-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">Day End Process</h3>
                <p className="text-sm text-gray-600 mt-1">Confirm to initiate the day end process</p>
              </div>
            </div>

            <div className="p-6">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  <strong>Warning:</strong> This will process all pending alerts and close the day. This action cannot be undone.
                </p>
              </div>
              <p className="mt-4 text-sm text-gray-600">
                Are you sure you want to proceed with the day end process?
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50 rounded-b-lg border-t border-gray-100">
              <Button
                variant="ghost"
                onClick={() => setIsDayEndDialogOpen(false)}
                className="px-4 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              >
                Cancel
              </Button>
              <Button
                onClick={onConfirmDayEnd}
                className="px-6 bg-purple-600 hover:bg-purple-700 text-white font-medium"
              >
                <Calendar className="h-4 w-4 mr-2" />
                Confirm Day End
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default BlockDialogs