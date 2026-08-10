// import { useState } from 'react';
// import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/@/components/ui/sheet';
// import { Badge } from '@/@/components/ui/badge';
// import { Button } from '@/@/components/ui/button';
// import { Avatar, AvatarFallback, AvatarImage } from '@/@/components/ui/avatar';
// import { Separator } from '@/@/components/ui/separator';
// import { Ticket } from './types/ticket';
// import { Calendar, User, Flag, Hash, Clock, MessageCircle } from 'lucide-react';
// import { format } from 'date-fns';

// interface TicketDetailProps {
//   ticket: Ticket | null;
//   open: boolean;
//   onOpenChange: (open: boolean) => void;
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
//     case 'Highest': return 'text-red-600 bg-red-50';
//     case 'High': return 'text-orange-600 bg-orange-50';
//     case 'Medium': return 'text-yellow-600 bg-yellow-50';
//     case 'Low': return 'text-blue-600 bg-blue-50';
//     case 'Lowest': return 'text-gray-600 bg-gray-50';
//     default: return 'text-gray-600 bg-gray-50';
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

// export function TicketDetail({ ticket, open, onOpenChange }: TicketDetailProps) {
//   if (!ticket) return null;

//   return (
//     <Sheet open={open} onOpenChange={onOpenChange}>
//       <SheetContent className="sm:max-w-xl overflow-y-auto">
//         <SheetHeader className="space-y-4">
//           <div className="flex items-center space-x-3">
//             <span className="text-2xl">{getTypeIcon(ticket.type)}</span>
//             <div>
//               <SheetTitle className="text-left">{ticket.title}</SheetTitle>
//               <p className="text-sm text-muted-foreground font-mono">{ticket.key}</p>
//             </div>
//           </div>
//         </SheetHeader>

//         <div className="space-y-6 mt-6">
//           {/* Status and Priority */}
//           <div className="flex flex-wrap gap-2">
//             <Badge className={getStatusColor(ticket.status)}>
//               {ticket.status}
//             </Badge>
//             <Badge variant="outline" className={getPriorityColor(ticket.priority)}>
//               <Flag className="h-3 w-3 mr-1" />
//               {ticket.priority}
//             </Badge>
//             <Badge variant="outline">
//               {ticket.type}
//             </Badge>
//             {ticket.storyPoints && (
//               <Badge variant="outline">
//                 {ticket.storyPoints} Story Points
//               </Badge>
//             )}
//           </div>


//           {/* Description */}
//           <div>
//             <h3 className="font-semibold mb-2">Description</h3>
//             <p className="text-sm text-muted-foreground whitespace-pre-wrap">
//               {ticket.description}
//             </p>
//           </div>

//           <Separator />

//           {/* Details */}
//           <div className="space-y-4">
//             <h3 className="font-semibold">Details</h3>
            
//             <div className="grid grid-cols-1 gap-4">
//               <div className="flex items-center space-x-3">
//                 <User className="h-4 w-4 text-muted-foreground" />
//                 <div>
//                   <p className="text-xs text-muted-foreground">Reporter</p>
//                   <div className="flex items-center space-x-2">
//                     <Avatar className="h-6 w-6">
//                       <AvatarImage src={ticket.reporter.avatar} />
//                       <AvatarFallback className="text-xs">
//                         {ticket.reporter.name.split(' ').map(n => n[0]).join('')}
//                       </AvatarFallback>
//                     </Avatar>
//                     <span className="text-sm">{ticket.reporter.name}</span>
//                   </div>
//                 </div>
//               </div>

//               {ticket.assignee && (
//                 <div className="flex items-center space-x-3">
//                   <User className="h-4 w-4 text-muted-foreground" />
//                   <div>
//                     <p className="text-xs text-muted-foreground">Assignee</p>
//                     <div className="flex items-center space-x-2">
//                       <Avatar className="h-6 w-6">
//                         <AvatarImage src={ticket.assignee.avatar} />
//                         <AvatarFallback className="text-xs">
//                           {ticket.assignee.name.split(' ').map(n => n[0]).join('')}
//                         </AvatarFallback>
//                       </Avatar>
//                       <span className="text-sm">{ticket.assignee.name}</span>
//                     </div>
//                   </div>
//                 </div>
//               )}

