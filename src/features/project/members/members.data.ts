/** User-selected reference profiles. Preview records are never auth identities. */
export type MemberStatus = 'Remote' | 'Active' | 'Part-time';
export type DirectoryMember = {
  id: string; name: string; position: string; department: string; joinedOn: string;
  email: string; phone: string; status: MemberStatus; portrait: number | null;
};
export const memberStatuses: MemberStatus[] = ['Remote', 'Active', 'Part-time'];
const profiles: [string, string, string, string, string, string, MemberStatus][] = [
  ['Esther Howard', 'UI designer', 'Product', '2018-02-28', 'binhan628@gmail.com', '(209) 555-0104', 'Remote'],
  ['Jacob Jones', 'Chief Operating Officer', 'Engineering', '2018-12-02', 'vuhaithongnute@gmail.com', '(405) 555-0128', 'Active'],
  ['Bessie Cooper', 'Project Lead', 'Human Resources', '2015-05-20', 'manhchuc18@gmail.com', '(205) 555-0100', 'Part-time'],
  ['Annette Black', 'Process Manager', 'Manning', '2017-10-31', 'thuhang.nute@gmail.com', '(671) 555-0110', 'Remote'],
  ['Brooklyn Simmons', 'Vice President', 'Operations', '2014-03-13', 'nvt.issl.nute@gmail.com', '(505) 555-0125', 'Active'],
  ['Jerome Bell', 'Executive', 'Maintenance', '2017-10-30', 'danghoang87hl@gmail.com', '(603) 555-0123', 'Part-time'],
  ['Marvin McKinney', 'Hiring Manager', 'HSEQ', '2012-12-29', 'tienlapskptnd@gmail.com', '(629) 555-0129', 'Active'],
  ['Dianne Russell', 'UX Engineer', 'IT', '2018-03-06', 'tranthuy.nute@gmail.com', '(704) 555-0127', 'Part-time'],
];
export const referenceMembers: DirectoryMember[] = profiles.map(([name, position, department, joinedOn, email, phone, status], portrait) => ({
  id: `reference-${portrait}`, name, position, department, joinedOn, email, phone, status, portrait,
}));
/** Independently generated, full-resolution portraits. */
export const memberPortraits = ['esther', 'jacob', 'bessie', 'annette', 'brooklyn', 'jerome', 'marvin', 'dianne']
  .map(name => `/images/members/${name}.webp`);
export function joinedDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`));
}
