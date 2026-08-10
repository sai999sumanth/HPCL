// import { faker } from '@faker-js/faker';
// import { Ticket, User, TicketType, TicketStatus, TicketPriority, Project } from '../types/ticket';

// // Mock users
// const mockUsers: User[] = Array.from({ length: 10 }, () => ({
//   id: faker.string.uuid(),
//   name: faker.person.fullName(),
//   email: faker.internet.email(),
//   avatar: faker.image.avatar(),
// }));

// // Mock project
// const mockProject: Project = {
//   id: faker.string.uuid(),
//   key: 'PROJ',
//   name: 'Sample Project',
//   description: 'A sample project for demonstration',
// };

// // Mock tickets
// let mockTickets: Ticket[] = [];
// let ticketCounter = 1;

// const createMockTicket = (overrides: Partial<Ticket> = {}): Ticket => {
//   const type = overrides.type || faker.helpers.arrayElement(['Epic', 'Story', 'Task', 'Bug'] as TicketType[]);
//   const status = overrides.status || faker.helpers.arrayElement(['To Do', 'In Progress', 'In Review', 'Done'] as TicketStatus[]);
//   const priority = overrides.priority || faker.helpers.arrayElement(['Highest', 'High', 'Medium', 'Low', 'Lowest'] as TicketPriority[]);
  
//   return {
//     id: faker.string.uuid(),
//     key: `${mockProject.key}-${ticketCounter++}`,
//     title: faker.lorem.sentence({ min: 3, max: 8 }),
//     description: faker.lorem.paragraphs({ min: 1, max: 3 }),
//     type,
//     status,
//     priority,
//     reporter: faker.helpers.arrayElement(mockUsers),
//     assignee: faker.datatype.boolean() ? faker.helpers.arrayElement(mockUsers) : undefined,
//     startDate: faker.datatype.boolean() ? faker.date.recent().toISOString().split('T')[0] : undefined,
//     endDate: faker.datatype.boolean() ? faker.date.future().toISOString().split('T')[0] : undefined,
//     createdAt: faker.date.recent().toISOString(),
//     updatedAt: faker.date.recent().toISOString(),
//     storyPoints: type === 'Story' || type === 'Task' ? faker.number.int({ min: 1, max: 13 }) : undefined,
//     labels: faker.helpers.arrayElements(['frontend', 'backend', 'api', 'ui', 'performance', 'security'], { min: 0, max: 3 }),
//     comments: [],
//     ...overrides,
//   };
// };

// // Initialize with some mock tickets
// for (let i = 0; i < 20; i++) {
//   mockTickets.push(createMockTicket());
// }

// // Add some epics and their children
// const epic1 = createMockTicket({ type: 'Epic', title: 'User Authentication System' });
// const epic2 = createMockTicket({ type: 'Epic', title: 'Dashboard Improvements' });
// mockTickets.push(epic1, epic2);

// // Add stories under epics
// const story1 = createMockTicket({ type: 'Story', epicId: epic1.id, title: 'Implement login functionality' });
// const story2 = createMockTicket({ type: 'Story', epicId: epic1.id, title: 'Add password reset feature' });
// const story3 = createMockTicket({ type: 'Story', epicId: epic2.id, title: 'Create analytics widgets' });
// mockTickets.push(story1, story2, story3);

// // Add subtasks
// const subtask1 = createMockTicket({ type: 'Subtask', parentId: story1.id, title: 'Design login form UI' });
// const subtask2 = createMockTicket({ type: 'Subtask', parentId: story1.id, title: 'Implement API integration' });
// mockTickets.push(subtask1, subtask2);

// export const mockApi = {
//   // Get all tickets
//   getTickets: async (): Promise<Ticket[]> => {
//     await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API delay
//     return [...mockTickets];
//   },

//   // Get ticket by ID
//   getTicket: async (id: string): Promise<Ticket | null> => {
//     await new Promise(resolve => setTimeout(resolve, 300));
//     return mockTickets.find(ticket => ticket.id === id) || null;
//   },

