export type ChatContext = {
  agent: string;
  projectId: string | null;
  projectName: string | null;
  knowledgeIncluded: boolean;
};
export type ChatAttachment = { id: string; file: File };
export type ChatSubmission = {
  id: string;
  text: string;
  attachments: ChatAttachment[];
  context: ChatContext;
  createdAt: Date;
};
