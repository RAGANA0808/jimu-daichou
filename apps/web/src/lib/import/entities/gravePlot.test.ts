import { describe, expect, it } from 'vitest';
import { gravePlotImportDef, type GravePlotExistingIndex } from './gravePlot';

function makeIndex(opts: {
  areas?: Record<string, string>;
  households?: Record<string, string>;
  plots?: string[];
}): GravePlotExistingIndex {
  const areas = opts.areas ?? {};
  const households = opts.households ?? {};
  const plots = new Set((opts.plots ?? []).map((p) => `plot:${p}`));
  return {
    has: (key) => plots.has(key),
    areaIdByName: (key) => areas[key] ?? null,
    householdIdByMatchKey: (key) => households[key] ?? null,
  };
}

const emptyIndex = makeIndex({});

function toRecord(values: Record<string, string>, existing = emptyIndex) {
  return gravePlotImportDef.toRecord(values, { existing });
}

describe('gravePlotImportDef.toRecord', () => {
  it('必須が揃えばレコードを生成する', () => {
    const { issues, record } = toRecord({
      plotNumber: 'A-12',
      plotType: '個人墓',
    });
    expect(issues).toEqual([]);
    expect(record).not.toBeNull();
    expect(record?.plotType).toBe('INDIVIDUAL');
    expect(record?.status).toBe('AVAILABLE');
  });

  it('区画番号が空なら error', () => {
    const { record, issues } = toRecord({ plotNumber: '', plotType: '個人墓' });
    expect(record).toBeNull();
    expect(issues.some((i) => i.column === 'plotNumber' && i.severity === 'error')).toBe(true);
  });

  it('区画種別が不正なら error', () => {
    const { record, issues } = toRecord({ plotNumber: 'A-1', plotType: '謎の墓' });
    expect(record).toBeNull();
    expect(issues.some((i) => i.column === 'plotType' && i.severity === 'error')).toBe(true);
  });

  it('状態ラベルを enum に解決する', () => {
    const { record } = toRecord({ plotNumber: 'A-1', plotType: '夫婦墓', status: '使用中' });
    expect(record?.status).toBe('IN_USE');
    expect(record?.plotType).toBe('COUPLE');
  });

  it('契約日の和暦を取り込む', () => {
    const { record } = toRecord({
      plotNumber: 'A-1',
      plotType: '家族墓',
      contractDate: '令和6年3月15日',
    });
    expect(record?.contractDate?.getUTCFullYear()).toBe(2024);
  });

  it('不完全な契約日は error', () => {
    const { record, issues } = toRecord({
      plotNumber: 'A-1',
      plotType: '家族墓',
      contractDate: '2024',
    });
    expect(record).toBeNull();
    expect(issues.some((i) => i.column === 'contractDate' && i.severity === 'error')).toBe(true);
  });

  it('エリア名が一致すれば areaId を解決する (漢字はそのまま比較)', () => {
    const idx = makeIndex({ areas: { 東墓地: 'area-1' } });
    const { record, issues } = toRecord(
      { plotNumber: 'A-1', plotType: '個人墓', areaName: '東墓地' },
      idx,
    );
    expect(record?.areaId).toBe('area-1');
    expect(issues).toEqual([]);
  });

  it('エリア名が一致しなければ警告 + 未配置で取り込む', () => {
    const { record, issues } = toRecord(
      { plotNumber: 'A-1', plotType: '個人墓', areaName: '存在しないエリア' },
      emptyIndex,
    );
    expect(record).not.toBeNull();
    expect(record?.areaId).toBeNull();
    expect(issues.some((i) => i.column === 'areaName' && i.severity === 'warning')).toBe(true);
  });

  it('契約世帯が一致すれば householdId を解決する', () => {
    const idx = makeIndex({ households: { 'kana:やまだたろう': 'hh-1' } });
    const { record } = toRecord(
      { plotNumber: 'A-1', plotType: '個人墓', householderKana: 'ヤマダタロウ' },
      idx,
    );
    expect(record?.householdId).toBe('hh-1');
  });

  it('区画番号が既存と重複すると warning + スキップ (record=null)', () => {
    const idx = makeIndex({ plots: ['A-12'] });
    const { record, issues } = toRecord({ plotNumber: 'A-12', plotType: '個人墓' }, idx);
    expect(record).toBeNull();
    expect(issues.some((i) => i.column === 'plotNumber' && i.severity === 'warning')).toBe(true);
  });
});