//   // Create new ticket
//   createTicket: async (ticketData: Omit<Ticket, 'id' | 'key' | 'createdAt' | 'updatedAt' | 'comments'>): Promise<Ticket> => {
//     await new Promise(resolve => setTimeout(resolve, 800));
    
//     const newTicket: Ticket = {
//       ...ticketData,
//       id: faker.string.uuid(),
//       key: `${mockProject.key}-${ticketCounter++}`,
//       createdAt: new Date().toISOString(),
//       updatedAt: new Date().toISOString(),
//       comments: [],
//     };
    
//     mockTickets.push(newTicket);
//     return newTicket;
//   },

//   // Update ticket
//   updateTicket: async (id: string, updates: Partial<Ticket>): Promise<Ticket | null> => {
//     await new Promise(resolve => setTimeout(resolve, 500));
    
//     const ticketIndex = mockTickets.findIndex(ticket => ticket.id === id);
//     if (ticketIndex === -1) return null;
    
//     mockTickets[ticketIndex] = {
//       ...mockTickets[ticketIndex],
//       ...updates,
//       updatedAt: new Date().toISOString(),
//     };
    
//     return mockTickets[ticketIndex];
//   },

//   // Delete ticket
//   deleteTicket: async (id: string): Promise<boolean> => {
//     await new Promise(resolve => setTimeout(resolve, 400));
    
//     const ticketIndex = mockTickets.findIndex(ticket => ticket.id === id);
//     if (ticketIndex === -1) return false;
    
//     mockTickets.splice(ticketIndex, 1);
//     return true;
//   },

//   // Get users
//   getUsers: async (): Promise<User[]> => {
//     await new Promise(resolve => setTimeout(resolve, 200));
//     return [...mockUsers];
//   },

//   // Get project
//   getProject: async (): Promise<Project> => {
//     await new Promise(resolve => setTimeout(resolve, 100));
//     return mockProject;
//   },
// };
// services/realApi.ts
import { ApiTicket, ApiResponse, Ticket, User, TicketStatus } from '../types/ticket';

// Transform API ticket to internal ticket format
const transformApiTicket = (apiTicket: Ticket): Ticket => {
  // Map ticket_state to our status
  let status: string = 'ToDo';
  switch (apiTicket.ticket_state) {
    case 'ToDo':
      status = 'ToDo';
      break;
    case 'InProgress':
      status = 'In Progress';
      break;
    case 'Cancelled':
      status = 'Cancelled';
      break;
    case 'Resolved':
      status = 'Resolved';
      break;
    case 'OnHold':
      status = 'On Hold';
      break;
    case 'ReOpen':
      status = 'ReOpen';
      break;
    case 'OnCompleted':
      status = 'OnCompleted';
      break;
    default:
      status = 'ToDo';
  }

  // Create assignee user object if exists
  const assignee: User | undefined = apiTicket.assignee ? {
    id: apiTicket.assignee,
    name: apiTicket.assignee,
    email: `${apiTicket.assignee.toLowerCase()}@company.com`,
    avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(apiTicket.assignee)}&background=random`
  } : undefined;

  // Create reporter user object if exists
  const reporter: User | undefined = apiTicket.reporter ? {
    id: apiTicket.reporter,
    name: apiTicket.reporter,
    email: `${apiTicket.reporter.toLowerCase()}@company.com`,
    avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(apiTicket.reporter)}&background=random`
  } : undefined;

