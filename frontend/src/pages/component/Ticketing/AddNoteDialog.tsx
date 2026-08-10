import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/@/components/ui/dialog';
import { Button } from '@/@/components/ui/button';
import { Textarea } from '@/@/components/ui/textarea';
import { Label } from '@/@/components/ui/label';
import { Ticket } from './types/ticket';

interface AddNoteDialogProps {
    isOpen: boolean;
    ticket: Ticket | null;
    onClose: () => void;
    onAddNote: (ticketId: string, content: string, user: string) => void;
  }
  
  const AddNoteDialog: React.FC<AddNoteDialogProps> = ({
    isOpen,
    ticket,
    onClose,
    onAddNote,
  }) => {
    const [note, setNote] = useState('');
  
    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (ticket && note.trim()) {
        onAddNote(ticket.id.toString(), note.trim(), 'user@example.com');
        setNote('');
        onClose();
      }
    };
  
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Note</DialogTitle>
          </DialogHeader>
          {ticket && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <div className="text-sm text-gray-600">
                  Ticket: {ticket.summary}
                </div>
                <div className="text-xs text-gray-500">
                  #{ticket.sap_id}
                </div>
              </div>
              
              <div>
                <Label htmlFor="note">Note*</Label>
                <Textarea
                  id="note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Enter your note..."
                  rows={4}
                  required
                />
              </div>
  
              <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit">Add Note</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    );
  };
  
  