

import { Card, CardContent, CardHeader, CardTitle } from '@/@/components/ui/card';
import { Badge } from '@/@/components/ui/badge';
import { TicketCard } from './TicketCard';
import { Ticket, TicketStatus } from './types/ticket';

interface TicketBoardProps {
  tickets: Ticket[];
  onStatusChange: (ticketId: string, newStatus: TicketStatus) => void;
  onTicketClick: (ticket: Ticket) => void;
}

const columns: { status: TicketStatus; color: string; displayName: string }[] = [
  { status: 'ToDo', color: 'bg-gray-100', displayName: 'TO DO' },
  { status: 'In Progress', color: 'bg-blue-100', displayName: 'IN PROGRESS' },
  { status: 'Cancelled', color: 'bg-red-100', displayName: 'CANCELLED' },
  { status: 'Resolved', color: 'bg-green-100', displayName: 'RESOLVED' },
  { status: 'On Hold', color: 'bg-orange-100', displayName: 'ON HOLD' },
];

export function TicketBoard({ tickets, onStatusChange, onTicketClick }: TicketBoardProps) {
  const getTicketsByStatus = (status: TicketStatus) => {
    return tickets.filter(ticket => ticket.status === status);
  };
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-2 h-full">
      {columns.map(({ status, color, displayName }) => {
        const statusTickets = getTicketsByStatus(status);
                
        return (
          <div key={status as string } className="flex flex-col h-full">
            <Card className={`${color} mb-1`}>
              <CardHeader className="p-4">
                <CardTitle className="text-sm font-medium flex items-center justify-between">
                  {displayName}
                  <Badge variant="secondary" className="text-xs">
                    {statusTickets.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
            </Card>
                        
            <div className="space-y-3 flex-1 overflow-y-auto">
              {statusTickets.map((ticket) => (
                <TicketCard
                  key={ticket.id}
                  ticket={ticket}
                  onStatusChange={onStatusChange}
                  onTicketClick={onTicketClick}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
