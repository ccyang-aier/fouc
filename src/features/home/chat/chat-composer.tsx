"use client";

import {
  useRef,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";
import {
  PaperPlaneTilt,
  Microphone,
  UploadSimple,
  Waveform,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { useAppAlert } from "@/components/app-alert-provider";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ChatAttachments } from "./chat-attachments";
import { ChatContextSelectors } from "./chat-selectors";
import { ChatExecutionSelector, type ChatExecutionSelectorHandle } from "./chat-execution-selector";
import { ChatAddMenu } from "./chat-add-menu";
import { ChatToolsLink } from "./chat-tools-link";
import { ChatQuickActions } from "./chat-quick-actions";
import { ChatPromptInput } from "./chat-prompt-input";
import { useChatVoice } from "./use-chat-voice";
import type { ChatAttachment, ChatContext, ChatMode, ChatSubmission, ChatTaskKind } from "./chat-types";
import type { ChatText } from "./chat-messages";
import styles from "./chat.module.css";

export type ChatDraft = { text: string; attachments: ChatAttachment[]; task: ChatTaskKind | null; mode: ChatMode | null };
export function ChatComposer({
  draft,
  setDraft,
  context,
  setContext,
  onSubmit,
  inputRef,
  compact = false,
  onOpenConnectors,
  t,
}: {
  draft: ChatDraft;
  setDraft: Dispatch<SetStateAction<ChatDraft>>;
  context: ChatContext;
  setContext: (change: Partial<ChatContext>) => void;
  onSubmit: (submission: ChatSubmission) => void;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  compact?: boolean;
  onOpenConnectors: () => void;
  t: ChatText;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const executionPicker = useRef<ChatExecutionSelectorHandle>(null);
  const dragDepth = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const { notify } = useAppAlert();
  const voice = useChatVoice({
    onTranscript: (transcript) =>
      setDraft((current) => ({
        ...current,
        text: `${current.text}${current.text ? " " : ""}${transcript}`,
      })),
    onError: (reason) =>
      notify(
        "warning",
        t(
          reason === "unavailable"
            ? "voiceUnavailable"
            : reason === "denied"
              ? "voiceDenied"
              : "voiceEmpty",
        ),
      ),
  });
  const hasMessage = Boolean(draft.text.trim());
  function addFiles(files: File[]) {
    setDraft((current) => {
      const identity = (file: File) =>
        `${file.name}:${file.size}:${file.lastModified}`;
      const existing = new Set(
        current.attachments.map((item) => identity(item.file)),
      );
      const added = files.filter((file) => {
        const key = identity(file);
        if (existing.has(key)) return false;
        existing.add(key);
        return true;
      });
      return {
        ...current,
        attachments: [
          ...current.attachments,
          ...added.map((file) => ({ id: crypto.randomUUID(), file })),
        ],
      };
    });
    setInvalid(false);
    inputRef.current?.focus();
  }
  async function pasteClipboard() {
    try {
      const items = await navigator.clipboard.read();
      const images: File[] = [];
      let text = "";
      for (const item of items) {
        const imageType = item.types.find((type) => type.startsWith("image/"));
        if (imageType)
          images.push(
            new File(
              [await item.getType(imageType)],
              `clipboard-${Date.now()}.png`,
              { type: imageType },
            ),
          );
        else if (item.types.includes("text/plain"))
          text += await (await item.getType("text/plain")).text();
      }
      if (images.length) addFiles(images);
      else if (text) {
        setDraft((current) => ({ ...current, text: current.text + text }));
        inputRef.current?.focus();
      } else notify("info", t("clipboardEmpty"));
    } catch {
      notify("info", t("clipboardError"));
    }
  }
  function submit() {
    if (!hasMessage) {
      setInvalid(true);
      notify("warning", t("emptyPrompt"));
      inputRef.current?.focus();
      return;
    }
    voice.cancel();
    onSubmit({
      id: crypto.randomUUID(),
      text: draft.text.trim(),
      task: draft.task,
      mode: draft.mode,
      attachments: draft.attachments,
      context: { ...context },
      createdAt: new Date(),
    });
    setDraft({ text: "", attachments: [], task: null, mode: null });
  }
  return (
    <>
    <ChatQuickActions value={draft.task} onSelect={task => {
      setDraft(current => ({ ...current, task }));
      inputRef.current?.focus({ preventScroll: true });
    }} t={t} />
    <div className={styles.composerGroup} data-compact={compact}>
      <ChatContextSelectors context={context} onChange={setContext} t={t} />
      <div
        className={styles.composer}
        data-invalid={invalid}
        data-dragging={dragging}
        data-listening={voice.listening}
        onDragEnter={(event) => {
          if (!event.dataTransfer.types.includes("Files")) return;
          event.preventDefault();
          dragDepth.current++;
          setDragging(true);
        }}
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes("Files")) {
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
          }
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          dragDepth.current--;
          if (dragDepth.current <= 0) setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          dragDepth.current = 0;
          setDragging(false);
          addFiles(Array.from(event.dataTransfer.files));
        }}
      >
        {draft.attachments.length ? (
          <ChatAttachments
            attachments={draft.attachments}
            t={t}
            onRemove={(id) =>
              setDraft(current => ({
                ...current,
                attachments: current.attachments.filter((item) => item.id !== id),
              }))
            }
          />
        ) : null}
        <ChatPromptInput
          inputRef={inputRef}
          task={draft.task}
          mode={draft.mode}
          t={t}
          onRemoveMode={() => {
            setDraft(current => ({ ...current, mode: null }));
            inputRef.current?.focus({ preventScroll: true });
          }}
          onRemoveTask={() => {
            setDraft(current => ({ ...current, task: null }));
            inputRef.current?.focus({ preventScroll: true });
          }}
          className={`chat-scope ${styles.input}`}
          aria-label={t("input")}
          aria-invalid={invalid}
          value={draft.text}
          placeholder={voice.listening ? t("listening") : t("placeholder")}
          rows={compact ? 2 : 3}
          onChange={(event) => {
            const text = event.target.value;
            setDraft(current => ({ ...current, text }));
            setInvalid(false);
          }}
          onPaste={(event) => {
            if (event.clipboardData.files.length) {
              event.preventDefault();
              addFiles(Array.from(event.clipboardData.files));
            }
          }}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.nativeEvent.isComposing &&
              (!event.shiftKey || event.ctrlKey || event.metaKey)
            ) {
              event.preventDefault();
              submit();
            }
          }}
        />
        <div className={styles.toolbar}>
          <div className={styles.toolbarLeft}>
            <input
              ref={fileInput}
              type="file"
              multiple
              className={styles.fileInput}
              aria-label={t("files")}
              onChange={(event) => {
                addFiles(Array.from(event.target.files ?? []));
                event.target.value = "";
              }}
            />
            <ChatAddMenu className={styles.iconButton} mode={draft.mode} context={context} t={t}
              onModeChange={mode => {
                setDraft(current => ({ ...current, mode }));
                inputRef.current?.focus({ preventScroll: true });
              }}
              onFiles={() => fileInput.current?.click()} onPaste={() => void pasteClipboard()}
              onModels={() => executionPicker.current?.open()} onConnectors={onOpenConnectors} />
            <ChatExecutionSelector ref={executionPicker} context={context} onChange={setContext} t={t} />
          </div>
          <div className={styles.toolbarRight}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className={styles.iconButton}
                  aria-label={voice.listening ? t("stopVoice") : t("voice")}
                  aria-pressed={voice.listening}
                  onClick={voice.toggle}
                  data-active={voice.listening}
                >
                  <Microphone
                    size={19}
                    weight={voice.listening ? "fill" : "regular"}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {voice.listening ? t("stopVoice") : t("voice")}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  className={styles.sendButton}
                  aria-label={
                    hasMessage
                      ? t("send")
                      : voice.listening
                        ? t("stopVoice")
                        : t("voiceChat")
                  }
                  onClick={hasMessage ? submit : voice.toggle}
                  data-has-message={hasMessage}
                >
                  <span
                    className={styles.sendIcon}
                    key={hasMessage ? "send" : "voice"}
                  >
                    {hasMessage ? (
                      <PaperPlaneTilt size={18} weight="fill" />
                    ) : (
                      <Waveform size={20} />
                    )}
                  </span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {hasMessage ? t("sendHint") : t("voiceChat")}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
        {dragging ? (
          <div className={styles.dropOverlay}>
            <UploadSimple size={28} />
            <span>{t("drop")}</span>
          </div>
        ) : null}
      </div>
      {!compact ? <ChatToolsLink onOpen={onOpenConnectors} t={t} /> : null}
    </div>
    </>
  );
}
