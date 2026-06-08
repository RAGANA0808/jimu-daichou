'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from './button';
import {
  getSpeechRecognitionCtor,
  type SpeechRecognitionLike,
} from '@/lib/speech/types';

type Props = {
  /** 確定テキストを受け取る (呼び出し側が末尾追記等を行う)。 */
  onResult: (text: string) => void;
  /** 認識言語。既定 ja-JP。 */
  lang?: string;
  /** ボタンの aria-label の対象名 (例: 「内容」)。 */
  fieldLabel?: string;
  disabled?: boolean;
  className?: string;
};

/**
 * 音声入力ボタン (M-2)。Web Speech API を使い、押下中の発話を確定テキストとして親へ渡す。
 * 未対応ブラウザでは何もレンダリングしない (劣化なしで通常入力が使える)。
 */
export function VoiceInputButton({
  onResult,
  lang,
  fieldLabel,
  disabled,
  className,
}: Props) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setSupported(false);
      return;
    }
    setSupported(true);
    const recognition = new Ctor();
    recognition.lang = lang ?? 'ja-JP';
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      let text = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result && result.isFinal) {
          text += result[0]?.transcript ?? '';
        }
      }
      if (text.length > 0) {
        onResult(text);
      }
    };
    recognition.onerror = () => {
      setListening(false);
    };
    recognition.onend = () => {
      setListening(false);
    };
    recognitionRef.current = recognition;

    return () => {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.abort();
      recognitionRef.current = null;
    };
  }, [lang, onResult]);

  if (!supported) {
    return null;
  }

  function handleToggle() {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    if (listening) {
      recognition.stop();
      return;
    }
    try {
      recognition.start();
      setListening(true);
    } catch {
      // 既に開始済み等の例外は握りつぶし、状態だけ戻す。
      setListening(false);
    }
  }

  return (
    <Button
      type="button"
      size="sm"
      variant={listening ? 'danger' : 'secondary'}
      onClick={handleToggle}
      disabled={disabled}
      aria-pressed={listening}
      aria-label={
        listening
          ? '音声入力を停止'
          : `${fieldLabel ? `${fieldLabel}を` : ''}音声で入力`
      }
      className={className}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        className="h-4 w-4 shrink-0"
        fill="currentColor"
      >
        <path d="M8 1.75a2.25 2.25 0 0 0-2.25 2.25v4a2.25 2.25 0 0 0 4.5 0v-4A2.25 2.25 0 0 0 8 1.75Z" />
        <path d="M4 7.25a.75.75 0 0 0-1.5 0 5.5 5.5 0 0 0 4.75 5.45v1.05a.75.75 0 0 0 1.5 0v-1.05A5.5 5.5 0 0 0 13.5 7.25a.75.75 0 0 0-1.5 0 4 4 0 0 1-8 0Z" />
      </svg>
      {listening ? '停止' : '音声入力'}
    </Button>
  );
}
