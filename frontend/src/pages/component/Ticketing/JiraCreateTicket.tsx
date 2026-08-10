// import { useState, useEffect } from "react";
// import { useForm, Controller } from "react-hook-form";
// import { zodResolver } from "@hookform/resolvers/zod";
// import * as z from "zod";
// import { Button } from "@/@/components/ui/button";
// import { Input } from "@/@/components/ui/input";
// import { Label } from "@/@/components/ui/label";
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from "@/@/components/ui/select";
// import { Textarea } from "@/@/components/ui/textarea";
// import {
//   Dialog,
//   DialogContent,
//   DialogHeader,
//   DialogTitle,
// } from "@/@/components/ui/dialog";
// import { Avatar, AvatarFallback, AvatarImage } from "@/@/components/ui/avatar";
// import { Card, CardContent } from "@/@/components/ui/card";
// import { Ticket, User, TicketType, TicketPriority, CreateTicketInput } from "./types/ticket";
// import {
//   ChevronDown,
//   Search,
//   User as UserIcon,
//   Trophy,
//   BookOpen,
//   CheckSquare,
//   Bug,
//   FileText,
//   X,
// } from "lucide-react";
// import { realApi } from "./services/mockApi";

// const NO_EPIC_VALUE = "_NO_EPIC_";

// const ticketSchema = z.object({
//   title: z.string().min(1, "Summary is required"),
//   description: z.string().optional(),
//   type: z.string(), // Changed from enum to string
//   priority: z.string(), // Changed from enum to string
//   assigneeId: z.string().optional(),
//   startDate: z.string().optional(),
//   endDate: z.string().optional(),
//   storyPoints: z.number().min(0).max(100).optional(),
//   labels: z.string().optional(),
//   parentId: z.string().optional(),
//   epicId: z.string().optional(),
// });

// type TicketFormData = z.infer<typeof ticketSchema>;

// interface JiraCreateTicketProps {
//   open: boolean;
//   onOpenChange: (open: boolean) => void;
//   onTicketCreated: (ticket: Ticket) => void;
//   users: User[];
//   tickets: Ticket[];
//   currentUser: User;
// }

// const issueTypes = [
//   {
//     value: "Epic" as TicketType,
//     label: "Epic",
//     icon: Trophy,
//     color: "text-purple-600",
//     description: "A large body of work that can be broken down into stories",
//   },
//   {
//     value: "Story" as TicketType,
//     label: "Story",
//     icon: BookOpen,
//     color: "text-green-600",
//     description: "A feature or requirement from the user perspective",
//   },
//   {
//     value: "Task" as TicketType,
//     label: "Task",
//     icon: CheckSquare,
//     color: "text-blue-600",
//     description: "A task that needs to be done",
//   },
//   {
//     value: "Bug" as TicketType,
//     label: "Bug",
//     icon: Bug,
//     color: "text-red-600",
//     description: "A problem that impairs or prevents function",
//   },
//   {
//     value: "Subtask" as TicketType,
//     label: "Sub-task",
//     icon: FileText,
//     color: "text-gray-600",
//     description: "A subtask of another issue",
//   },
// ];

// const priorities: { value: TicketPriority; label: string; icon: string; color: string }[] = [
//   { value: "Highest", label: "Highest", icon: "🔴", color: "text-red-600" },
//   { value: "High", label: "High", icon: "🟠", color: "text-orange-600" },
//   { value: "Medium", label: "Med", icon: "🟡", color: "text-yellow-600" },
//   { value: "Low", label: "Low", icon: "🔵", color: "text-blue-600" },
//   { value: "Lowest", label: "Lowest", icon: "⚪", color: "text-gray-600" },
// ];

// export function JiraCreateTicket({
//   open,
//   onOpenChange,
//   onTicketCreated,
//   users,
//   tickets,
//   currentUser,
// }: JiraCreateTicketProps) {
//   const [isSubmitting, setIsSubmitting] = useState(false);
//   const [assigneeSearch, setAssigneeSearch] = useState("");
//   const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false);
//   const [selectedAssignee, setSelectedAssignee] = useState<User | null>(null);

//   const form = useForm<TicketFormData>({
//     resolver: zodResolver(ticketSchema),
//     defaultValues: {
//       title: "",
//       description: "",
//       type: "Story",
//       priority: "Medium",
//       epicId: NO_EPIC_VALUE,
//       parentId: undefined,
//       storyPoints: undefined,
//       labels: "",
//       startDate: "",
//       endDate: "",
//     },
//   });

