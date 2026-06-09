'use client';

import { useTransition } from 'react';
import { Button } from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import { exportCrossTabAction } from './crosstab-export';

/** base64 をデコードして Blob を生成し、ブラウザでダウンロードさせる。 */
function downloadBase64(base64: string, fileName: string, mimeType: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function CrossTabExportButton({ fiscalYear }: { fiscalYear: number }) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  function handleExport() {
    startTransition(async () => {
      const res = await exportCrossTabAction(fiscalYear);
      if (res.status === 'error') {
        toast({ variant: 'danger', title: res.message });
        return;
      }
      downloadBase64(res.base64, res.fileName, res.mimeType);
      toast({
        variant: 'success',
        title: '集計表を書き出しました。',
        description: res.fileName,
      });
    });
  }

  return (
    <Button variant="secondary" onClick={handleExport} disabled={isPending}>
      {isPending ? '書き出し中…' : 'CSV で書き出す'}
    </Button>
  );
}
