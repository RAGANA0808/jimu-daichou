'use client';

import { useCallback, useState } from 'react';
import { Textarea, type TextareaProps } from './textarea';
import { VoiceInputButton } from './voice-input-button';

export type VoiceTextareaProps = Omit<TextareaProps, 'value'> & {
  /** 音声ボタンの aria 用フィールド名 (例: 「内容」「備考メモ」)。 */
  voiceFieldLabel?: string;
};

/**
 * 音声入力に対応した Textarea (M-2)。
 * - 内部 state で controlled 化し、音声確定テキストを末尾へ追記する。
 * - name / rows / maxLength / aria-* / id / placeholder などは ...rest で完全透過し、
 *   FormData 送信や FormField 連携を一切壊さない。
 * - 未対応ブラウザでは VoiceInputButton が null を返し、通常の Textarea として機能する。
 */
export function VoiceTextarea({
  voiceFieldLabel,
  defaultValue,
  onChange,
  maxLength,
  disabled,
  ...rest
}: VoiceTextareaProps) {
  const [value, setValue] = useState<string>(
    typeof defaultValue === 'string' ? defaultValue : '',
  );

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      setValue(event.target.value);
      onChange?.(event);
    },
    [onChange],
  );

  const appendTranscript = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (trimmed.length === 0) return;
      setValue((prev) => {
        const sep = prev.length === 0 || /\s$/.test(prev) ? '' : ' ';
        const next = prev + sep + trimmed;
        return typeof maxLength === 'number' ? next.slice(0, maxLength) : next;
      });
    },
    [maxLength],
  );

  return (
    <div className="space-y-2">
      <Textarea
        {...rest}
        value={value}
        onChange={handleChange}
        maxLength={maxLength}
        disabled={disabled}
      />
      <div className="flex justify-end">
        <VoiceInputButton
          onResult={appendTranscript}
          fieldLabel={voiceFieldLabel}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
