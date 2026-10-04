/** Workspace-owned organization of a saved connection, independent of its provider. */
export interface ConnectionDirectoryMetadata {
  favorite: boolean;
  /** References to projects in the same workspace; these do not grant access. */
  projectIds: string[];
  tags: string[];
}

/** Last actual connection attempt, not a claim that the remote service is online. */
export interface ConnectionDirectoryStatus {
  kind: 'passed' | 'failed';
  checkedAt: number;
}
