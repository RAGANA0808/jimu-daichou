import { describe, expect, it } from 'vitest';
import {
  MEMO_MIN_LENGTH,
  looksLikeMemo,
  looksLikeName,
  looksLikePhone,
  normalizeKana,
  normalizePhone,
  normalizePhoneForStorage,
  normalizePostalCode,
} from './normalize';

describe('normalizeKana', () => {
  it('カタカナをひらがなへ寄せる', () => {
    expect(normalizeKana('タナカ')).toBe('たなか');
  });

  it('濁点・半濁点付きカタカナも変換する', () => {
    expect(normalizeKana('ガギグゲゴ')).toBe('がぎぐげご');
    expect(normalizeKana('パピプペポ')).toBe('ぱぴぷぺぽ');
  });

  it('姓名間の空白 (半角/全角)・中黒を除去する', () => {
    expect(normalizeKana('たなか たろう')).toBe('たなかたろう');
    expect(normalizeKana('たなか　たろう')).toBe('たなかたろう');
    expect(normalizeKana('たなか・たろう')).toBe('たなかたろう');
  });

  it('前後空白をトリムする', () => {
    expect(normalizeKana('  たなか  ')).toBe('たなか');
  });

  it('全角英数を半角化し小文字化する', () => {
    expect(normalizeKana('ＡＢＣ１２３')).toBe('abc123');
  });

  it('空文字・空白のみは空文字を返す', () => {
    expect(normalizeKana('')).toBe('');
    expect(normalizeKana('   ')).toBe('');
    expect(normalizeKana('　')).toBe('');
  });
});

describe('normalizePhone', () => {
  it('ハイフン区切りを数字のみに正規化する', () => {
    expect(normalizePhone('090-1234-5678')).toBe('09012345678');
  });

  it('括弧・空白を落とす', () => {
    expect(normalizePhone('（090）1234 5678')).toBe('09012345678');
  });

  it('全角数字を半角化する', () => {
    expect(normalizePhone('０９０１２３４５６７８')).toBe('09012345678');
  });

  it('数字がなければ空文字を返す', () => {
    expect(normalizePhone('あいうえお')).toBe('');
  });
});

describe('looksLikePhone', () => {
  it('数字 2 桁以上で true', () => {
    expect(looksLikePhone('09')).toBe(true);
    expect(looksLikePhone('090-1234')).toBe(true);
  });

  it('数字 1 桁以下で false', () => {
    expect(looksLikePhone('5')).toBe(false);
    expect(looksLikePhone('たなか')).toBe(false);
  });
});

describe('normalizePhoneForStorage', () => {
  it('全角数字・ハイフンを半角化して区切りを保持する', () => {
    expect(normalizePhoneForStorage('０９０-１２３４-５６７８')).toBe(
      '090-1234-5678',
    );
  });

  it('括弧・空白・全角中黒など数字とハイフン以外を落とす', () => {
    expect(normalizePhoneForStorage('（03）1234 5678')).toBe('0312345678');
    expect(normalizePhoneForStorage('03・1234・5678')).toBe('0312345678');
  });

  it('連続ハイフンを 1 つにまとめ前後のハイフンを除く', () => {
    expect(normalizePhoneForStorage('--090--1234--5678--')).toBe(
      '090-1234-5678',
    );
  });

  it('数字を 1 桁も含まなければ空文字を返す (呼び出し側で null 化)', () => {
    expect(normalizePhoneForStorage('---')).toBe('');
    expect(normalizePhoneForStorage('あいうえお')).toBe('');
    expect(normalizePhoneForStorage('')).toBe('');
  });

  it('検索キー (normalizePhone) と異なり区切りハイフンは保持する', () => {
    const input = '090-1234-5678';
    expect(normalizePhoneForStorage(input)).toBe('090-1234-5678');
    expect(normalizePhone(input)).toBe('09012345678');
  });
});

describe('normalizePostalCode', () => {
  it('7 桁ちょうどは NNN-NNNN 形式に整える', () => {
    expect(normalizePostalCode('1234567')).toBe('123-4567');
  });

  it('全角数字・"〒"・ハイフン・空白を吸収して 7 桁整形する', () => {
    expect(normalizePostalCode('〒１２３-４５６７')).toBe('123-4567');
    expect(normalizePostalCode('123 4567')).toBe('123-4567');
  });

  it('7 桁以外は数字列のまま返す (海外住所・旧表記を弾かない)', () => {
    expect(normalizePostalCode('12345')).toBe('12345');
    expect(normalizePostalCode('123456789')).toBe('123456789');
  });

  it('数字を 1 桁も含まなければ空文字を返す (呼び出し側で null 化)', () => {
    expect(normalizePostalCode('〒---')).toBe('');
    expect(normalizePostalCode('')).toBe('');
  });
});

describe('looksLikeName', () => {
  it('トリム後 1 文字以上で true', () => {
    expect(looksLikeName('た')).toBe(true);
    expect(looksLikeName('  たなか ')).toBe(true);
  });

  it('空白のみで false', () => {
    expect(looksLikeName('   ')).toBe(false);
    expect(looksLikeName('')).toBe(false);
  });
});

describe('looksLikeMemo', () => {
  it('最小文字数は 2 (暴発防止のしきい値)', () => {
    expect(MEMO_MIN_LENGTH).toBe(2);
  });

  it(`trim 後 ${MEMO_MIN_LENGTH} 文字未満で false`, () => {
    expect(looksLikeMemo('庭')).toBe(false);
    expect(looksLikeMemo('  あ ')).toBe(false);
    expect(looksLikeMemo('   ')).toBe(false);
    expect(looksLikeMemo('')).toBe(false);
  });

  it(`trim 後 ${MEMO_MIN_LENGTH} 文字以上で true`, () => {
    expect(looksLikeMemo('松の')).toBe(true);
    expect(looksLikeMemo('車椅子')).toBe(true);
  });

  it('漢字を含む特徴メモ語でも発火する (かな検索では拾えない語を補う)', () => {
    expect(looksLikeMemo('お茶')).toBe(true);
  });
});
