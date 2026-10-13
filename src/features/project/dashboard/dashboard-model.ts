export type DashboardPersonId =
  'sarah' | 'jerome' | 'kiara' | 'tania' | 'brooklyn' | 'cameron' | 'robert' | 'joe';
export type DashboardPriority = 'Low' | 'Medium' | 'High' | 'Urgent';
export type DashboardStatus = 'To Do' | 'On Progress' | 'Completed';
export type DashboardPeriod = 'Daily' | 'Weekly' | 'Monthly' | 'Yearly';

export interface DashboardPerson {
  id: DashboardPersonId;
  name: string;
  role: string;
  handle: string;
  avatar: string;
}
export interface DashboardAttachment {
  name: string;
  size: string;
  kind: 'figma' | 'word' | 'file';
  content?: string;
}
export interface DashboardComment {
  id: string;
  author: DashboardPersonId;
  text: string;
  time: string;
  replyTo?: string;
  liked?: boolean;
  attachment?: DashboardAttachment;
}
export interface DashboardTask {
  id: string;
  projectId: string;
  title: string;
  detailTitle: string;
  description: string;
  priority: DashboardPriority;
  status: DashboardStatus;
  tag: string;
  dueDate: string;
  progress: number;
  assignees: DashboardPersonId[];
  cardPeople: DashboardPersonId[];
  collaborators: DashboardPersonId[];
  comments: DashboardComment[];
  commentCount: number;
  links: number;
  color: 'orange' | 'green';
  starred: boolean;
  scheduledDate: string;
  startHour: number;
  durationHours: number;
  timelineCategory: 'Dashboard Design' | 'Mobile App' | 'Landing Page';
}
/** Portfolio cards belong to this reference dashboard, not the Fouc project directory. */
export interface DashboardProject {
  id: string;
  name: string;
  description: string;
  priority: DashboardPriority;
  color: 'orange' | 'green';
  featured: boolean;
  starred: boolean;
  favoriteLabel: string;
}
export interface DashboardProjectSummary {
  project: DashboardProject;
  tasks: DashboardTask[];
  progress: number;
  status: DashboardStatus;
  people: DashboardPersonId[];
  comments: number;
  links: number;
}
export type DashboardTarget = { kind: 'project' | 'task' | 'document' | 'meeting'; id: string };
export interface DashboardFavorite {
  id: string;
  label: string;
  target: DashboardTarget;
}
export interface DashboardActivity {
  id: string;
  actor: string;
  text: string;
  subject: string;
  time: string;
  target: DashboardTarget;
  read: boolean;
}
export interface DashboardMeeting {
  id: string;
  title: string;
  startsAt: string;
  durationMinutes: number;
  agenda: string;
  attendees: DashboardPersonId[];
  link: string;
  comments: DashboardComment[];
}
export type DashboardDocumentKind = 'invoice' | 'proposal' | 'contract' | 'form';
export type DashboardDocumentStatus = 'Draft' | 'Ready' | 'Completed';
interface DocumentBase {
  id: string;
  title: string;
  status: DashboardDocumentStatus;
  starred: boolean;
}
export interface DashboardInvoiceItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
}
export interface DashboardInvoice extends DocumentBase {
  kind: 'invoice';
  client: string;
  email: string;
  currency: 'USD' | 'EUR' | 'CNY';
  dueDate: string;
  items: DashboardInvoiceItem[];
  notes: string;
}
export interface DashboardProposal extends DocumentBase {
  kind: 'proposal';
  client: string;
  scope: string;
  budget: number;
  validUntil: string;
}
export interface DashboardContract extends DocumentBase {
  kind: 'contract';
  client: string;
  provider: string;
  terms: string;
  startDate: string;
  endDate: string;
}
export interface DashboardFormResponse {
  id: string;
  answers: string[];
  submittedAt: string;
}
export interface DashboardForm extends DocumentBase {
  kind: 'form';
  description: string;
  questions: string[];
  responses: DashboardFormResponse[];
}
export type DashboardDocument =
  DashboardInvoice | DashboardProposal | DashboardContract | DashboardForm;
export interface DashboardMilestone {
  month: string;
  target: number;
  completed: number;
}
export interface DashboardMilestonePoint {
  month: string;
  target: number;
  actual: number;
}
export interface DashboardState {
  projects: DashboardProject[];
  tasks: DashboardTask[];
  documents: DashboardDocument[];
  meetings: DashboardMeeting[];
  memberIds: DashboardPersonId[];
  activities: DashboardActivity[];
  milestones: DashboardMilestone[];
  updatedAt: string | null;
}

const avatar = (id: DashboardPersonId) => `/project-dashboard/avatars/${id}.webp`;
export const dashboardPeople: Record<DashboardPersonId, DashboardPerson> = {
  sarah: {
    id: 'sarah',
    name: 'Sarah Smither',
    role: 'Product Designer',
    handle: 'sarahsmither',
    avatar: avatar('sarah'),
  },
  jerome: {
    id: 'jerome',
    name: 'Jerome Bell',
    role: 'Creative Director',
    handle: 'jeromebell',
    avatar: avatar('jerome'),
  },
  kiara: {
    id: 'kiara',
    name: 'Kiara Laras',
    role: 'UI Designer',
    handle: 'kiaralaras',
    avatar: avatar('kiara'),
  },
  tania: { id: 'tania', name: 'Tania', role: 'Designer', handle: 'tania', avatar: avatar('tania') },
  brooklyn: {
    id: 'brooklyn',
    name: 'Brooklyn Simmons',
    role: 'UI Designer',
    handle: 'brooklynsimmons',
    avatar: avatar('brooklyn'),
  },
  cameron: {
    id: 'cameron',
    name: 'Cameron Williamson',
    role: 'Project Manager',
    handle: 'cameronwilliamson',
    avatar: avatar('cameron'),
  },
  robert: {
    id: 'robert',
    name: 'Robert Fox',
    role: 'Graphic Design',
    handle: 'robertfox',
    avatar: avatar('robert'),
  },
  joe: {
    id: 'joe',
    name: 'Joe Tesla',
    role: 'Design Lead',
    handle: 'joetesla',
    avatar: avatar('joe'),
  },
};
