// import { useState, useEffect } from 'react';
// import { useForm, Controller } from 'react-hook-form';
// import { zodResolver } from '@hookform/resolvers/zod';
// import * as z from 'zod';
// import { Button } from '@/@/components/ui/button';
// import { Input } from '@/@/components/ui/input';
// import { Label } from '@/@/components/ui/label';
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/@/components/ui/select';
// import { Textarea } from '@/@/components/ui/textarea';
// import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/@/components/ui/dialog';
// import { Ticket, User, TicketType, TicketPriority } from './types/ticket';
// import { mockApi } from './services/mockApi';

// const UNASSIGNED_VALUE = "_UNASSIGNED_"; // Ensure this is not an empty string
// const NO_EPIC_VALUE = "_NO_EPIC_";       // Ensure this is not an empty string

// const ticketSchema = z.object({
//   title: z.string().min(1, 'Title is required'),
//   description: z.string().min(1, 'Description is required'),
//   type: z.enum(['Epic', 'Story', 'Task', 'Bug', 'Subtask']),
//   priority: z.enum(['Highest', 'High', 'Medium', 'Low', 'Lowest']),
//   assigneeId: z.string().optional(),
//   startDate: z.string().optional(),
//   endDate: z.string().optional(),
//   storyPoints: z.number().min(0).max(100).optional(), // Allow 0
//   labels: z.string().optional(),
//   parentId: z.string().optional(),
//   epicId: z.string().optional(),
// });

// type TicketFormData = z.infer<typeof ticketSchema>;

// // interface Epic extends Ticket {
// //   key: string;
// //   title: string;
// //   id:string
// // }

// interface TicketFormProps {
//   open: boolean;
//   onOpenChange: (open: boolean) => void;
//   onTicketCreated: (ticket: Ticket) => void;
//   users: User[];
//   tickets: Ticket[];
//   currentUser: User;
// }

// export function TicketForm({ open, onOpenChange, onTicketCreated, users, tickets, currentUser }: TicketFormProps) {
//   const [isSubmitting, setIsSubmitting] = useState(false);

//   const form = useForm<TicketFormData>({
//     resolver: zodResolver(ticketSchema),
//     defaultValues: {
//       title: '',
//       description: '',
//       type: 'Task',
//       priority: 'Medium',
//       assigneeId: UNASSIGNED_VALUE,
//       epicId: NO_EPIC_VALUE,
//       storyPoints: undefined,
//       labels: '',
//       parentId: undefined,
//       startDate: '',
//       endDate: ''
//     },
//   });

//  useEffect(() => {
//     if (open) {
//       form.reset({
//         title: '',
//         description: '',
//         type: 'Task',
//         priority: 'Medium',
//         assigneeId: UNASSIGNED_VALUE,
//         epicId: NO_EPIC_VALUE,
//         storyPoints: undefined,
//         labels: '',
//         parentId: undefined,
//         startDate: '',
//         endDate: ''
//       });
//     }
//   }, [open, form]);

//   const watchedType = form.watch('type');
//   const epics = tickets.filter(ticket => ticket.type === 'Epic' && ticket.id && ticket.id !== "");
//   const parentCandidates = tickets.filter(ticket =>
//     (ticket.type === 'Story' || ticket.type === 'Task') && ticket.id && ticket.id !== ""
//   );

//   const validUsers = users.filter(user => user.id && user.id !== "");


//   const onSubmit = async (data: TicketFormData) => {
//     setIsSubmitting(true);
//     try {
//       const assignee = (data.assigneeId && data.assigneeId !== UNASSIGNED_VALUE)
//         ? validUsers.find(u => u.id === data.assigneeId)
//         : undefined;

