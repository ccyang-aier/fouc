'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { FileText, Lightning, MagnifyingGlass, Plus, Question } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { NavigationDialogPortal } from './navigation/navigation-dialog-portal';
import { DialogButton, ModalDialog } from './organization/ui';
import styles from './knowledge-empty-state.module.css';

export function KnowledgeEmptyState({ onCreate }: { onCreate: () => void }) {
  const [helpOpen, setHelpOpen] = useState(false);
  const learnButton = useRef<HTMLButtonElement>(null);
  function closeHelp() {
    setHelpOpen(false);
    learnButton.current?.focus();
  }

  return <section className={styles.surface} aria-labelledby="knowledge-empty-title">
    <div className={styles.content}>
      <Image src="/illustrations/knowledge-empty.png" alt="" width={1706} height={922} className={styles.illustration} preload />
      <h1 id="knowledge-empty-title" className={styles.title}>从第一份知识开始</h1>
      <p className={styles.description}>创建知识库，收好资料与灵感。</p>
      <div className={styles.actions}>
        <Button onClick={onCreate} className={styles.create}><Plus size={18} aria-hidden />新建知识库</Button>
        <Button ref={learnButton} variant="ghost" onClick={() => setHelpOpen(true)} className={styles.learn}><Question size={20} aria-hidden />了解知识库</Button>
      </div>
      <div className={styles.benefits}>
        <div aria-hidden className={styles.divider}><hr /></div>
        <ul className={styles.benefitList}>
          <li><FileText size={20} aria-hidden />资料有序</li>
          <li><Lightning size={20} aria-hidden />灵感留存</li>
          <li><MagnifyingGlass size={20} aria-hidden />随时找到</li>
        </ul>
      </div>
    </div>
    {helpOpen ? <NavigationDialogPortal><ModalDialog open title="了解知识库" description="用知识库整理文档、资料与灵感，通过文件夹和标签保持有序。" onClose={closeHelp} footer={<>
      <DialogButton autoFocus onClick={closeHelp}>知道了</DialogButton>
      <DialogButton variant="primary" onClick={() => { setHelpOpen(false); onCreate(); }}>新建知识库</DialogButton>
    </>}>
      <dl className={styles.help}>
        <div><dt>本机知识库</dt><dd>保存在当前浏览器，适合个人整理。登录不会自动上传内容。</dd></div>
        <div><dt>服务端知识库</dt><dd>登录后可创建，通过成员权限共享资料与协作。</dd></div>
      </dl>
    </ModalDialog></NavigationDialogPortal> : null}
  </section>;
}
