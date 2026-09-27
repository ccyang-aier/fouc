export const sessionExpiredEvent = 'fouc:session-expired';

/** Business transports notify the global identity owner; invalid password responses use the separate auth transport. */
export const authenticatedFetch: typeof fetch = async (input, init) => {
  const response = await fetch(input, { ...init, credentials: 'include' });
  if (response.status === 401 && typeof window !== 'undefined') window.dispatchEvent(new Event(sessionExpiredEvent));
  return response;
};
