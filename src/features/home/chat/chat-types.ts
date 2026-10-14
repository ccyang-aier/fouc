export type ChatMode = "Auto" | "Fast" | "Deep";
export type ChatPermission =
  | "defaultPermission"
  | "readPermission"
  | "writePermission";
export type ChatContext = {
  agent: string;
  mode: ChatMode;
  permission: ChatPermission;
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