//   useEffect(() => {
//     if (open) {
//       form.reset({
//         title: "",
//         description: "",
//         type: "Story",
//         priority: "Medium",
//         epicId: NO_EPIC_VALUE,
//         parentId: undefined,
//         storyPoints: undefined,
//         labels: "",
//         startDate: "",
//         endDate: "",
//       });
//       setSelectedAssignee(null);
//       setAssigneeSearch("");
//     }
//   }, [open, form]);

//   const epics = tickets.filter(
//     (ticket) => ticket.type === "Epic" && ticket.id && ticket.id !== ""
//   );
//   const parentCandidates = tickets.filter(
//     (ticket) =>
//       (ticket.type === "Story" || ticket.type === "Task") &&
//       ticket.id &&
//       ticket.id !== ""
//   );

//   const filteredUsers = users.filter(
//     (user) =>
//       user.id &&
//       user.id !== "" &&
//       (user.name.toLowerCase().includes(assigneeSearch.toLowerCase()) ||
//         user.email.toLowerCase().includes(assigneeSearch.toLowerCase()))
//   );

//   const onSubmit = async (data: TicketFormData) => {
//     setIsSubmitting(true);
//     try {
//       // Create a complete ticket data object with all required fields
//       const ticketData: Omit<Ticket, "id" | "key" | "createdAt" | "updatedAt" | "comments"> = {
//         title: data.title,
//         description: data.description || "",
//         type: data.type as string,
//         status: "To Do" as const,
//         priority: data.priority as TicketPriority,
//   reporter: currentUser.id as string,  // 🔑 use ID instead of full User object
//   assignee: selectedAssignee?.id as string,    
//       // assignee: selectedAssignee || undefined,
//         start_date: data.startDate || undefined ,
//         end_date: data.endDate || undefined,
//         storyPoints:
//           data.type === "Story" || data.type === "Task"
//             ? data.storyPoints === undefined
//               ? undefined
//               : Number(data.storyPoints)
//             : undefined,
//         labels: data.labels
//           ? data.labels.split(",").map((l) => l.trim()).filter(Boolean)
//           : [],
//         parentId:
//           data.type === "Subtask" && data.parentId
//             ? data.parentId
//             : undefined,
//         epicId:
//           (data.type === "Story" || data.type === "Task") &&
//           data.epicId &&
//           data.epicId !== NO_EPIC_VALUE
//             ? data.epicId
//             : undefined,
//         // Add any missing required fields with default values
//         zone: "default",
//         ticket_severity: "Medium",
//         // updated_at: new Date().toISOString(),
//         alert_id: null,
//         alert_section: "",
//         // Add other required fields based on your Ticket type definition
//         // You may need to adjust these based on your actual Ticket interface
//       };

//       const newTicket = await realApi.createTicket(ticketData);
//       onTicketCreated(newTicket);
//       onOpenChange(false);
//     } catch (error) {
//       console.error("Error creating ticket:", error);
//     } finally {
//       setIsSubmitting(false);
//     }
//   };

//   return (
//     <Dialog open={open} onOpenChange={onOpenChange}>
//       <DialogContent className="max-w-4xl max-h-[95vh] overflow-hidden p-0">
//         <DialogHeader className="px-6 py-4 border-b bg-gray-50">
//           <DialogTitle className="text-xl font-semibold">
//             Create issue
//           </DialogTitle>
//         </DialogHeader>

//         <form
//           onSubmit={form.handleSubmit(onSubmit)}
//           className="flex flex-col h-[calc(95vh-65px)]"
//         >
//           <div className="flex-1 overflow-y-auto px-6 py-6">
//             <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
//               {/* Left Column */}
//               <div className="lg:col-span-2 space-y-6">
//                 {/* Project */}
//                 <div className="space-y-1">
//                   <Label className="text-xs font-medium text-gray-700">
//                     Project *
//                   </Label>
//                   <div className="flex items-center space-x-2 p-2 border rounded-md bg-gray-50 text-sm">
//                     <div className="w-5 h-5 bg-blue-500 rounded text-white text-xs flex items-center justify-center font-bold">
//                       P
//                     </div>
//                     <span>Sample Project (PROJ)</span>
//                   </div>
//                 </div>

