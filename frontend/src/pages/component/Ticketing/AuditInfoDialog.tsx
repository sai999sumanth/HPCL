// import React, { useState } from 'react';
// import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/@/components/ui/dialog';
// import { Button } from '@/@/components/ui/button';
// import { Input } from '@/@/components/ui/input';
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/@/components/ui/select';
// import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/@/components/ui/table';
// import { X } from 'lucide-react';
// import { Ticket } from './types/ticket';

// interface AuditInfoDialogProps {
//     isOpen: boolean;
//     ticket: Ticket | null;
//     onClose: () => void;
//   }
  
//   const AuditInfoDialog: React.FC<AuditInfoDialogProps> = ({
//     isOpen,
//     ticket,
//     onClose,
//   }) => {
//     const [searchTerm, setSearchTerm] = useState('');
//     const [entriesPerPage, setEntriesPerPage] = useState('10');
//     const [currentPage, setCurrentPage] = useState(1);
  
//     if (!ticket) return null;
  
//     const filteredEntries = ticket.auditLog.filter(entry =>
//       entry.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
//       entry.user.toLowerCase().includes(searchTerm.toLowerCase())
//     );
  
//     const totalEntries = filteredEntries.length;
//     const startIndex = (currentPage - 1) * parseInt(entriesPerPage);
//     const endIndex = Math.min(startIndex + parseInt(entriesPerPage), totalEntries);
//     const paginatedEntries = filteredEntries.slice(startIndex, endIndex);
  
//     return (
//       <Dialog open={isOpen} onOpenChange={onClose}>
//         <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
//           <DialogHeader>
//             <div className="flex items-center justify-between">
//               <DialogTitle className="text-lg font-semibold">Audit Info</DialogTitle>
//               <Button variant="ghost" size="sm" onClick={onClose}>
//                 <X className="h-4 w-4" />
//               </Button>
//             </div>
//           </DialogHeader>
  
//           <div className="space-y-4">
//             <div className="text-blue-600 font-medium">
//               Summary: {ticket.summary}
//             </div>
  
//             <div className="flex items-center justify-between gap-4">
//               <div className="flex items-center gap-2">
//                 <span>Show</span>
//                 <Select value={entriesPerPage} onValueChange={setEntriesPerPage}>
//                   <SelectTrigger className="w-20">
//                     <SelectValue />
//                   </SelectTrigger>
//                   <SelectContent>
//                     <SelectItem value="5">5</SelectItem>
//                     <SelectItem value="10">10</SelectItem>
//                     <SelectItem value="25">25</SelectItem>
//                     <SelectItem value="50">50</SelectItem>
//                   </SelectContent>
//                 </Select>
//                 <span>entries</span>
//               </div>
  
//               <div className="flex items-center gap-2">
//                 <span>Search:</span>
//                 <Input
//                   value={searchTerm}
//                   onChange={(e) => setSearchTerm(e.target.value)}
//                   className="w-48"
//                   placeholder="Search audit log..."
//                 />
//               </div>
//             </div>
  
//             <div className="border rounded-lg">
//               <Table>
//                 <TableHeader>
//                   <TableRow>
//                     <TableHead>Log</TableHead>
//                   </TableRow>
//                 </TableHeader>
//                 <TableBody>
//                   {paginatedEntries.map((entry) => (
//                     <TableRow key={entry.id}>
//                       <TableCell className="text-sm">
//                         At {entry.timestamp.toLocaleDateString()} {entry.timestamp.toLocaleTimeString()}, {entry.action}{entry.details ? `, ${entry.details}` : ''}, by {entry.user}
//                       </TableCell>
//                     </TableRow>
//                   ))}
//                 </TableBody>
//               </Table>
//             </div>
  
//             <div className="flex items-center justify-between text-sm text-gray-600">
//               <span>
//                 Showing {startIndex + 1} to {endIndex} of {totalEntries} entries
//               </span>
              
//               <div className="flex items-center gap-2">
//                 <Button
//                   variant="outline"
//                   size="sm"
//                   onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
//                   disabled={currentPage === 1}
//                 >
//                   Previous
//                 </Button>
                
//                 <span className="px-3 py-1 bg-blue-600 text-white rounded text-sm">
//                   {currentPage}
//                 </span>
                
//                 <Button
//                   variant="outline"
//                   size="sm"
//                   onClick={() => setCurrentPage(prev => prev + 1)}
//                   disabled={endIndex >= totalEntries}
//                 >
//                   Next
//                 </Button>
//               </div>
//             </div>
  
//             <div className="flex justify-end">
//               <Button onClick={onClose}>Close</Button>
//             </div>
//           </div>
//         </DialogContent>
//       </Dialog>
//     );
//   };
  