//   return {
//     id: apiTicket.id.toString(),
//     key: apiTicket.ticket_id,
//     title: apiTicket.summary,
//     description: apiTicket.description,
//     type: 'Task', // Default type since API doesn't provide this
//     status: status,
//     priority: apiTicket.ticket_severity === 'High' ? 'High' : 
//               apiTicket.ticket_severity === 'Medium' ? 'Medium' : 'Low',
//     // reporter: reporter,
//     // assignee: assignee,
//      reporter: apiTicket.reporter || '', // Convert to string
//     assignee: apiTicket.assignee || '',
//     start_date: apiTicket.start_date,
//     end_date: apiTicket.end_date || undefined,
//     created_at: apiTicket.created_at,
//     updated_at: apiTicket.updated_at,
//     // labels: [apiTicket.zone, apiTicket.bu, apiTicket.location_name].filter(Boolean),
//     comment: apiTicket.ticket_history || [],
//     // Additional fields from API
//     alert_section: apiTicket.alert_section,
// ticket_status: apiTicket.ticket_status,
//     alertId: apiTicket.alert_id,
//     sapId: apiTicket.sap_id,
//     severity: apiTicket.ticket_severity,
//     locationName: apiTicket.location_name,
//     zone: apiTicket.zone,
//     bu: apiTicket.bu,
//     ticket_name: apiTicket.ticket_name,
//   };
// };

  return {
    id: apiTicket.id?.toString() || '',
tid: apiTicket.tid?.toString() || '',
    zone: Array.isArray(apiTicket.zone) ? apiTicket.zone : (apiTicket.zone ? [apiTicket.zone] : []),
    ticket_severity: apiTicket.ticket_severity || 'Low',
    updated_at: apiTicket.updated_at || new Date().toISOString(),
    alert_id: apiTicket.alert_id || '',
    ticket_id: apiTicket.ticket_id || '',
    region: apiTicket.region || '',
    assignee: apiTicket.assignee || '',
    entity_id: apiTicket.entity_id ?? null,

    ticket_status: apiTicket.ticket_status || 'Open',
    reporter: apiTicket.reporter || '',
    reporter_email: apiTicket.reporter_email || '',

    ticket_state: apiTicket.ticket_state || 'ToDo',
    ticket_history: apiTicket.ticket_history || [],
    bu: apiTicket.bu || '',
    severity: apiTicket.ticket_severity || 'Low',

    location_name: Array.isArray(apiTicket.location_name) ? apiTicket.location_name : (apiTicket.location_name ? [apiTicket.location_name] : []),
    location_id: apiTicket.location_id || '',
update_id: apiTicket.update_id?.toString() || 'default-update-id',
    start_date: apiTicket.start_date || '',
    linked_alert_id: apiTicket.linked_alert_id || '',
    ticket_end_date: apiTicket.ticket_end_date ?? null,
    end_date: apiTicket.end_date || apiTicket.ticket_end_date || '',

    interlock_name: apiTicket.interlock_name || '',
    alert_section: apiTicket.alert_section || '',
    sap_id: apiTicket.sap_id || [],

    summary: apiTicket.summary || '',
    comment: apiTicket.comment || '',
    description: apiTicket.description || '',
    created_at: apiTicket.created_at || new Date().toISOString(),

    category: apiTicket.category || '',
    sub_category: apiTicket.sub_category || apiTicket.subcategory || '',
    ticket_name: apiTicket.ticket_name || '',
    alert_type: apiTicket.alert_type || '',
    sop_id: apiTicket.sop_id || '',

    status: apiTicket.status || 'Open',
    title: apiTicket.summary || '',
    type: apiTicket.type || 'Task',

    key: apiTicket.ticket_id || '',
    priority:
      apiTicket.ticket_severity === 'High'
        ? 'High'
        : apiTicket.ticket_severity === 'Medium'
        ? 'Medium'
        : 'Low',

    storyPoints: apiTicket.storyPoints ?? 0,
    labels: [...(Array.isArray(apiTicket.zone) ? apiTicket.zone : [apiTicket.zone]), apiTicket.bu, ...(Array.isArray(apiTicket.location_name) ? apiTicket.location_name : [apiTicket.location_name])].filter(Boolean),

    avatar: apiTicket.avatar ?? null,
    auditLog: apiTicket.auditLog || '',
    parentId: apiTicket.parentId || '',
    epicId: apiTicket.epicId || '',

  
    impact:
      apiTicket.impact === 'Low' || apiTicket.impact === 'Medium' || apiTicket.impact === 'High'
        ? apiTicket.impact
        : 'Low',

    resolved_at: apiTicket.resolved_at ?? null,
    closed_at: apiTicket.closed_at ?? null,
    service_category: apiTicket.service_category || '',
    subcategory: apiTicket.subcategory || '',
    customer_id: apiTicket.customer_id ?? null,
 merge_status: apiTicket.merge_status || 'None',
    escalation_level: apiTicket.escalation_level ?? 0,
    assigned_to: apiTicket.assigned_to ?? null,

    // optional fields
    sla_breached: apiTicket.sla_breached ?? false,
    root_cause: apiTicket.root_cause || '',
    resolution: apiTicket.resolution || '',
  };
};

