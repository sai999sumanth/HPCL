// import { useState, useEffect } from 'react';
// import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/@/components/ui/tabs';
// import { Button } from '@/@/components/ui/button';
// import { Input } from '@/@/components/ui/input';
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/@/components/ui/select';
// import { Badge } from '@/@/components/ui/badge';
// import { Plus, Search, Filter, Users, BarChart3, Settings, AlertTriangle } from 'lucide-react';
// import { Ticket, TicketStatus, TicketType, User } from './types/ticket';
// import { TicketDetail } from './TicketDetail';
// import { TicketBoard } from './TicketBoard';
// import { TicketCard } from './TicketCard';
// import { JiraCreateTicket } from './JiraCreateTicket';
// import { realApi } from './services/mockApi';
// import { IconTicket } from '@tabler/icons-react';

// function TicketingScreen() {
//   const [tickets, setTickets] = useState<Ticket[]>([]);
//   const [users, setUsers] = useState<User[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState<string | null>(null);
//   const [showTicketForm, setShowTicketForm] = useState(false);
//   const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
//   const [showTicketDetail, setShowTicketDetail] = useState(false);
//   const [searchTerm, setSearchTerm] = useState('');
//   const [filterSeverity, setFilterSeverity] = useState<string>('All');
//   const [filterStatus, setFilterStatus] = useState<TicketStatus | 'All'>('All');

//   // Mock current user (in a real app, this would come from authentication)
//   const currentUser: User = {
//     id: 'current-user',
//     name: 'John Doe',
//     email: 'john.doe@example.com',
//     avatar: 'https://github.com/shadcn.png',
//   };

//   useEffect(() => {
//     loadData();
//   }, []);

