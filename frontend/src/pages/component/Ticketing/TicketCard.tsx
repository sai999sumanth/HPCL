// import { Card, CardContent, CardHeader } from '@/@/components/ui/card';
// import { Badge } from '@/@/components/ui/badge';
// import { Avatar, AvatarFallback, AvatarImage } from '@/@/components/ui/avatar';
// import { Button } from '@/@/components/ui/button';
// import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/@/components/ui/dropdown-menu';
// import { Ticket, TicketStatus } from './types/ticket';
// import { MoreHorizontal, Calendar, User, Flag } from 'lucide-react';
// import { format } from 'date-fns';

// interface TicketCardProps {
//   ticket: Ticket;
//   onStatusChange: (ticketId: string, newStatus: TicketStatus) => void;
//   onTicketClick: (ticket: Ticket) => void;
// }

// const getTypeIcon = (type: string) => {
//   switch (type) {
//     case 'Epic': return '🏆';
//     case 'Story': return '📖';
//     case 'Task': return '✅';
//     case 'Bug': return '🐛';
//     case 'Subtask': return '📋';
//     default: return '📄';
//   }
// };

// const getPriorityColor = (priority: string) => {
//   switch (priority) {
//     case 'Highest': return 'bg-red-500';
//     case 'High': return 'bg-orange-500';
//     case 'Medium': return 'bg-yellow-500';
//     case 'Low': return 'bg-blue-500';
//     case 'Lowest': return 'bg-gray-500';
//     default: return 'bg-gray-500';
//   }
// };

// const getStatusColor = (status: string) => {
//   switch (status) {
//     case 'To Do': return 'bg-gray-100 text-gray-800';
//     case 'In Progress': return 'bg-blue-100 text-blue-800';
//     case 'In Review': return 'bg-purple-100 text-purple-800';
//     case 'Done': return 'bg-green-100 text-green-800';
//     case 'Blocked': return 'bg-red-100 text-red-800';
//     default: return 'bg-gray-100 text-gray-800';
//   }
// };

// const statuses: TicketStatus[] = ['To Do', 'In Progress', 'In Review', 'Done', 'Blocked'];

// export function TicketCard({ ticket, onStatusChange, onTicketClick }: TicketCardProps) {
//   const handleStatusChange = (newStatus: TicketStatus) => {
//     onStatusChange(ticket.id, newStatus);
//   };

//   return (
//     <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onTicketClick(ticket)}>
//       <CardHeader className="pb-2">
//         <div className="flex items-start justify-between">
//           <div className="flex items-center space-x-2">
//             <span className="text-lg">{getTypeIcon(ticket.type)}</span>
//             <span className="text-sm font-mono text-muted-foreground">{ticket.key}</span>
//             <div className={`w-2 h-2 rounded-full ${getPriorityColor(ticket.priority)}`} title={ticket.priority} />
//           </div>
//           <DropdownMenu>
//             <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
//               <Button variant="ghost" size="sm">
//                 <MoreHorizontal className="h-4 w-4" />
//               </Button>
//             </DropdownMenuTrigger>
//             <DropdownMenuContent>
//               {statuses.map((status) => (
//                 <DropdownMenuItem key={status} onClick={() => handleStatusChange(status)}>
//                   Move to {status}
//                 </DropdownMenuItem>
//               ))}
//             </DropdownMenuContent>
//           </DropdownMenu>
//         </div>
//       </CardHeader>
      
//       <CardContent className="space-y-3">
//         <h3 className="font-semibold text-sm leading-tight line-clamp-2">{ticket.title}</h3>
        
//         <div className="flex flex-wrap gap-1">
//           <Badge variant="secondary" className={getStatusColor(ticket.status)}>
//             {ticket.status}
//           </Badge>
//           {ticket.labels.map((label) => (
//             <Badge key={label} variant="outline" className="text-xs">
//               {label}
//             </Badge>
//           ))}
//         </div>

//         {ticket.description && (
//           <p className="text-xs text-muted-foreground line-clamp-2">{ticket.description}</p>
//         )}

