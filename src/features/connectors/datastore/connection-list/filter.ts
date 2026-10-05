import type { ConnectionListRow } from './types'

export const unassignedProject = '__unassigned__'

export function filterConnections(rows: readonly ConnectionListRow[], filters: {
  search: string
  projects: readonly string[]
  tags: readonly string[]
  onlyFavorites: boolean
}, projectNames: ReadonlyMap<string, string>) {
  const needle = filters.search.trim().toLocaleLowerCase()
  return rows.filter(row => {
    if (filters.onlyFavorites && !row.favorite) return false
    if (filters.tags.length && !filters.tags.some(tag => row.tags.includes(tag))) return false
    if (filters.projects.length && !filters.projects.some(id => id === unassignedProject ? !row.projectIds.length : row.projectIds.includes(id))) return false
    return !needle || [row.name, row.target, row.targetTitle, ...row.tags, ...row.projectIds.map(id => projectNames.get(id) ?? '')].join(' ').toLocaleLowerCase().includes(needle)
  })
}
