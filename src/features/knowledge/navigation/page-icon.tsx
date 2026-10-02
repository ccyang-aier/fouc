import { Article, Bicycle, BookOpen, BookmarkSimple, Briefcase, CalendarBlank, Camera, ChartBar, CheckCircle, Cloud, Code, Compass, Database, Envelope, FileText, Flag, Flask, Folder, Globe, GraduationCap, Hash, Heart, House, Image, Lightbulb, Lightning, Lock, MusicNote, Palette, Rocket, Star, Target, Terminal, Tree, Trophy, Users, type Icon } from '@phosphor-icons/react';

export const pageIconColors = ['#526175', '#0863d1', '#20b9eb', '#9955e8', '#ff845e', '#ee5684', '#ecae12', '#2bc4b6', '#09ac7b', '#d940e8', '#303a33'] as const;
export const pageIcons: { id: string; label: string; glyph: Icon }[] = [
  { id: 'graduation-cap', label: '学士帽 Education', glyph: GraduationCap },
  { id: 'bicycle', label: '自行车 Bicycle', glyph: Bicycle },
  { id: 'flask', label: '实验 Flask', glyph: Flask },
  { id: 'folder', label: '文件夹 Folder', glyph: Folder },
  { id: 'bookmark', label: '书签 Bookmark', glyph: BookmarkSimple },
  { id: 'calendar', label: '日历 Calendar', glyph: CalendarBlank },
  { id: 'book', label: '书籍 Book', glyph: BookOpen },
  { id: 'camera', label: '相机 Camera', glyph: Camera },
  { id: 'compass', label: '指南针 Compass', glyph: Compass },
  { id: 'cloud', label: '云 Cloud', glyph: Cloud },
  { id: 'code', label: '代码 Code', glyph: Code },
  { id: 'database', label: '数据库 Database', glyph: Database },
  { id: 'check', label: '完成 Check', glyph: CheckCircle },
  { id: 'envelope', label: '邮件 Envelope', glyph: Envelope },
  { id: 'article', label: '文章 Article', glyph: Article },
  { id: 'lightbulb', label: '灵感 Lightbulb', glyph: Lightbulb },
  { id: 'chart', label: '图表 Chart', glyph: ChartBar },
  { id: 'globe', label: '地球 Globe', glyph: Globe },
  { id: 'hash', label: '话题 Hash', glyph: Hash },
  { id: 'users', label: '团队 Users', glyph: Users },
  { id: 'image', label: '图片 Image', glyph: Image },
  { id: 'lightning', label: '闪电 Lightning', glyph: Lightning },
  { id: 'music', label: '音乐 Music', glyph: MusicNote },
  { id: 'lock', label: '安全 Lock', glyph: Lock },
  { id: 'palette', label: '设计 Palette', glyph: Palette },
  { id: 'rocket', label: '火箭 Rocket', glyph: Rocket },
  { id: 'target', label: '目标 Target', glyph: Target },
  { id: 'star', label: '星星 Star', glyph: Star },
  { id: 'heart', label: '喜欢 Heart', glyph: Heart },
  { id: 'house', label: '主页 House', glyph: House },
  { id: 'briefcase', label: '工作 Briefcase', glyph: Briefcase },
  { id: 'terminal', label: '终端 Terminal', glyph: Terminal },
  { id: 'tree', label: '树木 Tree', glyph: Tree },
  { id: 'flag', label: '旗帜 Flag', glyph: Flag },
  { id: 'trophy', label: '奖杯 Trophy', glyph: Trophy },
  { id: 'file', label: '文档 File', glyph: FileText },
];
export const pageEmojis = [
  ['📄', '文档 document'], ['📝', '笔记 note'], ['📘', '书 book'], ['📌', '固定 pin'], ['🗂️', '文件夹 folder'], ['📊', '图表 chart'], ['📈', '增长 growth'], ['🧭', '指南 compass'], ['🧩', '拼图 puzzle'], ['🛠️', '工具 tools'], ['💡', '灵感 idea'], ['🎯', '目标 target'], ['🚀', '火箭 rocket'], ['🏗️', '建设 build'], ['🧪', '实验 test'], ['🔬', '研究 research'], ['🎨', '设计 art'], ['🗓️', '日历 calendar'], ['✅', '完成 done'], ['⚖️', '法律 law'], ['🔒', '安全 lock'], ['🌍', '地球 globe'], ['🌱', '成长 plant'], ['⭐', '星星 star'], ['🔥', '火 fire'], ['💬', '讨论 chat'], ['📦', '包 package'], ['🧠', '大脑 brain'], ['🎓', '学士帽 education'], ['🏁', '终点 finish'],
] as const;

/** Page metadata holds either an emoji or a named glyph with a literal RGB color. */
export function encodePageIcon(id: string, color: string) {
  if (!pageIcons.some(icon => icon.id === id) || !/^#[0-9a-f]{6}$/i.test(color)) throw new Error('Invalid page icon');
  return `glyph:${id}:${color.toLowerCase()}`;
}
export function decodePageIcon(value: string | null | undefined) {
  const match = /^glyph:([a-z-]+):(#[0-9a-f]{6})$/i.exec(value ?? '');
  const icon = match && pageIcons.find(icon => icon.id === match[1]);
  return icon && match ? { ...icon, color: match[2] } : null;
}
export function PageIcon({ value, size = 16, className }: { value?: string | null; size?: number; className?: string }) {
  const icon = decodePageIcon(value);
  if (icon) { const Glyph = icon.glyph; return <Glyph aria-hidden size={size} weight="fill" className={className} style={{ color: icon.color }} data-page-icon={value} />; }
  if (value && !value.startsWith('glyph:')) return <span aria-hidden className={className} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: size, height: size, flexShrink: 0, fontSize: size, lineHeight: 1 }} data-page-icon={value}>{value}</span>;
  return <FileText aria-hidden size={size} weight="fill" className={className} />;
}
