'use client';

import type { CSSProperties } from 'react';
import { AppearanceSelect, AppearanceSizeControl, AppearanceWidthControl } from '@/components/editor-appearance-controls';
import { useEditorAppearance, useEditorBackgrounds } from '@/lib/editor-appearance';
import { documentFonts, documentSizes, documentLineHeights, documentParagraphSpacings } from '@/lib/editor-appearance-options';
import { EditorBackgroundPicker } from './editor-background-picker';
import '@/features/knowledge/editor/document-fonts.css';
import styles from './editor-settings.module.css';

export function EditorSettings() {
  const { appearance, update, reset } = useEditorAppearance();
  const { backgrounds } = useEditorBackgrounds();
  const font = documentFonts.find(item => item.id === appearance.font)!;
  const size = documentSizes.find(item => item.id === appearance.size)!;
  const spacing = documentParagraphSpacings.find(item => item.id === appearance.paragraphSpacing)!;
  const background = backgrounds.find(item => item.id === appearance.background) ?? backgrounds[0];
  const previewStyle = {
    '--preview-font': font.family,
    '--preview-size': `${size.pixels}px`,
    '--preview-line-height': appearance.lineHeight,
    '--preview-paragraph-gap': `${spacing.pixels}px`,
    '--preview-width': `${appearance.width}%`,
    backgroundColor: background.color ?? '#fff',
    backgroundImage: background.image ? `url("${background.image}")` : undefined,
  } as CSSProperties;

  return <div className={styles.canvas}>
    <header className={styles.header}><h1>编辑器</h1><button type="button" className={styles.reset} onClick={reset}>恢复默认</button></header>
    <div className={styles.layout}>
      <div className={styles.configuration}>
        <section className={styles.section} aria-labelledby="editor-typography-title">
          <h2 id="editor-typography-title">文字排版</h2>
          <div className={styles.controls}>
            <AppearanceSelect label="字体" value={appearance.font} options={documentFonts} onChange={font => update({ font })} />
            <AppearanceSizeControl value={appearance.size} onChange={size => update({ size })} />
            <AppearanceSelect label="行距" value={appearance.lineHeight} options={documentLineHeights.map(id => ({ id, label: `${id} 倍` }))} onChange={lineHeight => update({ lineHeight })} />
            <AppearanceSelect label="段落间距" value={appearance.paragraphSpacing} options={documentParagraphSpacings} onChange={paragraphSpacing => update({ paragraphSpacing })} />
          </div>
        </section>
        <section className={styles.section} aria-labelledby="editor-page-title">
          <h2 id="editor-page-title">页面</h2>
          <div className={styles.controls}>
            <AppearanceWidthControl label="默认页宽" value={appearance.width} onChange={width => update({ width })} />
            <EditorBackgroundPicker value={appearance.background} onChange={background => update({ background })} />
          </div>
        </section>
      </div>
      <section className={styles.preview} aria-labelledby="editor-preview-title">
        <h2 id="editor-preview-title">预览</h2>
        <div className={styles.previewPage} style={previewStyle}>
          <article className={styles.previewDocument}>
            <h1>接口约定</h1>
            <p>统一请求格式，保持接口行为一致。团队设计文档与代码示例在这里共同呈现。</p>
            <p>本文档定义了服务端与客户端之间的接口约定，包括请求格式、认证方式、常见响应字段和错误处理逻辑，适用于 Web 端与移动端的统一接入。</p>
            <h2>请求示例</h2>
            <div className={styles.codeBlock}><div className={styles.codeLanguage}>JavaScript</div><pre><code><span className={styles.codeKeyword}>const</span>{' res = '}<span className={styles.codeKeyword}>await</span>{' fetch('}<span className={styles.codeString}>{"'/api/user'"}</span>{', {\n  method: '}<span className={styles.codeString}>{"'GET'"}</span>{',\n  headers: { '}<span className={styles.codeString}>{"'Content-Type'"}</span>{': '}<span className={styles.codeString}>{"'application/json'"}</span>{' }\n});'}</code></pre></div>
            <h2>响应字段</h2>
            <div className={styles.tableScroll}><table><thead><tr><th>字段名</th><th>类型</th><th>说明</th></tr></thead><tbody><tr><td>code</td><td>number</td><td>业务状态码，0 表示成功</td></tr><tr><td>message</td><td>string</td><td>提示信息</td></tr><tr><td>data</td><td>object</td><td>响应数据</td></tr></tbody></table></div>
          </article>
        </div>
      </section>
    </div>
  </div>;
}