//                 {/* Issue Type */}
//                 <div className="space-y-1">
//                   <Label className="text-xs font-medium text-gray-700">
//                     Issue Type *
//                   </Label>
//                   <Controller
//                     name="type"
//                     control={form.control}
//                     render={({ field }) => (
//                       <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
//                         {issueTypes.map((type) => {
//                           const Icon = type.icon;
//                           return (
//                             <Card
//                               key={type.value as string}
//                               className={`cursor-pointer transition-all ${
//                                 field.value === type.value
//                                   ? "ring-2 ring-blue-500 bg-blue-50"
//                                   : "hover:bg-gray-50"
//                               }`}
//                               onClick={() => field.onChange(type.value)}
//                             >
//                               <CardContent className="p-3">
//                                 <div className="flex items-center space-x-2">
//                                   <Icon className={`h-4 w-4 ${type.color}`} />
//                                   <span className="text-sm font-medium">
//                                     {type.label}
//                                   </span>
//                                 </div>
//                                 <p className="text-xs text-gray-500 mt-1 line-clamp-2">
//                                   {type.description}
//                                 </p>
//                               </CardContent>
//                             </Card>
//                           );
//                         })}
//                       </div>
//                     )}
//                   />
//                 </div>

//                 <hr />

//                 {/* Summary */}
//                 <div className="space-y-1">
//                   <Label
//                     htmlFor="title"
//                     className="text-xs font-medium text-gray-700"
//                   >
//                     Summary *
//                   </Label>
//                   <Input
//                     id="title"
//                     {...form.register("title")}
//                     placeholder="What needs to be done?"
//                     className="text-sm"
//                   />
//                   {form.formState.errors.title && (
//                     <p className="text-xs text-red-500 mt-1">
//                       {form.formState.errors.title.message}
//                     </p>
//                   )}
//                 </div>

//                 {/* Description */}
//                 <div className="space-y-1">
//                   <Label
//                     htmlFor="description"
//                     className="text-xs font-medium text-gray-700"
//                   >
//                     Description
//                   </Label>
//                   <div className="border rounded-md">
//                     <div className="border-b px-3 py-2 bg-gray-50 flex items-center space-x-2 text-xs text-gray-600">
//                       <span>Normal text</span>
//                       <span>•</span>
//                       <span>**Bold**</span>
//                       <span>•</span>
//                       <span>_Italic_</span>
//                       <span>•</span>
//                       <span>`Code`</span>
//                     </div>
//                     <Textarea
//                       id="description"
//                       {...form.register("description")}
//                       placeholder="Describe the issue in detail..."
//                       className="border-0 resize-none focus:ring-0 min-h-[120px] text-sm"
//                     />
//                   </div>
//                 </div>
//               </div>

//               {/* Right Column */}
//               <div className="space-y-4">
//                 {/* Assignee */}
//                 <div className="space-y-1">
//                   <Label className="text-xs font-medium text-gray-700">
//                     Assignee
//                   </Label>
//                   <div className="relative">
//                     <div
//                       className="flex items-center p-2 border rounded-md cursor-pointer hover:bg-gray-50"
//                       onClick={() => setShowAssigneeDropdown(!showAssigneeDropdown)}
//                     >
//                       {selectedAssignee ? (
//                         <div className="flex items-center space-x-2 flex-1">
//                           <Avatar className="h-6 w-6">
//                             <AvatarImage src={selectedAssignee.avatar} />
//                             <AvatarFallback className="text-xs">
//                               {selectedAssignee.name
//                                 .split(" ")
//                                 .map((n) => n[0])
//                                 .join("")}
//                             </AvatarFallback>
//                           </Avatar>
//                           <span className="text-sm">{selectedAssignee.name}</span>
//                         </div>
//                       ) : (
//                         <div className="flex items-center space-x-2 flex-1 text-gray-500">
//                           <UserIcon className="h-4 w-4" />
//                           <span className="text-sm">Unassigned</span>
//                         </div>
//                       )}
//                       <ChevronDown className="h-4 w-4 text-gray-400" />
//                     </div>

