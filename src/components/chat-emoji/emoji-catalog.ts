import data from './emoji-catalog.json';
import { emojiAsset, emojiKey } from './emoji-data';

export type EmojiEntry = { emoji: string; name: string; zh: string; group: string; keywords: string };
export const emojiCatalog: readonly EmojiEntry[] = data;
export const emojiGroups = ['Smileys & Emotion', 'People & Body', 'Animals & Nature', 'Food & Drink', 'Travel & Places', 'Activities', 'Objects', 'Symbols', 'Flags'] as const;
export type EmojiGroup = typeof emojiGroups[number] | 'recent';

const groupAliases: Record<typeof emojiGroups[number], string> = {
  'Smileys & Emotion': '表情 情绪 笑脸 爱心', 'People & Body': '人物 身体 手势 人类',
  'Animals & Nature': '动物 植物 自然 天气', 'Food & Drink': '食物 饮料 水果 美食',
  'Travel & Places': '旅行 地点 交通 建筑', Activities: '活动 体育 游戏 奖牌',
  Objects: '物品 工作 工具 生活', Symbols: '符号 标记 数字', Flags: '旗帜 国旗 国家 地区',
};
const aliases: Record<string, string> = {
  '👍': '赞 点赞 支持 +1 like yes good', '👎': '踩 不赞成 -1 dislike no', '🙏': '谢谢 感谢 拜托 祈祷 thanks please',
  '😂': '笑哭 哈哈 好笑 lol haha', '🤣': '笑死 笑翻 lmao rofl', '😊': '开心 害羞 微笑 happy shy',
  '🙂': '微笑 礼貌 smile', '🥹': '感动 泪目 touched', '🥳': '庆祝 派对 恭喜 party congratulations',
  '🎉': '庆祝 恭喜 礼花 撒花 celebration tada', '🚀': '上线 发布 起飞 launch release rocket',
  '✅': '完成 确认 成功 搞定 done check success', '💡': '灵感 想法 idea', '🔥': '火 热门 赞 hot fire',
  '❤️': '爱 喜欢 爱心 love heart', '💪': '加油 努力 强壮 strong fighting', '👏': '鼓掌 赞同 拍手 applause clap',
  '👀': '关注 看看 围观 eyes watching', '👋': '你好 再见 挥手 hello bye wave', '🤔': '思考 想想 疑问 think hmm',
  '🤝': '合作 握手 达成一致 deal handshake', '👌': '好的 没问题 ok okay', '😭': '哭泣 大哭 难过 cry sad',
  '😅': '尴尬 汗苦笑 汗 smile sweat', '🙌': '举手 万岁 击掌 hooray', '💯': '满分 完美 百分 perfect',
};
const entriesByKey = new Map(emojiCatalog.map(entry => [emojiKey(entry.emoji), entry]));
const normalize = (text: string) => text.normalize('NFKC').trim().toLocaleLowerCase();

export function recentEmojiEntry(emoji: string): EmojiEntry | null {
  if (!emojiAsset(emoji)) return null;
  const entry = entriesByKey.get(emojiKey(emoji)) ?? entriesByKey.get(emojiKey(emoji.replace(/[\u{1f3fb}-\u{1f3ff}]/gu, '')));
  return entry ? { ...entry, emoji } : null;
}

export function searchEmoji(query: string, group: EmojiGroup, recent: readonly string[] = []): EmojiEntry[] {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  const entries = words.length ? emojiCatalog : group === 'recent' ? recent.map(recentEmojiEntry).filter((entry): entry is EmojiEntry => Boolean(entry)) : emojiCatalog.filter(entry => entry.group === group);
  if (!words.length) return [...entries];
  return entries.filter(entry => {
    const searchable = normalize(`${entry.emoji} ${entry.name} ${entry.zh} ${entry.keywords} ${aliases[entry.emoji] ?? ''} ${entry.group} ${groupAliases[entry.group as typeof emojiGroups[number]] ?? ''}`);
    return words.every(word => searchable.includes(word));
  });
}