//       const ticketData = {
//         title: data.title,
//         description: data.description,
//         type: data.type as TicketType,
//         status: 'To Do' as const,
//         priority: data.priority as TicketPriority,
//         reporter: currentUser,
//         assignee,
//         startDate: data.startDate || undefined,
//         endDate: data.endDate || undefined,
//         storyPoints: (data.type === 'Story' || data.type === 'Task') ? (data.storyPoints === undefined ? undefined : Number(data.storyPoints)) : undefined,
//         labels: data.labels ? data.labels.split(',').map(l => l.trim()).filter(Boolean) : [],
//         parentId: data.type === 'Subtask' && data.parentId ? data.parentId : undefined,
//         epicId: (data.type === 'Story' || data.type === 'Task') && data.epicId && data.epicId !== NO_EPIC_VALUE ? data.epicId : undefined,
//       };

//       const newTicket = await mockApi.createTicket(ticketData);
//       onTicketCreated(newTicket);
//       onOpenChange(false);
//     } catch (error) {
//       console.error('Error creating ticket:', error);
//       // TODO: Show error to user
//     } finally {
//       setIsSubmitting(false);
//     }
//   };
    
//   return (
//     <Dialog open={open} onOpenChange={onOpenChange}>
//       <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
//         <DialogHeader>
//           <DialogTitle>Create New Ticket</DialogTitle>
//           <DialogDescription>
//             Fill in the details to create a new ticket
//           </DialogDescription>
//         </DialogHeader>

//         <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
//           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//             <div className="space-y-2">
//               <Label htmlFor="title">Title *</Label>
//               <Input
//                 id="title"
//                 {...form.register('title')}
//                 placeholder="Enter ticket title"
//               />
//               {form.formState.errors.title && (
//                 <p className="text-sm text-red-500">{form.formState.errors.title.message}</p>
//               )}
//             </div>

//             <div className="space-y-2">
//               <Label htmlFor="type">Type *</Label>
//               <Controller
//                 name="type"
//                 control={form.control}
//                 render={({ field }) => (
//                   <Select onValueChange={field.onChange} value={field.value}>
//                     <SelectTrigger>
//                       <SelectValue placeholder="Select type" />
//                     </SelectTrigger>
//                     <SelectContent>
//                       <SelectItem value="Epic">🏆 Epic</SelectItem>
//                       <SelectItem value="Story">📖 Story</SelectItem>
//                       <SelectItem value="Task">✅ Task</SelectItem>
//                       <SelectItem value="Bug">🐛 Bug</SelectItem>
//                       <SelectItem value="Subtask">📋 Subtask</SelectItem>
//                     </SelectContent>
//                   </Select>
//                 )}
//               />
//             </div>

//             <div className="space-y-2">
//               <Label htmlFor="priority">Priority *</Label>
//                <Controller
//                 name="priority"
//                 control={form.control}
//                 render={({ field }) => (
//                   <Select onValueChange={field.onChange} value={field.value}>
//                     <SelectTrigger>
//                       <SelectValue placeholder="Select priority" />
//                     </SelectTrigger>
//                     <SelectContent>
//                       <SelectItem value="Highest">🔴 Highest</SelectItem>
//                       <SelectItem value="High">🟠 High</SelectItem>
//                       <SelectItem value="Medium">🟡 Medium</SelectItem>
//                       <SelectItem value="Low">🔵 Low</SelectItem>
//                       <SelectItem value="Lowest">⚪ Lowest</SelectItem>
//                     </SelectContent>
//                   </Select>
//                 )}
//               />
//             </div>

//             <div className="space-y-2">
//               <Label htmlFor="assigneeId">Assignee</Label>
//               <Controller
//                 name="assigneeId"
//                 control={form.control}
//                 render={({ field }) => (
//                   <Select onValueChange={field.onChange} value={field.value || UNASSIGNED_VALUE}>
//                     <SelectTrigger>
//                       <SelectValue placeholder="Select assignee" />
//                     </SelectTrigger>
//                     <SelectContent>
//                       <SelectItem value={UNASSIGNED_VALUE}>Unassigned</SelectItem>
//                       {validUsers.map((user) => (
//                         <SelectItem key={user.id} value={String(user.id)}>
//                           {user.name}
//                         </SelectItem>
//                       ))}
//                     </SelectContent>
//                   </Select>
//                 )}
//               />
//             </div>