//                     {showAssigneeDropdown && (
//                       <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-md shadow-lg z-50 max-h-64 overflow-y-auto">
//                         <div className="p-2 border-b">
//                           <div className="relative">
//                             <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
//                             <Input
//                               placeholder="Search users..."
//                               value={assigneeSearch}
//                               onChange={(e) => setAssigneeSearch(e.target.value)}
//                               className="pl-8 text-sm"
//                             />
//                           </div>
//                         </div>
//                         <div className="max-h-48 overflow-y-auto">
//                           <div
//                             className="flex items-center space-x-2 p-2 hover:bg-gray-50 cursor-pointer"
//                             onClick={() => {
//                               setSelectedAssignee(null);
//                               setShowAssigneeDropdown(false);
//                             }}
//                           >
//                             <UserIcon className="h-4 w-4 text-gray-400" />
//                             <span className="text-sm text-gray-500">Unassigned</span>
//                           </div>
//                           {filteredUsers.map((user) => (
//                             <div
//                               key={user.id}
//                               className="flex items-center space-x-2 p-2 hover:bg-gray-50 cursor-pointer"
//                               onClick={() => {
//                                 setSelectedAssignee(user);
//                                 setShowAssigneeDropdown(false);
//                               }}
//                             >
//                               <Avatar className="h-6 w-6">
//                                 <AvatarImage src={user.avatar} />
//                                 <AvatarFallback className="text-xs">
//                                   {user.name
//                                     .split(" ")
//                                     .map((n) => n[0])
//                                     .join("")}
//                                 </AvatarFallback>
//                               </Avatar>
//                               <div>
//                                 <div className="text-sm font-medium">{user.name}</div>
//                                 <div className="text-xs text-gray-500">{user.email}</div>
//                               </div>
//                             </div>
//                           ))}
//                         </div>
//                       </div>
//                     )}
//                   </div>
//                 </div>

//                 {/* Reporter */}
//                 <div className="space-y-1">
//                   <Label className="text-xs font-medium text-gray-700">
//                     Reporter
//                   </Label>
//                   <div className="flex items-center space-x-2 p-2 border rounded-md bg-gray-50">
//                     <Avatar className="h-6 w-6">
//                       <AvatarImage src={currentUser.avatar} />
//                       <AvatarFallback className="text-xs">
//                         {currentUser.name
//                           .split(" ")
//                           .map((n) => n[0])
//                           .join("")}
//                       </AvatarFallback>
//                     </Avatar>
//                     <span className="text-sm">{currentUser.name}</span>
//                   </div>
//                 </div>

//                 {/* Priority */}
//                 <div className="space-y-1">
//                   <Label className="text-xs font-medium text-gray-700">
//                     Priority
//                   </Label>
//                   <Controller
//                     name="priority"
//                     control={form.control}
//                     render={({ field }) => (
//                       <Select
//                         value={field.value}
//                         onValueChange={field.onChange}
//                       >
//                         <SelectTrigger className="text-sm">
//                           <SelectValue placeholder="Select priority" />
//                         </SelectTrigger>
//                         <SelectContent>
//                           {priorities.map((priority) => (
//                             <SelectItem key={priority.value} value={priority.value}>
//                               <span className="mr-2">{priority.icon}</span>
//                               {priority.label}
//                             </SelectItem>
//                           ))}
//                         </SelectContent>
//                       </Select>
//                     )}
//                   />
//                 </div>

//                 {/* Labels */}
//                 <div className="space-y-1">
//                   <Label
//                     htmlFor="labels"
//                     className="text-xs font-medium text-gray-700"
//                   >
//                     Labels
//                   </Label>
//                   <Input
//                     id="labels"
//                     {...form.register("labels")}
//                     placeholder="Comma-separated labels"
//                     className="text-sm"
//                   />
//                 </div>

//                 {/* Story Points - only for Story and Task */}
//                 {(form.watch("type") === "Story" || form.watch("type") === "Task") && (
//                   <div className="space-y-1">
//                     <Label
//                       htmlFor="storyPoints"
//                       className="text-xs font-medium text-gray-700"
//                     >
//                       Story Points
//                     </Label>
//                     <Input
//                       id="storyPoints"
//                       type="number"
//                       min="0"
//                       max="100"
//                       {...form.register("storyPoints", { 
//                         valueAsNumber: true,
//                         setValueAs: (value) => value === "" ? undefined : Number(value)
//                       })}
//                       placeholder="Estimate effort"
//                       className="text-sm"
//                     />
//                   </div>
//                 )}

//                 {/* Epic Link - only for Story and Task */}
//                 {(form.watch("type") === "Story" || form.watch("type") === "Task") && (
//                   <div className="space-y-1">
//                     <Label className="text-xs font-medium text-gray-700">
//                       Epic Link
//                     </Label>
//                     <Controller
//                       name="epicId"
//                       control={form.control}
//                       render={({ field }) => (
//                         <Select value={field.value} onValueChange={field.onChange}>
//                           <SelectTrigger className="text-sm">
//                             <SelectValue placeholder="Select epic" />
//                           </SelectTrigger>
//                           <SelectContent>
//                             <SelectItem value={NO_EPIC_VALUE}>No Epic</SelectItem>
//                             {epics.map((epic) => (
//                               <SelectItem key={epic.id} value={String(epic.id!)}>
//                                 {epic.title}
//                               </SelectItem>
//                             ))}
//                           </SelectContent>
//                         </Select>
//                       )}
//                     />
//                   </div>
//                 )}

