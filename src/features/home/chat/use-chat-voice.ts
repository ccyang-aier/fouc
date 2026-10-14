"use client";

import { useEffect, useRef, useState } from "react";

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult:
    | ((event: {
        results: ArrayLike<ArrayLike<{ transcript: string }>>;
      }) => void)
    | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};
type RecognitionConstructor = new () => Recognition;

export function useChatVoice({
  onTranscript,
  onError,
}: {
  onTranscript: (transcript: string) => void;
  onError: (reason: "unavailable" | "denied" | "empty") => void;
}) {
  const recognition = useRef<Recognition | null>(null);
  const [listening, setListening] = useState(false);
  useEffect(
    () => () => {
      const current = recognition.current;
      if (current) {
        current.onend = null;
        current.onresult = null;
        current.onerror = null;
        current.abort();
      }
    },
    [],
  );
  function cancel() {
    const current = recognition.current;
    recognition.current = null;
    if (current) {
      current.onend = null;
      current.onresult = null;
      current.onerror = null;
      current.abort();
    }
    setListening(false);
  }
  function toggle() {
    if (listening) {
      recognition.current?.stop();
      setListening(false);
      return;
    }
    const Speech = window as unknown as {
      SpeechRecognition?: RecognitionConstructor;
      webkitSpeechRecognition?: RecognitionConstructor;
    };
    const Constructor =
      Speech.SpeechRecognition ?? Speech.webkitSpeechRecognition;
    if (!Constructor) {
      onError("unavailable");
      return;
    }
    if (recognition.current) cancel();
    const current = new Constructor();
    current.lang = document.documentElement.lang || "zh-CN";
    current.continuous = false;
    current.interimResults = false;
    current.onresult = (event) => {
      const text = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join("");
      if (text.trim()) onTranscript(text);
    };
    current.onerror = (event) =>
      onError(
        event.error === "not-allowed" || event.error === "audio-capture"
          ? "denied"
          : "empty",
      );
    current.onend = () => {
      if (recognition.current !== current) return;
      setListening(false);
      recognition.current = null;
    };
    recognition.current = current;
    try {
      current.start();
      setListening(true);
    } catch {
      recognition.current = null;
      onError("denied");
    }
  }
  return { listening, toggle, cancel };
}