//         <div className="flex items-center justify-between text-xs text-muted-foreground">
//           <div className="flex items-center space-x-2">
//             {ticket.assignee && (
//               <div className="flex items-center space-x-1">
//                 <Avatar className="h-5 w-5">
//                   <AvatarImage src={ticket.assignee.avatar} />
//                   <AvatarFallback className="text-xs">
//                     {ticket.assignee.name.split(' ').map(n => n[0]).join('')}
//                   </AvatarFallback>
//                 </Avatar>
//               </div>
//             )}
//             {ticket.storyPoints && (
//               <Badge variant="outline" className="text-xs">
//                 {ticket.storyPoints} SP
//               </Badge>
//             )}
//           </div>
          
//           {ticket.endDate && (
//             <div className="flex items-center space-x-1">
//               <Calendar className="h-3 w-3" />
//               <span>{format(new Date(ticket.endDate), 'MMM dd')}</span>
//             </div>
//           )}
//         </div>
//       </CardContent>
//     </Card>
//   );
// }

import { Card, CardContent, CardHeader } from '@/@/components/ui/card';
import { Badge } from '@/@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/@/components/ui/avatar';
import { Button } from '@/@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/@/components/ui/dropdown-menu';
import { Ticket, TicketStatus } from './types/ticket';
import { MoreHorizontal, Calendar, User, Flag } from 'lucide-react';
import { format } from 'date-fns';

interface TicketCardProps {
  ticket: Ticket;
  onStatusChange: (ticketId: string, newStatus: TicketStatus) => void;
  onTicketClick: (ticket: Ticket) => void;
}



const getSeverityColor = (severity: string) => {
  switch (severity) {
    case 'High': return 'bg-red-500';
    case 'Medium': return 'bg-yellow-500';
    case 'Low': return 'bg-green-500';
    default: return 'bg-gray-500';
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'ToDo': return 'bg-gray-100 text-gray-800';
    case 'In Progress': return 'bg-blue-100 text-blue-800';
    case 'Cancelled': return 'bg-red-100 text-red-800';
    case 'Resolved': return 'bg-green-100 text-green-800';
    case 'On Hold': return 'bg-orange-100 text-orange-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const statuses: TicketStatus[] = ['ToDo', 'In Progress', 'Cancelled', 'Resolved', 'On Hold'];

export function TicketCard({ ticket, onStatusChange, onTicketClick }: TicketCardProps) {
  const handleStatusChange = (newStatus: TicketStatus) => {
    onStatusChange(ticket.id.toString(), newStatus);
  };
 //onClick={() => onTicketClick(ticket)}
  return (
    <Card className="p-2 pb-2 cursor-pointer hover:shadow-md transition-shadow" >   
      <CardHeader className="p-1">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-lg">🎫</span>
            <span className="text-sm font-mono text-muted-foreground">{ticket.alert_section}</span>
           
            {ticket.severity && (
              <Badge variant="outline" className="text-xs">
                {ticket.severity}
              </Badge>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {statuses.map((status) => (
                <DropdownMenuItem key={status as string} onClick={() => handleStatusChange(status)}>
                  Move to {status as string}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3 p-0">
        
        {/* Alert ID and SAP ID in one line */}
        <div className="flex items-center space-x-2 text-xs text-muted-foreground">
          <span className="font-mono">{ticket.alert_id}</span>       
        </div>
        
        <div className="flex items-center space-x-2 text-xs text-muted-foreground">
        {ticket.sap_id && (
            <>
              <span className="font-mono">SAP: {ticket.sap_id}</span>
            </>
          )}
          {/* {ticket.labels.map((label) => (
            <Badge key={label} variant="outline" className="text-xs">
              {label}
            </Badge>
          ))} */}
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center space-x-2">
      
            {ticket.severity && (
              <Badge variant="outline" className="text-xs">
                {ticket.ticket_status}
              </Badge>
            )}
          </div>
          
          {ticket.start_date && (
            <div className="flex items-center space-x-1">
              <Calendar className="h-3 w-3" />
              <span>{format(new Date(ticket.start_date), 'MMM dd')}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