//                 {/* Parent - only for Subtask */}
//                 {form.watch("type") === "Subtask" && (
//                   <div className="space-y-1">
//                     <Label className="text-xs font-medium text-gray-700">
//                       Parent Issue *
//                     </Label>
//                     <Controller
//                       name="parentId"
//                       control={form.control}
//                       render={({ field }) => (
//                         <Select value={field.value} onValueChange={field.onChange}>
//                           <SelectTrigger className="text-sm">
//                             <SelectValue placeholder="Select parent issue" />
//                           </SelectTrigger>
//                           <SelectContent>
//                             {parentCandidates.map((ticket) => (
//                               <SelectItem key={ticket.id} value={String(ticket.id!)}>
//                                 {ticket.title}
//                               </SelectItem>
//                             ))}
//                           </SelectContent>
//                         </Select>
//                       )}
//                     />
//                   </div>
//                 )}

//                 {/* Date fields */}
//                 <div className="grid grid-cols-2 gap-2">
//                   <div className="space-y-1">
//                     <Label
//                       htmlFor="startDate"
//                       className="text-xs font-medium text-gray-700"
//                     >
//                       Start Date
//                     </Label>
//                     <Input
//                       id="startDate"
//                       type="date"
//                       {...form.register("startDate")}
//                       className="text-sm"
//                     />
//                   </div>
//                   <div className="space-y-1">
//                     <Label
//                       htmlFor="endDate"
//                       className="text-xs font-medium text-gray-700"
//                     >
//                       End Date
//                     </Label>
//                     <Input
//                       id="endDate"
//                       type="date"
//                       {...form.register("endDate")}
//                       className="text-sm"
//                     />
//                   </div>
//                 </div>
//               </div>
//             </div>
//           </div>

//           {/* Footer */}
//           <div className="border-t bg-gray-50 px-6 py-4 flex justify-end items-center">
//             <div className="flex space-x-2">
//               <Button
//                 type="button"
//                 variant="ghost"
//                 onClick={() => onOpenChange(false)}
//               >
//                 Cancel
//               </Button>
//               <Button
//                 type="submit"
//                 disabled={isSubmitting}
//                 className="bg-blue-600 hover:bg-blue-700"
//               >
//                 {isSubmitting ? "Creating..." : "Create"}
//               </Button>
//             </div>
//           </div>
//         </form>
//       </DialogContent>
//     </Dialog>
//   );
// }


import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/@/components/ui/button";
import { Input } from "@/@/components/ui/input";
import { Label } from "@/@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/@/components/ui/select";
import { Textarea } from "@/@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/@/components/ui/avatar";
import { Card, CardContent } from "@/@/components/ui/card";
import { Ticket, User, TicketType, TicketPriority, CreateTicketInput } from "./types/ticket";
import {
  ChevronDown,
  Search,
  User as UserIcon,
  Trophy,
  BookOpen,
  CheckSquare,
  Bug,
  FileText,
  X,
} from "lucide-react";
import { realApi } from "./services/mockApi";

const NO_EPIC_VALUE = "_NO_EPIC_";

const ticketSchema = z.object({
  title: z.string().min(1, "Summary is required"),
  description: z.string().optional(),
  type: z.string(), // Changed from enum to string
  priority: z.string(), // Changed from enum to string
  assigneeId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  storyPoints: z.number().min(0).max(100).optional(),
  labels: z.string().optional(),
  parentId: z.string().optional(),
  epicId: z.string().optional(),
});

type TicketFormData = z.infer<typeof ticketSchema>;

interface JiraCreateTicketProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTicketCreated: (ticket: Ticket) => void;
  users: User[];
  tickets: Ticket[];
  currentUser: User;
}