//               {ticket. start_date && (
//                 <div className="flex items-center space-x-3">
//                   <Calendar className="h-4 w-4 text-muted-foreground" />
//                   <div>
//                     <p className="text-xs text-muted-foreground">Start Date</p>
//                     <span className="text-sm">{format(new Date(ticket.start_date), 'PPP')}</span>
//                   </div>
//                 </div>
//               )}

//               {ticket.end_date && (
//                 <div className="flex items-center space-x-3">
//                   <Calendar className="h-4 w-4 text-muted-foreground" />
//                   <div>
//                     <p className="text-xs text-muted-foreground">End Date</p>
//                     <span className="text-sm">{format(new Date(ticket.end_date), 'PPP')}</span>
//                   </div>
//                 </div>
//               )}

//               <div className="flex items-center space-x-3">
//                 <Clock className="h-4 w-4 text-muted-foreground" />
//                 <div>
//                   <p className="text-xs text-muted-foreground">Created</p>
//                   <span className="text-sm">{format(new Date(ticket.created_at), 'PPP')}</span>
//                 </div>
//               </div>

//               <div className="flex items-center space-x-3">
//                 <Clock className="h-4 w-4 text-muted-foreground" />
//                 <div>
//                   <p className="text-xs text-muted-foreground">Updated</p>
//                   <span className="text-sm">{format(new Date(ticket.updated_at), 'PPP')}</span>
//                 </div>
//               </div>
//             </div>
//           </div>

//           {/* Labels */}
//           {ticket.labels.length > 0 && (
//             <>
//               <Separator />
//               <div>
//                 <h3 className="font-semibold mb-2">Labels</h3>
//                 <div className="flex flex-wrap gap-1">
//                   {ticket.labels.map((label) => (
//                     <Badge key={label} variant="outline" className="text-xs">
//                       <Hash className="h-3 w-3 mr-1" />
//                       {label}
//                     </Badge>
//                   ))}
//                 </div>
//               </div>
//             </>
//           )}

//           {/* Actions */}
//           <Separator />
//           <div className="flex space-x-2">
//             <Button variant="outline" size="sm">
//               Edit Ticket
//             </Button>
//             <Button variant="outline" size="sm">
//               <MessageCircle className="h-4 w-4 mr-1" />
//               Add Comment
//             </Button>
//           </div>
//         </div>
//       </SheetContent>
//     </Sheet>
//   );
// }















import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/@/components/ui/sheet';
import { Badge } from '@/@/components/ui/badge';
import { Button } from '@/@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/@/components/ui/avatar';
import { Separator } from '@/@/components/ui/separator';
import { Ticket } from './types/ticket';
import { Calendar, User, Flag, Hash, Clock, MessageCircle } from 'lucide-react';
import { format } from 'date-fns';

interface TicketDetailProps {
  ticket: Ticket | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const getTypeIcon = (type: string) => {
  switch (type) {
    case 'Epic': return '🏆';
    case 'Story': return '📖';
    case 'Task': return '✅';
    case 'Bug': return '🐛';
    case 'Subtask': return '📋';
    default: return '📄';
  }
};

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'Highest': return 'text-red-600 bg-red-50';
    case 'High': return 'text-orange-600 bg-orange-50';
    case 'Medium': return 'text-yellow-600 bg-yellow-50';
    case 'Low': return 'text-blue-600 bg-blue-50';
    case 'Lowest': return 'text-gray-600 bg-gray-50';
    default: return 'text-gray-600 bg-gray-50';
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'To Do': return 'bg-gray-100 text-gray-800';
    case 'In Progress': return 'bg-blue-100 text-blue-800';
    case 'In Review': return 'bg-purple-100 text-purple-800';
    case 'Done': return 'bg-green-100 text-green-800';
    case 'Blocked': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};


