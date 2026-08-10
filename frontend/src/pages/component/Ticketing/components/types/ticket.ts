// export interface LinkedAlert {
//   unique_id: string;
//   sap_id?: string;
//   location_name?: string;
//   interlock_name?: string;
//   created_at?: string | null;
// }


// export interface Ticket {
//   // tid(file: File, ticket_id: any, tid: any): { file_attachment: any; file_attachment_name: string; file_attachment_id: any; } | PromiseLike<{ file_attachment: any; file_attachment_name: string; file_attachment_id: any; }>;
//   id: number|string;
//   tid:string|number;
//   zone: string; // This is Zone ID
//   ticket_severity: 'Low' | 'Medium' | 'High' | 'Critical';
//   updated_at: string;
//   alert_id: string;
//   ticket_id: any; // String ticket identifier like TAS_...
//   region: string;
//   assignee: string;
//   entity_id: string | null;
//   ticket_status: 'Open' | 'Closed' | 'Pending'; 
//   reporter: string; 
//   reporter_email?: string; 
//   ticket_state: 'ToDo' | 'InProgress' | 'Resolved' | 'OnHold' | 'Cancelled' | 'ReOpen' | 'OnCompleted' | 'Open' | 'Escalated' | 'Updated' | 'Reopen';
//   ticket_history: any[];
//   bu: string;
//   location_name: string; // Plant name
//   location_id: string; // Plant ID
//   start_date: string;
//   linked_alert_id: any; 
//   end_date: string | null;
//   interlock_name: string;
//   alert_section: string;
//   sap_id: string[];
//   summary: string;
//   comment: string;
//   description:string;
//   created_at: string;
//   category?: string; 
//   ticket_name?: string; 
//   alert_type?: string;  
//   sop_id?: string; 
//    linked_alerts?: LinkedAlert[];
//  update_id:string;
//  file_attachment?: string[];
//   file_attachment_name?: string;
//   file_attachment_id?: string;
//    merge_history?: {
//     action_msg: string;
//     action_type: string;
//     merge_ticket_id: string[];
//     comment?: string;
//     allocated_time?: string;
//     processed_time?: string;
//       ticket_id:string;
//   }[];
//   merge_status:string;
// }

// export interface ApiResponse {
//   data: Ticket[];
//   count: number;
//   total: number;
// }

// // For the POST /api/ticketing/create_ticket payload (when actually creating OR when fetching alert types)
// // export interface CreateOrFetchAlertTypesPayload {
// //   bu: string;
// //   alert_section: string;
// //   sop_id?: string; 
// //   sap_id: string[];
// //   location_name: string; 
// //   zone: string; 
// //   region: string;
// //   alert_type: string|string[]; 
// //   assignee: string;
// //   summary: string; 
// //   description: string; 
// //   ticket_state: Ticket['ticket_state'];
// //   ticket_severity: Ticket['ticket_severity'];
// //   comment: string; 
// //   start_date: string; 
// //   ticket_name?: string; 
// //   alert_id?: string;  
// //   linked_alert_id:string[]|string;
// // }
// export interface CreateOrFetchAlertTypesPayload {
//   bu: string;
//   alert_section: string;
//   sop_id?: string; 
//   sap_id: string[];
//   location_name: string; 
//   zone: string; 
//   region: string;
//   alert_type: string|string[]; 
//   assignee: string;
//   summary: string; 
//   description: string; 
//   ticket_state: Ticket['ticket_state'];
//   ticket_severity: Ticket['ticket_severity'];
//   comment: string; 
//   start_date: string; 
//   ticket_name?: string; 
//   alert_id?: string;  
//   file_attachment?: string[];
//   file_attachment_name?: string;
//   file_attachment_id?: string;
//   linked_alert_id:any;
// }

// // For the response of POST /api/ticketing/create_ticket (when used to fetch initial form data)
// export interface CreateTicketFormInitData {
//   reporter: string | null; // Or specific type if known
//   alert_types: {
//     alert_type: string;
//     sop_id: string;
//   }[];
//   // Add any other initial data fields your API might return here
// }

