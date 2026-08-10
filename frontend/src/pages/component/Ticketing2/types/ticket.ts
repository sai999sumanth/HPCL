export interface Ticket {
  end_date: any;
  id: number|string;
  tid:string;
  zone: string[]; // This is Zone ID
  ticket_severity: 'Low' | 'Medium' | 'High' | 'Critical';
  updated_at: string;
  alert_id: string;
  ticket_id: string; // String ticket identifier like TAS_...
  region: string;
  assignee: string | null;
  assignee_name?: string[];
  assignee_mail?: string[];
  entity_id: string | null;
  ticket_status: 'Open' | 'Closed' | 'Pending'; 
  reporter: string; 
  reporter_email?: string; 
  ticket_state:
    | 'ToDo'
    | 'InProgress'
    | 'Resolved'
    | 'OnHold'
    | 'Cancelled'
    | 'ReOpen'
    | 'OnCompleted'
    | 'Open'
    | 'Escalated'
    | 'Updated'
    | 'Completed'
    | 'Reopen'
    // New API enum values (exact, with spaces/casing) for Ticketing2 board
    | 'Updated By Initiator'
    | 'Returned By Occ'
    | 'Reviewed By Occ'
    | 'Returned By OCC'
    | 'Reviewed By OCC';
  ticket_history: any[];
  bu: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  location_name: string[]; // Plant name
  location_id: string; // Plant ID
  start_date: string;
 linked_alert_id:any;
  ticket_end_date: string | null;
  interlock_name: string;
  alert_section: string;
  sap_id: string[];
  /** Optional employee_id(s) as returned by the API (array or scalar). */
  employee_id?: (string | number)[] | string | number;
  /** Optional employee_role(s) corresponding to assignees. */
  employee_role?: string[] | string;
  summary: string;
  comment: string;
  description:string;
  created_at: string;
  category: string;
  sub_category: string; 
  ticket_name?: string; 
  alert_type?: string;  
  sop_id?: string; 
    status: string; 
  title:string;
  type:string;
   key: string;
   priority:string;
   storyPoints:number;
 labels?:string[]
avatar: any;
auditLog:string;
parentId:string;
epicId:string;
  impact: "Low" | "Medium" | "High"; 
   resolved_at: string | null;       
  closed_at: string | null;          
  service_category: string;         
  subcategory: string;               
  customer_id: string | null; 
  escalation_level: string | number | null;
 assigned_to: string | number | null;
 sla_breached?: boolean;
merge_status:string;
  root_cause?: string;
  resolution?: string;
update_id:string;
file_attachment?: string[];
  file_attachment_name?: string;
  file_attachment_id?: string;
  parent_id?: string; // Parent ticket ID for subtasks - will be included if present in API response
  subtask_id?: string[]; // Array of subtask IDs - will be included if present in API response
  truck_no?: string[];
  order_id?: string[];
   merge_history?: {
    action_msg: string;
    action_type: string;
    merge_ticket_id: string[];
    comment?: string;
    allocated_time?: string;
    processed_time?: string;
    ticket_id:string;
    parent_id?: string; // Parent ticket ID for subtasks - will be included if present in API response
    subtask_id?: string[]; // Array of subtask IDs - will be included if present in API response
  }[];
  auto_ticket_close?: string;
}

export type CreateTicketInput = {
  title: string;
  description?: string;
  type: TicketType;
  status: string;
  priority: TicketPriority;
  reporter: string;   // userId
  assignee?: string;  // userId
  start_date?: string;
  end_date: string;
  storyPoints?: number;
  labels?: string[];
  parentId?: string;
  epicId?: string;
  alert_section?: string;
}

export interface TicketStatus{
}

export interface User {
id:number|string;
name:string;
 avatar: any;
 email:string
}

export interface TicketType{
}

export type TicketPriority = "Highest" | "High" | "Medium" | "Low" | "Lowest";

export interface ApiResponse {
  data: Ticket[];
  count?: number;
  total?: number;
  /** Some ticketing/PM list endpoints return total under this key. */
  total_orders_count?: number;
  bu_counts?: {
    RO?: number;
    BU?: number;
    TAS?: number;
    LPG?: number;
  };
}
export interface  ApiTicket{
}

export interface CreateOrFetchAlertTypesPayload {
  bu: string;
  alert_section: string;
  ticket_section?: string;
  sop_id?: string;
  sap_id: string[];
  location_name: string[];
  zone: string[];
  region: string;
  sales_area?: string;
  alert_type: string|string[];
  assignee?: string;
  assignee_name?: string[];
  assignee_mail?: string[];
  /** Optional employee_id(s) corresponding to assignee_name/assignee_mail */
  employee_id?: (string | number)[] | string | number;
  /** Optional employee_role(s) corresponding to assignee_name/assignee_mail */
  employee_role?: string[] | string;
  summary: string;
  description: string;
  ticket_state: Ticket['ticket_state'];
  ticket_severity: Ticket['ticket_severity'];
  comment: string;
  start_date: string;
  ticket_end_date?: string;
  ticket_name?: string;
  alert_id?: string;
  file_attachment?: string[];
  file_attachment_name?: string;
  file_attachment_id?: string;
  linked_alert_id:any;
  selected_task_id?: string;
  update_id?: string;
  parent_id?: string;
  subtask_id?: string[];
  truck_no?: string[];
  order_id?: string[];
  category?: string[];
  sub_category?: string[];
  remarks?: string;
  reason?: string;
  auto_ticket_close?: string;
}

export interface CreateTicketFormInitData {
  reporter: string | null; 
  alert_types: {
    alert_type: string;
    sop_id: string;
  }[];
}

export interface EditTicketPayload {
ticket_id: string;
update_id: string;
tid?:string|number;
bu?: string;
alert_section?: string;
ticket_section?: string;
sop_id?: string;
sap_id?: string[];
location_name?: string[];
zone?: string[];
region?: string;
sales_area?: string;
alert_type?: string | string[];
assignee?: string;
assignee_name?: string[];
assignee_mail?: string[];
employee_id?: (string | number)[] | string | number;
employee_role?: string[] | string;
summary?: string;
description?: string;
ticket_state?: Ticket['ticket_state'];
ticket_severity?: Ticket['ticket_severity'];
comment?: string;
ticket_name?: string;
alert_id?: string;
interlock_name?: string | string[];
linked_alert_id: any; // must be array

file_attachment?: string | string[];
file_attachment_name?: string;
file_attachment_id?: string;

start_date: string; // required by API
ticket_end_date?: string;
 parent_id?: string; // Parent ticket ID for subtasks
  subtask_id?: string[];
  truck_no?: string[];
  category?: string[];
  sub_category?: string[];
  remarks?: string;
  reason?: string;
  auto_ticket_close?: string;
  reassigne_due_date?: string;
  current_date_ist?: string;
  re_assingee_mail?: string[];
  re_assingee_employee_id?: string[];
}