const getUserInfo = (user: string | { name: string; avatar?: string } | undefined) => {
  if (!user) return null;
  
  if (typeof user === 'string') {
    return {
      name: user,
      avatar: undefined,
      initials: user.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    };
  }
  
  return {
    name: user.name,
    avatar: user.avatar,
    initials: user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  };
};

export function TicketDetail({ ticket, open, onOpenChange }: TicketDetailProps) {
  if (!ticket) return null;

  const reporterInfo = getUserInfo(ticket.reporter);
  const assigneeInfo = getUserInfo(ticket.assignee);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl overflow-y-auto">
        <SheetHeader className="space-y-4">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">{getTypeIcon(ticket.type)}</span>
            <div>
              <SheetTitle className="text-left">{ticket.title}</SheetTitle>
              <p className="text-sm text-muted-foreground font-mono">{ticket.key}</p>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Status and Priority */}
          <div className="flex flex-wrap gap-2">
            <Badge className={getStatusColor(ticket.status)}>
              {ticket.status}
            </Badge>
            <Badge variant="outline" className={getPriorityColor(ticket.priority)}>
              <Flag className="h-3 w-3 mr-1" />
              {ticket.priority}
            </Badge>
            <Badge variant="outline">
              {ticket.type}
            </Badge>
            {ticket.storyPoints && (
              <Badge variant="outline">
                {ticket.storyPoints} Story Points
              </Badge>
            )}
          </div>

          {/* Description */}
          <div>
            <h3 className="font-semibold mb-2">Description</h3>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {ticket.description}
            </p>
          </div>

          <Separator />

          {/* Details */}
          <div className="space-y-4">
            <h3 className="font-semibold">Details</h3>
            
            <div className="grid grid-cols-1 gap-4">
              {reporterInfo && (
                <div className="flex items-center space-x-3">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Reporter</p>
                    <div className="flex items-center space-x-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={reporterInfo.avatar} />
                        <AvatarFallback className="text-xs">
                          {reporterInfo.initials}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{reporterInfo.name}</span>
                    </div>
                  </div>
                </div>
              )}

              {assigneeInfo && (
                <div className="flex items-center space-x-3">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Assignee</p>
                    <div className="flex items-center space-x-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={assigneeInfo.avatar} />
                        <AvatarFallback className="text-xs">
                          {assigneeInfo.initials}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{assigneeInfo.name}</span>
                    </div>
                  </div>
                </div>
              )}

              {ticket.start_date && (
                <div className="flex items-center space-x-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Start Date</p>
                    <span className="text-sm">{format(new Date(ticket.start_date), 'PPP')}</span>
                  </div>
                </div>
              )}

              {ticket.end_date && (
                <div className="flex items-center space-x-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">End Date</p>
                    <span className="text-sm">{format(new Date(ticket.end_date), 'PPP')}</span>
                  </div>
                </div>
              )}

              <div className="flex items-center space-x-3">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Created</p>
                  <span className="text-sm">{format(new Date(ticket.created_at), 'PPP')}</span>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Updated</p>
                  <span className="text-sm">{format(new Date(ticket.updated_at), 'PPP')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Labels */}
          {ticket.labels && ticket.labels.length > 0 && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold mb-2">Labels</h3>
                <div className="flex flex-wrap gap-1">
                  {ticket.labels.map((label) => (
                    <Badge key={label} variant="outline" className="text-xs">
                      <Hash className="h-3 w-3 mr-1" />
                      {label}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Actions */}
          <Separator />
          <div className="flex space-x-2">
            <Button variant="outline" size="sm">
              Edit Ticket
            </Button>
            <Button variant="outline" size="sm">
              <MessageCircle className="h-4 w-4 mr-1" />
              Add Comment
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}