const issueTypes = [
  {
    value: "Epic" as TicketType,
    label: "Epic",
    icon: Trophy,
    color: "text-purple-600",
    description: "A large body of work that can be broken down into stories",
  },
  {
    value: "Story" as TicketType,
    label: "Story",
    icon: BookOpen,
    color: "text-green-600",
    description: "A feature or requirement from the user perspective",
  },
  {
    value: "Task" as TicketType,
    label: "Task",
    icon: CheckSquare,
    color: "text-blue-600",
    description: "A task that needs to be done",
  },
  {
    value: "Bug" as TicketType,
    label: "Bug",
    icon: Bug,
    color: "text-red-600",
    description: "A problem that impairs or prevents function",
  },
  {
    value: "Subtask" as TicketType,
    label: "Sub-task",
    icon: FileText,
    color: "text-gray-600",
    description: "A subtask of another issue",
  },
];

const priorities: { value: TicketPriority; label: string; icon: string; color: string }[] = [
  { value: "Highest", label: "Highest", icon: "🔴", color: "text-red-600" },
  { value: "High", label: "High", icon: "🟠", color: "text-orange-600" },
  { value: "Medium", label: "Medium", icon: "🟡", color: "text-yellow-600" },
  { value: "Low", label: "Low", icon: "🔵", color: "text-blue-600" },
  { value: "Lowest", label: "Lowest", icon: "⚪", color: "text-gray-600" },
];

