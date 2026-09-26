export { createKnowledgeAuth } from './service';
export type { KnowledgeAuth, AuthDiagnostic } from './service';
export { createKnowledgeAuthRoutes } from './http';
export { getKnowledgeIdentity, requireKnowledgeIdentity } from './identity';
export type { KnowledgeIdentity } from './identity';
export { readKnowledgeAuthConfig, validateKnowledgeAuthConfig, knowledgeAuthBasePath } from './config';
export type { KnowledgeAuthConfig } from './config';
export { createSmtpAuthEmailTransport } from './email';
export type { AuthEmailTransport } from './email';
