import 'server-only';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from 'node:crypto';

/**
 * シークレット (Google refresh_token 等) の対称暗号化 (PERMISSION P-6)。
 *
 * AES-256-GCM。鍵は env `APP_ENCRYPTION_KEY` (32 byte を base64 か hex で)。
 * マーカー方式 (enc:v1:) で後方互換を担保する:
 *   - 鍵が無ければ平文のまま動作し、Google 連携を壊さない。
 *   - 読取は marker 有無で復号/素通しを切り替える。
 *   - 書込は鍵が有れば暗号化、無ければ平文を返す。
 *
 * 【ログ規約】鍵の値・平文・暗号文を一切ログに出さない。警告は鍵不備の事実のみ。
 *
 * 暗号文レイアウト: `enc:v1:` + base64( iv(12) ‖ tag(16) ‖ ciphertext )。
 */

const ENC_MARKER = 'enc:v1:';
const IV_BYTES = 12; // GCM 推奨 96bit
const TAG_BYTES = 16;
const KEY_BYTES = 32; // AES-256

let warnedNoKey = false;
let warnedBadKey = false;

/**
 * env から 32 byte 鍵をロードする。base64 / hex どちらでも可。
 * 32 byte に解釈できなければ null (= 鍵なし扱い) + 一度だけ警告。鍵値は出さない。
 */
function loadKey(): Buffer | null {
  const raw = process.env.APP_ENCRYPTION_KEY;
  if (!raw || raw.length === 0) {
    return null;
  }

  // hex 64 文字を優先判定 (base64 デコードが hex 文字列を誤受理するのを避ける)。
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, 'hex');
  }

  try {
    const decoded = Buffer.from(raw, 'base64');
    if (decoded.length === KEY_BYTES) {
      return decoded;
    }
  } catch {
    // 下の警告へ落ちる
  }

  if (!warnedBadKey) {
    warnedBadKey = true;
    console.warn(
      'APP_ENCRYPTION_KEY が不正です (32 byte の base64 か hex を指定してください)。暗号化なしで動作します。',
    );
  }
  return null;
}

/**
 * 平文を暗号化する。鍵が無ければ平文をそのまま返す (後方互換)。
 */
export function encryptSecret(plain: string): string {
  const key = loadKey();
  if (!key) {
    if (!warnedNoKey && !process.env.APP_ENCRYPTION_KEY) {
      warnedNoKey = true;
      console.warn(
        'APP_ENCRYPTION_KEY 未設定のため Google refresh_token を平文保存します。',
      );
    }
    return plain;
  }

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plain, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, tag, ciphertext]).toString('base64');
  return ENC_MARKER + payload;
}

/**
 * 値を復号する。
 * - マーカーが無い (平文) → そのまま返す (既存平文・鍵未設定で書いた値の後方互換)。
 * - マーカー有り + 鍵あり → 復号。復号失敗時は空文字を返す (例外を投げず安全に劣化)。
 * - マーカー有り + 鍵なし → 復号不能。空文字を返す (連携を静かに無効化、機能は落とさない)。
 */
export function decryptSecret(value: string): string {
  if (!value || value.length === 0) {
    return value;
  }
  if (!value.startsWith(ENC_MARKER)) {
    return value; // 平文素通し
  }

  const key = loadKey();
  if (!key) {
    if (!warnedNoKey) {
      warnedNoKey = true;
      console.warn(
        'APP_ENCRYPTION_KEY 未設定のため暗号化済みシークレットを復号できません。',
      );
    }
    return '';
  }

  try {
    const raw = Buffer.from(value.slice(ENC_MARKER.length), 'base64');
    const iv = raw.subarray(0, IV_BYTES);
    const tag = raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
    const ciphertext = raw.subarray(IV_BYTES + TAG_BYTES);
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return plain.toString('utf8');
  } catch {
    // tag 不一致 (鍵交換ミス等)。例外を伝播させず安全に劣化させる。
    return '';
  }
}