//   const loadData = async () => {
//     try {
//       setLoading(true);
//       setError(null);
//       const [ticketsData, usersData] = await Promise.all([
//         realApi.getTickets(0, 100),
//         realApi.getUsers(),
//       ]);
//       setTickets(ticketsData);
//       setUsers([currentUser, ...usersData]);
//     } catch (error) {
//       console.error('Error loading data:', error);
//       setError('Failed to load tickets. Please try again.');
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleTicketCreated = (newTicket: Ticket) => {
//     setTickets(prev => [newTicket, ...prev]);
//   };

//   const handleStatusChange = async (ticketId: string, newStatus: TicketStatus) => {
//     try {
//       const updatedTicket = await realApi.updateTicket(ticketId, { status: newStatus });
//       if (updatedTicket) {
//         setTickets(prev => prev.map(ticket =>
//           ticket.id === ticketId ? updatedTicket : ticket
//         ));
//       }
//     } catch (error) {
//       console.error('Error updating ticket status:', error);
//       setError('Failed to update ticket status. Please try again.');
//     }
//   };

//   const handleTicketClick = (ticket: Ticket) => {
//     setSelectedTicket(ticket);
//     setShowTicketDetail(true);
//   };

//   const filteredTickets = tickets.filter(ticket => {
//     const matchesSearch = ticket.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
//       ticket.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
//       ticket.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
//       (ticket.alertId && ticket.alertId.toLowerCase().includes(searchTerm.toLowerCase())) ||
//       (ticket.sapId && ticket.sapId.toLowerCase().includes(searchTerm.toLowerCase()));

//     const matchesSeverity = filterSeverity === 'All' || ticket.severity === filterSeverity;
//     const matchesStatus = filterStatus === 'All' || ticket.status === filterStatus;

//     return matchesSearch && matchesSeverity && matchesStatus;
//   });

//   const getTicketStats = () => {
//     const total = tickets.length;
//     const todo = tickets.filter(t => t.status === 'ToDo').length;
//     const inProgress = tickets.filter(t => t.status === 'In Progress').length;
//     const resolved = tickets.filter(t => t.status === 'Resolved').length;
//     const onHold = tickets.filter(t => t.status === 'On Hold').length;
//     const cancelled = tickets.filter(t => t.status === 'Cancelled').length;

//     return { total, todo, inProgress, resolved, onHold, cancelled };
//   };

//   const stats = getTicketStats();

//   if (loading) {
//     return (
//       <div className="flex items-center justify-center min-h-screen">
//         <div className="text-center">
//           <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
//           <p className="mt-2 text-muted-foreground">Loading tickets...</p>
//         </div>
//       </div>
//     );
//   }

//   if (error) {
//     return (
//       <div className="flex items-center justify-center min-h-screen">
//         <div className="text-center">
//           <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-2" />
//           <p className="text-red-600 mb-4">{error}</p>
//           <Button onClick={loadData}>Retry</Button>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="min-h-screen bg-background">
//       {/* Stats Bar */}
//       <div className="border-b bg-muted/50">
//         <div className="container mx-auto px-1 py-1">
//           <div className="flex items-center justify-between">
//             {/* Left: Stats */}
//             <div className="flex items-center space-x-6">
//               <div className="flex items-center space-x-2">
//                 <IconTicket className="h-5 w-5" />
//                 <span className="text-sm font-medium">Total: {stats.total}</span>
//               </div>
//               <Badge variant="secondary">To Do: {stats.todo}</Badge>
//               <Badge variant="secondary" className="bg-blue-100 text-blue-800">
//                 In Progress: {stats.inProgress}
//               </Badge>
//               <Badge variant="secondary" className="bg-green-100 text-green-800">
//                 Resolved: {stats.resolved}
//               </Badge>
//               <Badge variant="secondary" className="bg-orange-100 text-orange-800">
//                 On Hold: {stats.onHold}
//               </Badge>
//               <Badge variant="secondary" className="bg-red-100 text-red-800">
//                 Cancelled: {stats.cancelled}
//               </Badge>
//             </div>

//             {/* Right: Filters + Create Button */}
//             <div className="flex items-center space-x-2">
//               {/* Search Input */}
//               <div className="relative">
//                 <Search className="absolute left-2 top-1.5 h-4 w-4 text-muted-foreground" />
//                 <Input
//                   placeholder="Search tickets..."
//                   value={searchTerm}
//                   onChange={(e) => setSearchTerm(e.target.value)}
//                   className="pl-10 w-40 h-8 text-sm"
//                 />
//               </div>

//               {/* Severity Filter */}
//               <Select value={filterSeverity} onValueChange={(value) => setFilterSeverity(value)}>
//                 <SelectTrigger className="w-28 h-8 px-2 py-1 text-sm">
//                   <SelectValue />
//                 </SelectTrigger>
//                 <SelectContent>
//                   <SelectItem value="All">All Severity</SelectItem>
//                   <SelectItem value="High">High</SelectItem>
//                   <SelectItem value="Medium">Medium</SelectItem>
//                   <SelectItem value="Low">Low</SelectItem>
//                 </SelectContent>
//               </Select>

//               {/* Status Filter */}
//               <Select value={filterStatus} onValueChange={(value) => setFilterStatus(value as TicketStatus | 'All')}>
//                 <SelectTrigger className="w-28 h-8 px-2 py-1 text-sm">
//                   <SelectValue />
//                 </SelectTrigger>
//                 <SelectContent>
//                   <SelectItem value="All">All Status</SelectItem>
//                   <SelectItem value="ToDo">To Do</SelectItem>
//                   <SelectItem value="In Progress">In Progress</SelectItem>
//                   <SelectItem value="Cancelled">Cancelled</SelectItem>
//                   <SelectItem value="Resolved">Resolved</SelectItem>
//                   <SelectItem value="On Hold">On Hold</SelectItem>
//                 </SelectContent>
//               </Select>

//               {/* Create Button */}
//               <Button
//                 className="flex items-center space-x-2 bg-blue-500 px-4 py-2 h-8 text-white text-sm hover:bg-blue-700"
//               >
//                 <Plus className="h-4 w-4" />
//                 <span>Create</span>
//               </Button>
//             </div>
//           </div>
//         </div>
//       </div>


//       {/* Main Content */}
//       <main className="container mx-auto px-1 py-1">
//         <Tabs defaultValue="board" className="space-y-1">
//           <div className="flex items-center justify-between">
//             <TabsList>
//               <TabsTrigger value="board">Board</TabsTrigger>
//               <TabsTrigger value="list">List</TabsTrigger>
//             </TabsList>

         
//           </div>

//           <TabsContent value="board" className="space-y-1">
//             <TicketBoard
//               tickets={filteredTickets}
//               onStatusChange={handleStatusChange}
//               onTicketClick={handleTicketClick}
//             />
//           </TabsContent>

//           <TabsContent value="list" className="space-y-4">
//             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
//               {filteredTickets.map((ticket) => (
//                 <TicketCard
//                   key={ticket.id}
//                   ticket={ticket}
//                   onStatusChange={handleStatusChange}
//                   onTicketClick={handleTicketClick}
//                 />
//               ))}
//             </div>
//           </TabsContent>
//         </Tabs>
//       </main>

//       {/* Dialogs */}
//       <JiraCreateTicket
//         open={showTicketForm}
//         onOpenChange={setShowTicketForm}
//         onTicketCreated={handleTicketCreated}
//         users={users}
//         tickets={tickets}
//         currentUser={currentUser}
//       />

//       <TicketDetail
//         ticket={selectedTicket}
//         open={showTicketDetail}
//         onOpenChange={setShowTicketDetail}
//       />
//     </div>
//   );
// }

// export default TicketingScreen;
import { TicketDashboard } from './components/ticket-dashboard';

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <TicketDashboard />
    </div>
  );
}

export default App;
