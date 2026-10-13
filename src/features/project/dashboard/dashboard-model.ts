export type DashboardPersonId = 'sarah' | 'jerome' | 'kiara' | 'tania' | 'brooklyn' | 'cameron' | 'robert' | 'joe';
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
export interface DashboardAttachment { name: string; size: string; kind: 'figma' | 'word'; }
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
}
export interface DashboardActivity { id: string; actor: string; text: string; subject: string; time: string; }
export interface DashboardState { tasks: DashboardTask[]; activities: DashboardActivity[]; favorites: string[]; }

const avatar = (id: DashboardPersonId) => `/project-dashboard/avatars/${id}.webp`;
export const dashboardPeople: Record<DashboardPersonId, DashboardPerson> = {
  sarah: { id: 'sarah', name: 'Sarah Smither', role: 'Product Designer', handle: 'sarahsmither', avatar: avatar('sarah') },
  jerome: { id: 'jerome', name: 'Jerome Bell', role: 'Creative Director', handle: 'jeromebell', avatar: avatar('jerome') },
  kiara: { id: 'kiara', name: 'Kiara Laras', role: 'UI Designer', handle: 'kiaralaras', avatar: avatar('kiara') },
  tania: { id: 'tania', name: 'Tania', role: 'Designer', handle: 'tania', avatar: avatar('tania') },
  brooklyn: { id: 'brooklyn', name: 'Brooklyn Simmons', role: 'UI Designer', handle: 'brooklynsimmons', avatar: avatar('brooklyn') },
  cameron: { id: 'cameron', name: 'Cameron Williamson', role: 'Project Manager', handle: 'cameronwilliamson', avatar: avatar('cameron') },
  robert: { id: 'robert', name: 'Robert Fox', role: 'Graphic Design', handle: 'robertfox', avatar: avatar('robert') },
  joe: { id: 'joe', name: 'Joe Tesla', role: 'Design Lead', handle: 'joetesla', avatar: avatar('joe') },
};

export const initialDashboardState: DashboardState = {
  tasks: [
    { id: 'wireframe', title: 'Setup Wireframe', detailTitle: 'Setup Wireframe', description: 'Automating deployment process for Designer team', priority: 'Medium', status: 'On Progress', tag: 'Mobile App', dueDate: '2027-02-02', progress: 40, assignees: ['jerome', 'tania'], cardPeople: ['jerome', 'tania'], collaborators: ['jerome', 'kiara', 'tania'], comments: [], commentCount: 6, links: 2, color: 'orange', starred: false },
    { id: 'brand', title: 'Update Brand Logo Guidelines', detailTitle: 'Sosro Mobile App', description: 'Minor revision on logo usage guide for design team', priority: 'Urgent', status: 'On Progress', tag: 'Mobile App', dueDate: '2027-02-02', progress: 55, assignees: ['kiara', 'joe', 'tania'], cardPeople: ['joe', 'cameron'], collaborators: ['jerome', 'kiara', 'tania'], comments: [
      { id: 'kiara-comment', author: 'kiara', text: 'What do you think about this style?', time: '2 hr ago', attachment: { name: 'ABC Dashboard Style.fig', size: '2,5 MB', kind: 'figma' } },
      { id: 'joe-reply', author: 'joe', text: "That's good! but you must follow the direction, check the brief", time: '2 hr ago', replyTo: 'kiara-comment', attachment: { name: 'Design System Guideline.doc', size: '1,5 MB', kind: 'word' } },
    ], commentCount: 6, links: 2, color: 'green', starred: false },
  ],
  favorites: ['ABC Projects - Dashboard', 'Kiara Projects - Website', 'Dribbble Shot'],
  activities: [
    { id: 'activity-1', actor: 'Joe Doe', text: 'marked', subject: 'Design Proposal', time: 'Feb 8, 2027 7:23PM' },
    { id: 'activity-2', actor: 'Jane Studio', text: 'answered the form', subject: 'Graphic Design Brief', time: 'Feb 8, 2027 7:00PM' },
    { id: 'activity-3', actor: 'jsmith.mobbin@gmail.com', text: 'answered the form', subject: 'Graphic Design Brief', time: 'Feb 8, 2027 6:18PM' },
  ],
};