// // For the PATCH /api/ticketing/{ticket_id} payload (when editing)
// // This can be a subset of CreateOrFetchAlertTypesPayload, only including fields that can be edited.
// // All fields are made optional with Partial, but you can be more specific.
// // It's important that `start_date` is NOT part of the payload for an update,
// // or if it is, it should be the original start_date, not a new one.
// // For simplicity, let's make it similar to CreateOrFetchAlertTypesPayload but without start_date modification.
// // export interface EditTicketPayload {
// //   bu?: string;
// //   alert_section?: string;
// //   sop_id?: string;
// //   sap_id?: string;
// //   location_name?: string;
// //   zone?: string;
// //   region?: string;
// //   alert_type?: string;
// //   assignee?: string;
// //   summary?: string;
// //   description?: string;
// //   ticket_state?: Ticket['ticket_state'];
// //   ticket_severity?: Ticket['ticket_severity'];
// //   comment?: string;
// //   ticket_name?: string;
// //    ticket_id: string;
// //   alert_id?: string;
// //   // start_date is intentionally omitted here as it typically shouldn't be updated
// //   // If your API expects it for some reason (e.g. for validation), add it back but ensure it's the original one
// //   start_date: string; // Keep original start_date for edit, as per TicketFormPage logic
// // linked_alert_id:string[]|string;
// // }
// export interface EditTicketPayload {
// ticket_id: string;
// update_id: string;
// bu?: string;
// alert_section?: string;
// sop_id?: string;
// sap_id?: string;
// location_name?: string;
// zone?: string;
// region?: string;
// alert_type?: string | string[];
// assignee?: string;
// summary?: string;
// description?: string;
// ticket_state?: Ticket['ticket_state'];
// ticket_severity?: Ticket['ticket_severity'];
// comment?: string;
// ticket_name?: string;
// alert_id?: string;

// linked_alert_id:any; // must be array

// file_attachment?: string | string[];
// file_attachment_name?: string;
// file_attachment_id?: string;

// start_date: string; // required by API
// }



export interface LinkedAlert {
  unique_id: string;
  sap_id?: string;
  location_name?: string;
  interlock_name?: string;
  created_at?: string | null;
}


export interface Ticket {
  // tid(file: File, ticket_id: any, tid: any): { file_attachment: any; file_attachment_name: string; file_attachment_id: any; } | PromiseLike<{ file_attachment: any; file_attachment_name: string; file_attachment_id: any; }>;
  id: number|string;
  tid:string|number;
  zone: string[]; // This is Zone ID
  ticket_severity: 'Low' | 'Medium' | 'High' | 'Critical';
  updated_at: string;
  alert_id: string;
  ticket_id: any; // String ticket identifier like TAS_...
  region: string;
  assignee: string;
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
    | 'Reopen'
    // New API enum values (exact, with spaces/casing) for Ticketing board
    | 'Updated By Initiator'
    | 'Returned By Occ'
    | 'Reviewed By Occ'
    | 'Returned By OCC'
    | 'Reviewed By OCC';
  ticket_history: any[];
  bu: string;
  location_name: string[]; // Plant name
  location_id: string; // Plant ID
  start_date: string;
  linked_alert_id: any; 
  ticket_end_date: string | null;
  interlock_name: string;
  alert_section: string;
  sap_id: string[];
  summary: string;
  comment: string;
  description:string;
  created_at: string;
  category?: string | string[];
  sub_category?: string | string[];
  ticket_name?: string; 
  alert_type?: string;  
  sop_id?: string; 
   linked_alerts?: LinkedAlert[];
 update_id:string;
 file_attachment?: string[];
  file_attachment_name?: string;
  file_attachment_id?: string;
   merge_history?: {
    action_msg: string;
    action_type: string;
    merge_ticket_id: string[];
    comment?: string;
    allocated_time?: string;
    processed_time?: string;
      ticket_id:string;
  }[];
  merge_status:string;
  parent_id?: string; // Parent ticket ID for subtasks - will be included if present in API response
  subtask_id?: string[]; // Array of subtask IDs - will be included if present in API response
  auto_ticket_close?: string;
}

export interface ApiResponse {
  data: Ticket[];
  count: number;
  total: number;
  bu_counts?: {
    RO?: number;
    BU?: number;
    TAS?: number;
    LPG?: number;
  };
}


export interface CreateOrFetchAlertTypesPayload {
  bu: string;
  alert_section: string;
  sop_id?: string;
  sap_id: string[];
  location_name: string[];
  zone: string[];
  region: string;
  alert_type: string|string[]; 
  assignee: string;
  reporter?: string;
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
  parent_id?: string; // For creating subtasks - parent ticket ID when creating a subtask
  subtask_id?: string[]; // For creating subtasks - subtask ID array
}

// For the response of POST /api/ticketing/create_ticket (when used to fetch initial form data)
export interface CreateTicketFormInitData {
  reporter: string | null; // Or specific type if known
  alert_types: {
    alert_type: string;
    sop_id: string;
  }[];
  // Add any other initial data fields your API might return here
}


export interface EditTicketPayload {
ticket_id: string;
update_id: string;
bu?: string;
alert_section?: string;
sop_id?: string;
sap_id?: string[];
location_name?: string[];
zone?: string[];
region?: string;
alert_type?: string | string[];
assignee?: string;
reporter?: string;
summary?: string;
description?: string;
ticket_state?: Ticket['ticket_state'];
ticket_severity?: Ticket['ticket_severity'];
comment?: string;
ticket_name?: string;
alert_id?: string;

linked_alert_id:any; // must be array

file_attachment?: string | string[];
file_attachment_name?: string;
file_attachment_id?: string;

start_date: string; // required by API
ticket_end_date?: string;
parent_id?: string; // Parent ticket ID for subtasks
subtask_id?: string[]; // For subtasks - subtask ID array
auto_ticket_close?: string;
}
