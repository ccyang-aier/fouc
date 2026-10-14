'use client';
import { createTranslator, type Locale, useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './sql-editor.messages';
import { useEffect, useRef, type RefObject } from 'react';
import {
  autocompletion,
  closeCompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
  nextSnippetField,
  prevSnippetField,
  startCompletion,
} from '@codemirror/autocomplete';
import type { CompletionSource } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { MySQL, PostgreSQL, SQLite, sql } from '@codemirror/lang-sql';
import { sqlKeywordCompletion } from './sql-metadata-completion';
import { sqlSnippetCompletion } from './sql-snippet-completion';
import { sqlCompletionPresentation } from './sql-completion-presentation';
import {
  MAX_SQL_ASSISTANCE_DOCUMENT_CHARS,
  sqlFunctionCompletion,
  sqlFunctionReplacesKeyword,
  sqlFunctionSignatureExtensions,
} from './sql-assistance/functions';
import { sqlDiagnosticsExtensions } from './sql-assistance/diagnostics';
import { setSqlDiagnosticLocale } from './sql-assistance/diagnostics/extension';
import { sqlEditorPhrases } from './sql-editor-language';
import './sql-assistance/functions/theme.css';
import { Compartment, EditorState, StateEffect, type Extension } from '@codemirror/state';
import { getOverlayRoot } from '@/lib/overlay-root';
import type {
  SqlEditorPosition,
  SqlExecutionMode,
  SqlFormatterCase,
  SqlSnippet,
  SqlStatementExecution,
} from '@fouc/shared';
import {
  bracketMatching,
  HighlightStyle,
  foldGutter,
  foldKeymap,
  indentOnInput,
  syntaxHighlighting,
} from '@codemirror/language';
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search';
import {
  EditorView,
  drawSelection,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
  gutter,
  GutterMarker,
  tooltips,
} from '@codemirror/view';
import { tags } from '@lezer/highlight';
import loadingStyles from '@/components/ui/button-loading.module.css';
const sqlHighlight = HighlightStyle.define([
  { tag: [tags.keyword, tags.bool, tags.null], color: 'var(--mw-sql-keyword)', fontWeight: '500' },
  { tag: [tags.string, tags.special(tags.string)], color: 'var(--mw-sql-string)' },
  { tag: tags.number, color: 'var(--mw-sql-number)' },
  { tag: tags.comment, color: 'var(--mw-muted)', fontStyle: 'italic' },
  { tag: [tags.typeName, tags.className], color: 'var(--accent-ink)' },
  { tag: tags.standard(tags.name), color: 'var(--sql-completion-function-ink)' },
  { tag: [tags.operator, tags.punctuation], color: 'var(--ink)' },
]);
const tooltipParent = new Compartment();
const wrapCompartment = new Compartment();
const diagnosticsCompartment = new Compartment();
const languageCompartment = new Compartment();
const refreshExecutionMarker = StateEffect.define<void>();
type MarkerStatus = 'idle' | 'running' | 'succeeded' | 'failed';
class RunStatementMarker extends GutterMarker {
  constructor(
    private status: MarkerStatus,
    private readonly run: () => void,
    private readonly locale: Locale,
  ) {
    super();
  }
  toDOM(view: EditorView) {
    const tConnector = createTranslator(connectorMessages, this.locale);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'fouc-action';
    button.dataset.execution = this.status;
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('aria-hidden', 'true');
    icon.setAttribute('fill', 'none');
    icon.setAttribute('stroke', 'currentColor');
    icon.setAttribute('stroke-width', '2');
    icon.setAttribute('stroke-linejoin', 'round');
    const play = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    play.setAttribute('d', 'M7 4L21 12L7 20Z');
    icon.append(play);
    button.append(icon);
    if (this.status === 'running') {
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      icon.style.display = 'none';
      const dots = document.createElement('span');
      dots.className = loadingStyles.dots;
      dots.setAttribute('aria-hidden', 'true');
      for (let index = 0; index < 3; index++) dots.append(document.createElement('span'));
      button.append(dots);
    }
    if (this.status === 'succeeded' || this.status === 'failed') {
      const badge = document.createElement('span');
      badge.className = 'mw-sql-run-badge';
      badge.textContent = this.status === 'succeeded' ? '✓' : '!';
      badge.setAttribute('aria-hidden', 'true');
      button.append(badge);
    }
    button.setAttribute('aria-label', tConnector('runCurrentStatement'));
    button.title = tConnector('runCurrentStatementCtrlEnter');
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      view.focus();
      this.run();
    });
    // Gutters mount after the editor constructor and are hidden by CodeMirror.
    requestAnimationFrame(() => {
      if (!button.isConnected) return;
      const gutters = button.closest('.cm-gutters');
      gutters?.removeAttribute('aria-hidden');
      gutters
        ?.querySelectorAll('.cm-gutter:not(.mw-sql-run-gutter)')
        .forEach((element) => element.setAttribute('aria-hidden', 'true'));
    });
    return button;
  }
}
export type SqlEditorExecutionMark = Pick<SqlStatementExecution, 'from' | 'to' | 'sql' | 'status'>;
type SqlEditorHandlers = {
  onChange: (value: string) => void;
  onRun: (mode?: SqlExecutionMode) => void;
  onSave?: () => void;
  onFormat?: () => void;
  onPositionChange?: (id: string, position: SqlEditorPosition) => void;
  complete?: CompletionSource;
  snippets?: SqlSnippet[];
  keywordCase?: SqlFormatterCase;
  functionCase?: SqlFormatterCase;
  executionMark?: SqlEditorExecutionMark;
};
class SqlEditorCallbacks {
  private positionReporter: ((view: EditorView) => void) | null = null;
  constructor(private handlers: SqlEditorHandlers) {}
  get(): SqlEditorHandlers {
    return this.handlers;
  }
  update(handlers: SqlEditorHandlers): void {
    this.handlers = handlers;
  }
  setPositionReporter(reporter: ((view: EditorView) => void) | null): void {
    this.positionReporter = reporter;
  }
  reportPosition(view: EditorView): void {
    this.positionReporter?.(view);
  }
}
export type SqlEditorCache = Map<
  string,
  {
    state: EditorState;
    scrollTop: number;
    scrollLeft: number;
    callbacks: SqlEditorCallbacks;
  }
