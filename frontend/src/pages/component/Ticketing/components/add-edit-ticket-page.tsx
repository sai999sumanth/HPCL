// import React, { useEffect, useState } from 'react';
// import { useNavigate, useSearchParams } from 'react-router-dom';
// import { EditTicketDialog } from '../components/edit-ticket-dialog';
// import { useTickets } from '../hooks/useTickets';
// import { Ticket } from '../components/types/ticket';
// import { CreateTicketDialog } from './create-ticket-dialog';

// export function AddEditTicketingPage() {
//   const navigate = useNavigate();
//   const [searchParams] = useSearchParams();
//   const { tickets } = useTickets();
  
//   // Get parameters from URL
//   const mode = searchParams.get('mode') || 'create'; // 'create' or 'edit'
//   const ticketId = searchParams.get('ticketId');
//   const initialBu = searchParams.get('bu') || 'TAS';
//   const initialZoneId = searchParams.get('zoneId');
//   const initialPlantId = searchParams.get('plantId');
  
//   // State for dialogs
//   const [createDialogOpen, setCreateDialogOpen] = useState(false);
//   const [editDialogOpen, setEditDialogOpen] = useState(false);
//   const [ticketToEdit, setTicketToEdit] = useState<Ticket | null>(null);

//   // Open appropriate dialog based on mode
//   useEffect(() => {
//     if (mode === 'create') {
//       setCreateDialogOpen(true);
//     } else if (mode === 'edit' && ticketId) {
//       const ticket = tickets.find(t => t.id.toString() === ticketId || t.ticket_id === ticketId);
//       if (ticket) {
//         setTicketToEdit(ticket);
//         setEditDialogOpen(true);
//       } else {
//         // Ticket not found, redirect to dashboard
//         navigate('/ticketing');
//       }
//     }
//   }, [mode, ticketId, tickets, navigate]);

//   // Handle dialog close - navigate back to dashboard
//   const handleCreateDialogClose = (open: boolean) => {
//     setCreateDialogOpen(open);
//     if (!open) {
//       navigate('/ticketing');
//     }
//   };

//   const handleEditDialogClose = (open: boolean) => {
//     setEditDialogOpen(open);
//     if (!open) {
//       setTicketToEdit(null);
//       navigate('/ticketing');
//     }
//   };

//   return (
//     <div className="min-h-screen bg-gray-50">
//       {/* Background overlay when dialog is open */}
//       {(createDialogOpen || editDialogOpen) && (
//         <div className="fixed inset-0 bg-black/50 z-40" />
//       )}
      
//       {/* Page content - could be empty or show some background content */}
//       <div className="container mx-auto px-4 py-8">
//         <div className="text-center">
//           <h1 className="text-2xl font-semibold text-gray-900 mb-4">
//             {mode === 'create' ? 'Create New Ticket' : 'Edit Ticket'}
//           </h1>
//           <p className="text-gray-600">
//             {mode === 'create' 
//               ? 'Fill out the form to create a new ticket'
//               : 'Update the ticket details below'
//             }
//           </p>
//         </div>
//       </div>

//       {/* Create Ticket Dialog */}
//       <CreateTicketDialog
//         open={createDialogOpen}
//         onOpenChange={handleCreateDialogClose}
//         initialBu={initialBu}
//         initialZoneId={initialZoneId}
//         initialPlantId={initialPlantId}
//       />

//       {/* Edit Ticket Dialog */}
//       <EditTicketDialog
//         ticketToEdit={ticketToEdit}
//         open={editDialogOpen}
//         onOpenChange={handleEditDialogClose}
//       />
//     </div>
//   );
// }