export function JiraCreateTicket({
  open,
  onOpenChange,
  onTicketCreated,
  users,
  tickets,
  currentUser,
}: JiraCreateTicketProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [assigneeSearch, setAssigneeSearch] = useState("");
  const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false);
  const [selectedAssignee, setSelectedAssignee] = useState<User | null>(null);

  const form = useForm<TicketFormData>({
    resolver: zodResolver(ticketSchema),
    defaultValues: {
      title: "",
      description: "",
      type: "Story",
      priority: "Medium",
      epicId: NO_EPIC_VALUE,
      parentId: undefined,
      storyPoints: undefined,
      labels: "",
      startDate: "",
      endDate: "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        title: "",
        description: "",
        type: "Story",
        priority: "Medium",
        epicId: NO_EPIC_VALUE,
        parentId: undefined,
        storyPoints: undefined,
        labels: "",
        startDate: "",
        endDate: "",
      });
      setSelectedAssignee(null);
      setAssigneeSearch("");
    }
  }, [open, form]);

  const epics = tickets.filter(
    (ticket) => ticket.type === "Epic" && ticket.id && ticket.id !== ""
  );
  const parentCandidates = tickets.filter(
    (ticket) =>
      (ticket.type === "Story" || ticket.type === "Task") &&
      ticket.id &&
      ticket.id !== ""
  );

  const filteredUsers = users.filter(
    (user) =>
      user.id &&
      user.id !== "" &&
      (user.name.toLowerCase().includes(assigneeSearch.toLowerCase()) ||
        user.email.toLowerCase().includes(assigneeSearch.toLowerCase()))
  );

  const onSubmit = async (data: TicketFormData) => {
    setIsSubmitting(true);
    try {
      // Create a ticket data object with all required fields from the Ticket type
const ticketData: Omit<Ticket, "id" | "key" | "createdAt" | "updatedAt" | "comments"> = {
  title: data.title,
  description: data.description || "",
  type: data.type as string,
  priority: data.priority as TicketPriority,
  status: "To Do" as const,
tid: "",
  reporter: currentUser.id as string,
  assignee: selectedAssignee?.id as string,

  start_date: data.startDate || undefined,
  ticket_end_date: data.endDate || undefined,
  end_date: data.endDate || '',

  storyPoints: (data.type === "Story" || data.type === "Task")
    ? data.storyPoints === undefined ? undefined : Number(data.storyPoints)
    : undefined,

  labels: data.labels
    ? data.labels.split(",").map((l) => l.trim()).filter(Boolean)
    : [],

  parentId: data.type === "Subtask" && data.parentId ? data.parentId : undefined,
  epicId: ((data.type === "Story" || data.type === "Task") &&
           data.epicId &&
           data.epicId !== NO_EPIC_VALUE) ? data.epicId : undefined,

  ticket_id: "",
  ticket_state: "ToDo" as const,
  ticket_severity: "Medium",
  zone: ["default"],
  updated_at: new Date().toISOString(),
  region: "default",
  entity_id: "",
  ticket_status: "Open" as const,
  alert_id: null,
  alert_section: "",
  created_at: new Date().toISOString(),

  ticket_history: [],
  bu: "",
  severity: "Medium",
  location_name: [""],
  escalation_level: 0,
  resolved_at: null,
  closed_at: null,
  service_category: "",
  subcategory: "",
  customer_id: null,
  assigned_to: selectedAssignee ? String(selectedAssignee.id) : null,

  location_id: "",
  linked_alert_id: null,
  interlock_name: "",
  sap_id: [],

  // ✅ Newly required fields from error
  summary: "",
  comment: "",
  avatar: "",
  auditLog: "",
  impact: "Low",
  update_id: "",
   merge_status: "",
  category: "",
  sub_category: "",
};


      const newTicket = await realApi.createTicket(ticketData);
      onTicketCreated(newTicket);
      onOpenChange(false);
    } catch (error) {
      console.error("Error creating ticket:", error);
      // You might want to show an error message to the user here
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-hidden p-0">
        <DialogHeader className="px-6 py-4 border-b bg-gray-50">
          <DialogTitle className="text-xl font-semibold">
            Create issue
          </DialogTitle>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col h-[calc(95vh-65px)]"
        >
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column */}
              <div className="lg:col-span-2 space-y-6">
                {/* Project */}
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-gray-700">
                    Project *
                  </Label>
                  <div className="flex items-center space-x-2 p-2 border rounded-md bg-gray-50 text-sm">
                    <div className="w-5 h-5 bg-blue-500 rounded text-white text-xs flex items-center justify-center font-bold">
                      P
                    </div>
                    <span>Sample Project (PROJ)</span>
                  </div>
                </div>

                {/* Issue Type */}
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-gray-700">
                    Issue Type *
                  </Label>
                  <Controller
                    name="type"
                    control={form.control}
                    render={({ field }) => (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {issueTypes.map((type) => {
                          const Icon = type.icon;
                          return (
                            <Card
                              key={type.value as string}
                              className={`cursor-pointer transition-all ${
                                field.value === type.value
                                  ? "ring-2 ring-blue-500 bg-blue-50"
                                  : "hover:bg-gray-50"
                              }`}
                              onClick={() => field.onChange(type.value)}
                            >
                              <CardContent className="p-3">
                                <div className="flex items-center space-x-2">
                                  <Icon className={`h-4 w-4 ${type.color}`} />
                                  <span className="text-sm font-medium">
                                    {type.label}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                                  {type.description}
                                </p>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    )}
                  />
                </div>

                <hr />

                {/* Summary */}
                <div className="space-y-1">
                  <Label
                    htmlFor="title"
                    className="text-xs font-medium text-gray-700"
                  >
                    Summary *
                  </Label>
                  <Input
                    id="title"
                    {...form.register("title")}
                    placeholder="What needs to be done?"
                    className="text-sm"
                  />
                  {form.formState.errors.title && (
                    <p className="text-xs text-red-500 mt-1">
                      {form.formState.errors.title.message}
                    </p>
                  )}
                </div>

                {/* Description */}
                <div className="space-y-1">
                  <Label
                    htmlFor="description"
                    className="text-xs font-medium text-gray-700"
                  >
                    Description
                  </Label>
                  <div className="border rounded-md">
                    <div className="border-b px-3 py-2 bg-gray-50 flex items-center space-x-2 text-xs text-gray-600">
                      <span>Normal text</span>
                      <span>•</span>
                      <span>**Bold**</span>
                      <span>•</span>
                      <span>_Italic_</span>
                      <span>•</span>
                      <span>`Code`</span>
                    </div>
                    <Textarea
                      id="description"
                      {...form.register("description")}
                      placeholder="Describe the issue in detail..."
                      className="border-0 resize-none focus:ring-0 min-h-[120px] text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-4">
                {/* Assignee */}
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-gray-700">
                    Assignee
                  </Label>
                  <div className="relative">
                    <div
                      className="flex items-center p-2 border rounded-md cursor-pointer hover:bg-gray-50"
                      onClick={() => setShowAssigneeDropdown(!showAssigneeDropdown)}
                    >
                      {selectedAssignee ? (
                        <div className="flex items-center space-x-2 flex-1">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={selectedAssignee.avatar} />
                            <AvatarFallback className="text-xs">
                              {selectedAssignee.name
                                .split(" ")
                                .map((n) => n[0])
                                .join("")}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm">{selectedAssignee.name}</span>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2 flex-1 text-gray-500">
                          <UserIcon className="h-4 w-4" />
                          <span className="text-sm">Unassigned</span>
                        </div>
                      )}
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    </div>

                    {showAssigneeDropdown && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-md shadow-lg z-50 max-h-64 overflow-y-auto">
                        <div className="p-2 border-b">
                          <div className="relative">
                            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                              placeholder="Search users..."
                              value={assigneeSearch}
                              onChange={(e) => setAssigneeSearch(e.target.value)}
                              className="pl-8 text-sm"
                            />
                          </div>
                        </div>
                        <div className="max-h-48 overflow-y-auto">
                          <div
                            className="flex items-center space-x-2 p-2 hover:bg-gray-50 cursor-pointer"
                            onClick={() => {
                              setSelectedAssignee(null);
                              setShowAssigneeDropdown(false);
                            }}
                          >
                            <UserIcon className="h-4 w-4 text-gray-400" />
                            <span className="text-sm text-gray-500">Unassigned</span>
                          </div>
                          {filteredUsers.map((user) => (
                            <div
                              key={user.id}
                              className="flex items-center space-x-2 p-2 hover:bg-gray-50 cursor-pointer"
                              onClick={() => {
                                setSelectedAssignee(user);
                                setShowAssigneeDropdown(false);
                              }}
                            >
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={user.avatar} />
                                <AvatarFallback className="text-xs">
                                  {user.name
                                    .split(" ")
                                    .map((n) => n[0])
                                    .join("")}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="text-sm font-medium">{user.name}</div>
                                <div className="text-xs text-gray-500">{user.email}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Reporter */}
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-gray-700">
                    Reporter
                  </Label>
                  <div className="flex items-center space-x-2 p-2 border rounded-md bg-gray-50">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={currentUser.avatar} />
                      <AvatarFallback className="text-xs">
                        {currentUser.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{currentUser.name}</span>
                  </div>
                </div>

                {/* Priority */}
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-gray-700">
                    Priority
                  </Label>
                  <Controller
                    name="priority"
                    control={form.control}
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger className="text-sm">
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                        <SelectContent>
                          {priorities.map((priority) => (
                            <SelectItem key={priority.value} value={priority.value}>
                              <span className="mr-2">{priority.icon}</span>
                              {priority.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                {/* Labels */}
                <div className="space-y-1">
                  <Label
                    htmlFor="labels"
                    className="text-xs font-medium text-gray-700"
                  >
                    Labels
                  </Label>
                  <Input
                    id="labels"
                    {...form.register("labels")}
                    placeholder="Comma-separated labels"
                    className="text-sm"
                  />
                </div>

                {/* Story Points - only for Story and Task */}
                {(form.watch("type") === "Story" || form.watch("type") === "Task") && (
                  <div className="space-y-1">
                    <Label
                      htmlFor="storyPoints"
                      className="text-xs font-medium text-gray-700"
                    >
                      Story Points
                    </Label>
                    <Input
                      id="storyPoints"
                      type="number"
                      min="0"
                      max="100"
                      {...form.register("storyPoints", { 
                        valueAsNumber: true,
                        setValueAs: (value) => value === "" ? undefined : Number(value)
                      })}
                      placeholder="Estimate effort"
                      className="text-sm"
                    />
                  </div>
                )}

                {/* Epic Link - only for Story and Task */}
                {(form.watch("type") === "Story" || form.watch("type") === "Task") && (
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-gray-700">
                      Epic Link
                    </Label>
                    <Controller
                      name="epicId"
                      control={form.control}
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger className="text-sm">
                            <SelectValue placeholder="Select epic" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NO_EPIC_VALUE}>No Epic</SelectItem>
                            {epics.map((epic) => (
                              <SelectItem key={epic.id} value={String(epic.id!)}>
                                {epic.title}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                )}

                {/* Parent - only for Subtask */}
                {form.watch("type") === "Subtask" && (
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-gray-700">
                      Parent Issue *
                    </Label>
                    <Controller
                      name="parentId"
                      control={form.control}
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger className="text-sm">
                            <SelectValue placeholder="Select parent issue" />
                          </SelectTrigger>
                          <SelectContent>
                            {parentCandidates.map((ticket) => (
                              <SelectItem key={ticket.id} value={String(ticket.id!)}>
                                {ticket.title}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                )}

                {/* Date fields */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label
                      htmlFor="startDate"
                      className="text-xs font-medium text-gray-700"
                    >
                      Start Date
                    </Label>
                    <Input
                      id="startDate"
                      type="date"
                      {...form.register("startDate")}
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label
                      htmlFor="endDate"
                      className="text-xs font-medium text-gray-700"
                    >
                      End Date
                    </Label>
                    <Input
                      id="endDate"
                      type="date"
                      {...form.register("endDate")}
                      className="text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t bg-gray-50 px-6 py-4 flex justify-end items-center">
            <div className="flex space-x-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isSubmitting ? "Creating..." : "Create"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}