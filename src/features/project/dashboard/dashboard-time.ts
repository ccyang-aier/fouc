const timestampFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

/** Persist an actual timestamp label so restored activity does not stay “Just now” forever. */
export function dashboardTimestamp() {
  return timestampFormat.format(new Date());
}
