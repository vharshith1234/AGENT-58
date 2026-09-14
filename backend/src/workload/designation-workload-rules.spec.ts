import {
  getNormForDesignation,
  normalizeClassType,
  resolveCadre,
} from './designation-workload-rules';

describe('designation workload rules', () => {
  it('maps Excel cadres to prescribed bands', () => {
    expect(resolveCadre('Professor & Dean, SOCI')).toBe('Professor');
    expect(getNormForDesignation('Professor')?.prescribed).toBe('6-8');
    expect(getNormForDesignation('Assoc. Prof.')?.prescribed).toBe('12-14');
    expect(getNormForDesignation('Asst. Prof.')?.requiredHours).toBe(17);
    expect(getNormForDesignation('CAP')?.prescribed).toBe('12');
  });

  it('normalizes L/T/P class types', () => {
    expect(normalizeClassType('l')).toBe('L');
    expect(normalizeClassType('Tutorial')).toBe('T');
    expect(normalizeClassType('P')).toBe('P');
    expect(normalizeClassType('X')).toBeNull();
  });
});
