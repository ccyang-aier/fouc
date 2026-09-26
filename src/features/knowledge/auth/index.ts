/**
 * Public surface of the knowledge auth feature (A04). Scenes are consumed by
 * the `/auth` route segments; session-recovery helpers are consumed by
 * knowledge data users (app shell wiring lands with Z03).
 */

export { AuthEntryScene } from './scenes/auth-entry-scene';
export { VerifyEmailScene } from './scenes/verify-email-scene';
export { OAuthCallbackScene } from './scenes/oauth-callback-scene';
export { KnowledgeSignOutButton } from './components/knowledge-sign-out-button';
export {
  authEntryPath,
  buildAuthEntryUrl,
  fetchKnowledgeSessionUser,
  isUnauthorizedKnowledgeError,
  performKnowledgeSignOut,
  redirectToKnowledgeSignIn,
  signOutAndReturnToSignIn,
} from './session';
