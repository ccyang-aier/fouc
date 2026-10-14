/** Store a timestamp; language-specific labels are formatted at render or export time. */
export function dashboardTimestamp() {
  return new Date().toISOString();
}