//             {(watchedType === 'Story' || watchedType === 'Task') && (
//               <div className="space-y-2">
//                 <Label htmlFor="storyPoints">Story Points</Label>
//                 <Input
//                   id="storyPoints"
//                   type="number"
//                   min="0"
//                   {...form.register('storyPoints', {setValueAs: (v) => (v === "" ? undefined : parseInt(v, 10))})}
//                   placeholder="Enter story points"
//                 />
//               </div>
//             )}

//             {watchedType === 'Subtask' && (
//               <div className="space-y-2">
//                 <Label htmlFor="parentId">Parent Ticket</Label>
//                  <Controller
//                   name="parentId"
//                   control={form.control}
//                   render={({ field }) => (
//                     <Select
//                       onValueChange={field.onChange}
//                       value={field.value || ""} // Use "" for placeholder with controlled component
//                     >
//                       <SelectTrigger>
//                         <SelectValue placeholder="Select parent ticket" />
//                       </SelectTrigger>
//                       <SelectContent>
//                         {parentCandidates.map((ticket) => (
//                           <SelectItem key={ticket.id} value={ticket.id}>
//                             {ticket.key} - {ticket.title}
//                           </SelectItem>
//                         ))}
//                       </SelectContent>
//                     </Select>
//                   )}
//                 />
//               </div>
//             )}

//             {(watchedType === 'Story' || watchedType === 'Task' || watchedType === 'Bug') && epics.length > 0 && (
//               <div className="space-y-2">
//                 <Label htmlFor="epicId">Epic</Label>
//                 <Controller
//                   name="epicId"
//                   control={form.control}
//                   render={({ field }) => (
//                     <Select
//                       onValueChange={field.onChange}
//                       value={field.value || NO_EPIC_VALUE}
//                     >
//                       <SelectTrigger>
//                         <SelectValue placeholder="Select epic" />
//                       </SelectTrigger>
//                       <SelectContent>
//                         <SelectItem value={NO_EPIC_VALUE}>No Epic</SelectItem>
//                         {epics.map((epic) => (
//                           <SelectItem key={epic.id} value={epic.id}>
//                             {epic.key} - {epic.title}
//                           </SelectItem>
//                         ))}
//                       </SelectContent>
//                     </Select>
//                   )}
//                 />
//               </div>
//             )}

//             <div className="space-y-2">
//               <Label htmlFor="startDate">Start Date</Label>
//               <Input
//                 id="startDate"
//                 type="date"
//                 {...form.register('startDate')}
//               />
//             </div>

//             <div className="space-y-2">
//               <Label htmlFor="endDate">End Date</Label>
//               <Input
//                 id="endDate"
//                 type="date"
//                 {...form.register('endDate')}
//               />
//             </div>
//           </div>

//           <div className="space-y-2">
//             <Label htmlFor="description">Description *</Label>
//             <Textarea
//               id="description"
//               {...form.register('description')}
//               placeholder="Enter ticket description"
//               rows={4}
//             />
//             {form.formState.errors.description && (
//               <p className="text-sm text-red-500">{form.formState.errors.description.message}</p>
//             )}
//           </div>

//           <div className="space-y-2">
//             <Label htmlFor="labels">Labels</Label>
//             <Input
//               id="labels"
//               {...form.register('labels')}
//               placeholder="Enter labels separated by commas"
//             />
//           </div>

//           <div className="flex justify-end space-x-2 pt-4">
//             <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
//               Cancel
//             </Button>
//             <Button type="submit" disabled={isSubmitting}>
//               {isSubmitting ? 'Creating...' : 'Create Ticket'}
//             </Button>
//           </div>
//         </form>
//       </DialogContent>
//     </Dialog>
//   );
// }
