import Image from 'next/image';
import { User } from '@phosphor-icons/react';
import styles from './comments.module.css';

export type CommentAuthor = { name: string; image?: string | null };

export function CommentAvatar({ author }: { author?: CommentAuthor }) {
  return author?.image
    ? <Image className={styles.avatar} src={author.image} alt="" width={32} height={32} unoptimized />
    : <span className={styles.avatar} aria-hidden><User size={18} /></span>;
}