>;
type Props = {
  showRunGutter?: boolean;
  executionMark?: SqlEditorExecutionMark;
  wrapLines?: boolean;
  diagnostics?: boolean;
  value: string;
  onChange: (value: string) => void;
  onRun: (mode?: SqlExecutionMode) => void;
  onSave?: () => void;
  onFormat?: () => void;
  snippets?: SqlSnippet[];
  keywordCase?: SqlFormatterCase;
  functionCase?: SqlFormatterCase;
  editorRef: RefObject<EditorView | null>;
  provider?: 'mysql' | 'postgres' | 'sqlite';
  readOnly?: boolean;
  label?: string;
  documentId?: string;
  positions?: SqlEditorPosition;
  cache?: SqlEditorCache;
  onPositionChange?: (documentId: string, position: SqlEditorPosition) => void;
  complete?: CompletionSource;
  completionScope?: string;
};
/** DBX's CodeMirror SQL stack adapted to Fouc's React workbench shell. */
export function SqlEditor({
  value,
  onChange,
  onRun,
  onSave,
  onFormat,
  snippets,
  keywordCase,
  functionCase,
  editorRef,
  provider = 'mysql',
  readOnly = false,
  showRunGutter = false,
  executionMark,
  wrapLines = true,
  diagnostics = true,
  label: labelProvided,
  documentId = 'sql',
  positions,
  cache,
  onPositionChange,
  complete,
  completionScope,
}: Props) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  const label = labelProvided === undefined ? tConnector('sqlEditor') : labelProvided;
  const host = useRef<HTMLDivElement>(null);
  const initialPresentation = useRef({ locale, label });
  const currentLocale = useRef(locale);
  const configureLanguage = useRef<((locale: Locale, label: string) => Extension[]) | null>(null);
  const initialValue = useRef(value);
  const initialPosition = useRef(positions);
  const initialWrapLines = useRef(wrapLines);
  const initialDiagnostics = useRef(diagnostics);
  const handlers = useRef({
    onChange,
    onRun,
    onSave,
    onFormat,
    onPositionChange,
    complete,
    snippets,
    keywordCase,
    functionCase,
    executionMark,
  });
  const activeCallbacks = useRef<SqlEditorCallbacks | null>(null);
  useEffect(() => {
    handlers.current = {
      onChange,
      onRun,
      onSave,
      onFormat,
      onPositionChange,
      complete,
      snippets,
      keywordCase,
      functionCase,
      executionMark,
    };
    activeCallbacks.current?.update(handlers.current);
    initialValue.current = value;
    initialPosition.current = positions;
    initialWrapLines.current = wrapLines;
    initialDiagnostics.current = diagnostics;
  }, [
    onChange,
    onRun,
    onSave,
    onFormat,
    onPositionChange,
    complete,
    snippets,
    keywordCase,
    functionCase,
    value,
    positions,
    executionMark,
    wrapLines,
    diagnostics,
  ]);
  useEffect(() => {
    if (editorRef.current) closeCompletion(editorRef.current);
  }, [editorRef, completionScope]);
  useEffect(() => {
    const cached = cache?.get(documentId);
    // Cached extensions keep this bridge; bind it to the current React callbacks on every mount.
    const callbacks = cached?.callbacks ?? new SqlEditorCallbacks(handlers.current);
    callbacks.update(handlers.current);
    activeCallbacks.current = callbacks;
    const savedTop = cached?.scrollTop ?? initialPosition.current?.scrollTop ?? 0;
    const savedLeft = cached?.scrollLeft ?? initialPosition.current?.scrollLeft ?? 0;
    let restoringViewport = true;
    callbacks.setPositionReporter(reportPosition);
    const bounded =
      (source: CompletionSource): CompletionSource =>
      (context) =>
        context.state.doc.length > MAX_SQL_ASSISTANCE_DOCUMENT_CHARS ? null : source(context);
    const keywordSource = sqlKeywordCompletion(provider);
    const keywords: CompletionSource = (context) => {
      const result = keywordSource(context);
      if (!result || !('options' in result)) return result;
      // Built-in functions use argument fields and documentation below; real
      // keyword entries and metadata columns retain their distinct sources.
      return {
        ...result,
        options: result.options.filter(
          (option) => !sqlFunctionReplacesKeyword(option.label, provider),
        ),
      };
    };
    const localizedExtensions = (locale: Locale, label: string): Extension[] => {
      const runStatementMarkers = {
        idle: new RunStatementMarker('idle', () => callbacks.get().onRun('current'), locale),
        running: new RunStatementMarker('running', () => callbacks.get().onRun('current'), locale),
        succeeded: new RunStatementMarker(
          'succeeded',
          () => callbacks.get().onRun('current'),
          locale,
        ),
        failed: new RunStatementMarker('failed', () => callbacks.get().onRun('current'), locale),
      };
      return [
        EditorState.phrases.of(sqlEditorPhrases(locale)),
        EditorView.contentAttributes.of({
          'aria-label': label,
          spellcheck: 'false',
          ...(readOnly ? { tabindex: '0' } : {}),
        }),
        ...(showRunGutter && !readOnly
          ? [
              gutter({
                class: 'mw-sql-run-gutter',
                lineMarker: (view, line) => {
                  const head = view.state.selection.main.head;
                  if (view.state.doc.lineAt(head).from !== line.from) return null;
                  const mark = callbacks.get().executionMark;
                  const status =
                    mark &&
                    head >= mark.from &&
                    head <= mark.to + 1 &&
                    view.state.sliceDoc(mark.from, mark.to) === mark.sql &&
                    ['running', 'succeeded', 'failed'].includes(mark.status)
                      ? (mark.status as MarkerStatus)
                      : 'idle';
                  return runStatementMarkers[status];
                },
                lineMarkerChange: (update) =>
                  update.selectionSet ||
                  update.docChanged ||
                  update.transactions.some((transaction) =>
                    transaction.effects.some((effect) => effect.is(refreshExecutionMarker)),
                  ),
              }),
            ]
          : []),
        ...(readOnly
          ? []
          : [
              autocompletion({
                ...sqlCompletionPresentation,
                override: [
                  bounded(keywords),
                  bounded(sqlSnippetCompletion(provider, () => callbacks.get(), locale)),
                  sqlFunctionCompletion(provider, () => callbacks.get(), locale),
                  bounded((context) => callbacks.get().complete?.(context) ?? null),
                ],
              }),
              ...sqlFunctionSignatureExtensions(provider, locale),
            ]),
      ];
    };
    configureLanguage.current = localizedExtensions;
    const extensions = [
      languageCompartment.of(
        localizedExtensions(initialPresentation.current.locale, initialPresentation.current.label),
      ),
      tooltipParent.of(tooltips({ parent: getOverlayRoot() ?? document.body })),
      EditorState.readOnly.of(readOnly),
      EditorView.editable.of(!readOnly),
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightSpecialChars(),
      history(),
      foldGutter(),
      drawSelection(),
      highlightActiveLine(),
      indentOnInput(),
      bracketMatching(),
      closeBrackets(),
      syntaxHighlighting(sqlHighlight),
      sql({
        dialect: provider === 'postgres' ? PostgreSQL : provider === 'sqlite' ? SQLite : MySQL,
      }),
      diagnosticsCompartment.of(
        !readOnly && initialDiagnostics.current
          ? sqlDiagnosticsExtensions(provider, initialPresentation.current.locale)
          : [],
      ),
      highlightSelectionMatches(),
      wrapCompartment.of(initialWrapLines.current ? EditorView.lineWrapping : []),
      keymap.of([
        {
          key: 'Mod-Shift-Enter',
          run: () => {
            if (!readOnly) callbacks.get().onRun('all');
            return true;
          },
        },
        {
          key: 'Mod-s',
          run: () => {
            if (!readOnly) callbacks.get().onSave?.();
            return true;
          },
        },
        {
          key: 'Mod-Shift-f',
          run: () => {
            if (readOnly || !callbacks.get().onFormat) return false;
            callbacks.get().onFormat?.();
            return true;
          },
        },
        {
          key: 'Mod-Enter',
          run: () => {
            if (!readOnly) callbacks.get().onRun();
            return true;
          },
        },
        { key: 'Alt-/', run: startCompletion },
        { key: 'Tab', run: nextSnippetField },
        { key: 'Shift-Tab', run: prevSnippetField },
        indentWithTab,
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...historyKeymap,
        ...foldKeymap,
        ...completionKeymap,
        ...searchKeymap,
      ]),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) callbacks.get().onChange(update.state.doc.toString());
        if (update.docChanged || update.selectionSet) callbacks.reportPosition(update.view);
      }),
    ];
    // Reconfigure extensions while retaining document/history fields: hot reload and
    // returning tabs must receive current snippet sources, keymaps and overlay host.
    const state = cached
      ? cached.state.update({ effects: StateEffect.reconfigure.of(extensions) }).state
      : EditorState.create({
          doc: initialValue.current,
          selection: {
            anchor: Math.min(initialValue.current.length, initialPosition.current?.anchor ?? 0),
            head: Math.min(initialValue.current.length, initialPosition.current?.head ?? 0),
          },
          extensions,
        });
    const view = new EditorView({ parent: host.current!, state });
    function reportPosition(current: EditorView) {
      if (restoringViewport) return;
      const { anchor, head } = current.state.selection.main;
      callbacks.get().onPositionChange?.(documentId, {
        anchor,
        head,
        scrollTop: current.scrollDOM.scrollTop,
        scrollLeft: current.scrollDOM.scrollLeft,
      });
    }
    const scroll = () => reportPosition(view);
    const restoreViewport = () => {
      if (!restoringViewport) return;
      view.requestMeasure({
        read: () => Boolean(host.current?.clientHeight && host.current.clientWidth),
        write: (visible) => {
          if (!visible || !restoringViewport) return;
          view.scrollDOM.scrollTop = savedTop;
          view.scrollDOM.scrollLeft = savedLeft;
          restoringViewport = false;
          reportPosition(view);
        },
      });
    };
    // SQL panes initially mount hidden beneath the data tab. Restore after the first visible measure.
    const visibility = new ResizeObserver(restoreViewport);
    visibility.observe(host.current!);
    restoreViewport();
    view.scrollDOM.addEventListener('scroll', scroll);
    // A returning tab must not revive a popup captured before metadata refresh.
    closeCompletion(view);
    editorRef.current = view;
    return () => {
      cache?.set(documentId, {
        state: view.state,
        scrollTop: restoringViewport ? savedTop : view.scrollDOM.scrollTop,
        scrollLeft: restoringViewport ? savedLeft : view.scrollDOM.scrollLeft,
        callbacks,
      });
      visibility.disconnect();
      callbacks.setPositionReporter(null);
      activeCallbacks.current = null;
      configureLanguage.current = null;
      view.scrollDOM.removeEventListener('scroll', scroll);
      editorRef.current = null;
      view.destroy();
    };
  }, [editorRef, provider, readOnly, showRunGutter, documentId, cache]);
  useEffect(() => {
    const view = editorRef.current;
    if (!view || !configureLanguage.current) return;
    currentLocale.current = locale;
    closeCompletion(view);
    view.dispatch({
      effects: [
        languageCompartment.reconfigure(configureLanguage.current(locale, label)),
        setSqlDiagnosticLocale.of(locale),
        refreshExecutionMarker.of(),
      ],
    });
  }, [editorRef, locale, label, documentId]);
  useEffect(() => {
    editorRef.current?.dispatch({
      effects: wrapCompartment.reconfigure(wrapLines ? EditorView.lineWrapping : []),
    });
  }, [editorRef, wrapLines, documentId]);
  useEffect(() => {
    if (!readOnly)
      editorRef.current?.dispatch({
        effects: diagnosticsCompartment.reconfigure(
          diagnostics ? sqlDiagnosticsExtensions(provider, currentLocale.current) : [],
        ),
      });
  }, [editorRef, diagnostics, provider, readOnly, documentId]);
  useEffect(() => {
    if (showRunGutter) editorRef.current?.dispatch({ effects: refreshExecutionMarker.of() });
  }, [editorRef, showRunGutter, executionMark, documentId]);
  useEffect(() => {
    const view = editorRef.current;
    if (view && value !== view.state.doc.toString()) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
    }
  }, [editorRef, value, documentId]);
  return <div ref={host} className="mw-live-code-editor" />;
}