export const realApi = {
  // Get all tickets
  getTickets: async (skip: number = 0, limit: number = 100): Promise<Ticket[]> => {
    try {
      const response = await fetch(`/api/ticketing?skip=${skip}&limit=${limit}`);
      if (!response.ok) {
        throw new Error('Failed to fetch tickets');
      }
      
      const apiResponse: ApiResponse = await response.json();
      return apiResponse.data.map(transformApiTicket);
    } catch (error) {
      console.error('Error fetching tickets:', error);
      throw error;
    }
  },

  // Get ticket by ID
  getTicket: async (id: string): Promise<Ticket | null> => {
    try {
      // You might need a different endpoint for individual tickets
      const response = await fetch(`/api/ticketing/${id}`);
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error('Failed to fetch ticket');
      }
      
      const apiTicket: Ticket = await response.json();
      return transformApiTicket(apiTicket);
    } catch (error) {
      console.error('Error fetching ticket:', error);
      return null;
    }
  },

  // Update ticket status
  updateTicket: async (id: string, updates: Partial<Ticket>): Promise<Ticket | null> => {
    try {
      // Map internal status back to API status
      let apiStatus = updates.status;
      if (updates.status) {
        switch (updates.status) {
          case 'ToDo':
            apiStatus = 'ToDo';
            break;
          case 'In Progress':
            apiStatus = 'In Progress';
            break;
          case 'Cancelled':
            apiStatus = 'Cancelled';
            break;
          case 'Resolved':
            apiStatus = 'Resolved';
            break;
          case 'On Hold':
            apiStatus = 'OnHold';
            break;
          case 'ReOpen':
            apiStatus = 'ReOpen';
            break;
          case 'OnCompleted':
            apiStatus = 'OnCompleted';
            break;
        }
      }

      const response = await fetch(`/api/ticketing/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ticket_state: apiStatus,
          ...updates,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update ticket');
      }

      const updatedApiTicket: Ticket = await response.json();
      return transformApiTicket(updatedApiTicket);
    } catch (error) {
      console.error('Error updating ticket:', error);
      return null;
    }
  },

  // Create new ticket (if API supports it)
  createTicket: async (ticketData: Omit<Ticket, 'id' | 'key' | 'createdAt' | 'updatedAt' | 'comments'>): Promise<Ticket> => {
    try {
      const response = await fetch('/api/ticketing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          summary: ticketData.title,
          description: ticketData.description,
          ticket_severity: ticketData.priority,

          assignee: ticketData.assignee,
          reporter: ticketData.reporter,
          ticket_state: ticketData.status === 'In Progress' ? 'InProgress' : 
                       ticketData.status === 'On Hold' ? 'OnHold' : ticketData.status,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create ticket');
      }

      const newApiTicket: Ticket = await response.json();
      return transformApiTicket(newApiTicket);
    } catch (error) {
      console.error('Error creating ticket:', error);
      throw error;
    }
  },

  // Get users (you might need to implement this based on your API)
  getUsers: async (): Promise<User[]> => {
    // This is a placeholder - you might need to implement based on your user API
    return [
      {
        id: 'techsupport',
        name: 'TechSupport',
        email: 'techsupport@company.com',
        avatar: 'https://ui-avatars.com/api/?name=TechSupport&background=random'
      }
    ];
  },
};