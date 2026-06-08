'use server';

import { revalidatePath } from 'next/cache';
import { requireCapability } from '@/lib/auth';
import { recordAudit } from '@/lib/audit';
import { withTenant } from '@/lib/db';
import { validateShipmentInput, type ShipmentInput } from '@/lib/shipment';
import { listShipmentCandidatesForYear } from './queries';
import type { ShipmentFormState } from './types';

function readField(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === 'string' ? v.trim() : '';
}

function extractValues(formData: FormData): ShipmentInput {
  return {
    title: readField(formData, 'title'),
    documentType: readField(formData, 'documentType'),
    serviceDate: readField(formData, 'serviceDate'),
    location: readField(formData, 'location'),
    offeringGuide: readField(formData, 'offeringGuide'),
    replyDeadline: readField(formData, 'replyDeadline'),
    bodyNote: readField(formData, 'bodyNote'),
  };
}

function parseTargetYear(raw: string): number | null {
  if (raw.length === 0) return null;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n) || n < 1800 || n > 2200) return null;
  return n;
}

/**
 * ユーザーが「含める」と明示した世帯 ID の集合を読み取る (A-2 重複案内防止)。
 * フォームは含める世帯 ID を includeHouseholdId として複数 hidden 送信する。
 * 値が 1 つも無い場合は null を返し、その場合は「重複でない世帯のみ」を既定で含める。
 */
function readIncludedHouseholdIds(formData: FormData): Set<string> | null {
  const values = formData
    .getAll('includeHouseholdId')
    .filter((v): v is string => typeof v === 'string' && v.length > 0);
  if (values.length === 0) return null;
  return new Set(values);
}

/**
 * 発送を記録する (E03「対象抽出 → 確認 → 送信」の最終ステップ)。
 *
 * 特許回避: 死亡/命日イベント起点の全自動発送ではなく、住職が画面で確認し本フォームを
 * 明示送信したときのみ記録する手動トリガ。宛先はクライアント送信値を信用せず、対象年から
 * サーバ側で再抽出する (弔い上げ/離檀/論理削除の除外を二重に担保)。
 *
 * 記録時、各宛先世帯のカルテ (InteractionNote) に発送履歴を 1 件ずつ連携する。
 */
export async function recordShipmentAction(
  _prev: ShipmentFormState,
  formData: FormData,
): Promise<ShipmentFormState> {
  const values = extractValues(formData);
  const v = validateShipmentInput(values);
  if (Object.keys(v.errors).length > 0) {
    return { status: 'error', errors: v.errors, values };
  }

  const targetYear = parseTargetYear(readField(formData, 'targetYear'));
  if (targetYear === null) {
    return {
      status: 'error',
      values,
      formError: '対象年が正しくありません。年忌表から操作し直してください。',
    };
  }

  // 宛先はサーバ側で再抽出 (クライアント送信値は信用しない)。
  const allCandidates = await listShipmentCandidatesForYear(targetYear);
  if (allCandidates.length === 0) {
    return {
      status: 'error',
      values,
      formError: '対象の宛先がありません。発送対象をご確認ください。',
    };
  }

  // A-2 重複案内防止: 特許回避のため自動で除外しきらない。
  // - ユーザーが「含める世帯」を明示送信した場合は、その世帯だけを記録対象とする
  //   (クライアント値は信用しないが、含める/含めないの意思は尊重する)。
  // - 明示送信が無い場合は、既送(全既送=all)の世帯のみ既定で除外する。最終判断は人間。
  const included = readIncludedHouseholdIds(formData);
  const candidates =
    included !== null
      ? allCandidates.filter((c) => included.has(c.householdId))
      : allCandidates.filter((c) => c.duplicateState !== 'all');

  if (candidates.length === 0) {
    return {
      status: 'error',
      values,
      formError:
        '記録対象の宛先がありません。重複以外の世帯が無いか、送付する世帯にチェックを入れてください。',
    };
  }

  const user = await requireCapability('create');
  const tenantId = user.tenantId;

  const docLabel =
    {
      NOTICE_LETTER: '案内状',
      ADDRESS_LABEL: '宛名ラベル',
      ENVELOPE: '封筒宛名',
      CSV: '宛名 CSV',
    }[v.values.documentType] ?? '案内';

  try {
    const batchId = await withTenant(tenantId, async (tx) => {
      const batch = await tx.shipmentBatch.create({
        data: {
          tenantId,
          title: v.values.title,
          documentType: v.values.documentType,
          serviceDate: v.values.serviceDate,
          location: v.values.location,
          offeringGuide: v.values.offeringGuide,
          replyDeadline: v.values.replyDeadline,
          bodyNote: v.values.bodyNote,
          targetYear,
          recipientCount: candidates.length,
          sentById: user.id,
        },
        select: { id: true },
      });

      // 宛先 (世帯粒度) と明細 (故人×回忌粒度) をネスト create で投入する。
      // createMany では recipient の id が取れず明細を結べないため 1 件ずつ create する
      // (Phase1 は数百規模なので許容)。明細は A-2 突合キーの蓄積元。
      for (const c of candidates) {
        await tx.shipmentRecipient.create({
          data: {
            tenantId,
            batchId: batch.id,
            householdId: c.householdId,
            householderName: c.householderName,
            postalCode: c.postalCode,
            address: c.address,
            summary: c.summary,
            items: {
              create: c.items.map((it) => ({
                tenantId,
                targetPersonId: it.personId,
                deathLedgerEntryId: it.entryId,
                anniversaryKaiki: it.kaiki,
                targetYear,
                secularName: it.secularName,
                anniversaryName: it.anniversaryName,
              })),
            },
          },
          select: { id: true },
        });
      }

      // 世帯カルテ (InteractionNote) への連携。発送した世帯の対応履歴に 1 件残す。
      const occurredAt = new Date();
      await tx.interactionNote.createMany({
        data: candidates.map((c) => ({
          tenantId,
          householdId: c.householdId,
          authorId: user.id,
          kind: 'NOTE' as const,
          content: `${docLabel}を発送しました（${v.values.title} / ${c.summary}）`,
          occurredAt,
        })),
      });

      await recordAudit(tx, tenantId, {
        actorId: user.id,
        action: 'OTHER',
        entityType: 'ShipmentBatch',
        entityId: batch.id,
        summary: `${docLabel}を発送記録 (${targetYear}年, ${candidates.length}件)`,
      });

      return batch.id;
    });

    revalidatePath('/hasso');
    candidates.forEach((c) => revalidatePath(`/danshintoto/${c.householdId}`));

    return { status: 'success', createdBatchId: batchId };
  } catch {
    // 個人情報をログに残さないため詳細はユーザーに返さない。
    return {
      status: 'error',
      values,
      formError: '発送の記録に失敗しました。時間をおいて再度お試しください。',
    };
  }
}
