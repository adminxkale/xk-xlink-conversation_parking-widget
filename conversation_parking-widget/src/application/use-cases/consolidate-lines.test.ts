import { describe, it, expect } from 'vitest';
import { consolidateLines } from './consolidate-lines';
import { Line } from '../../domain/entities/line';

describe('consolidateLines', () => {
  it('should return empty array when given no groups', () => {
    expect(consolidateLines([])).toEqual([]);
  });

  it('should return empty array when all groups are empty', () => {
    expect(consolidateLines([[], []])).toEqual([]);
  });

  it('should return lines as-is when there are no duplicates', () => {
    const group1: Line[] = [
      { id: '1', number: 'Line A', phone_number_id: 'pn1', phone_number: '+1111', groups: ['g1'] },
    ];
    const group2: Line[] = [
      { id: '2', number: 'Line B', phone_number_id: 'pn2', phone_number: '+2222', groups: ['g2'] },
    ];

    const result = consolidateLines([group1, group2]);
    expect(result).toHaveLength(2);
    expect(result[0].phone_number).toBe('+1111');
    expect(result[1].phone_number).toBe('+2222');
  });

  it('should deduplicate by phone_number keeping first occurrence fields', () => {
    const group1: Line[] = [
      { id: '1', number: 'Line A', phone_number_id: 'pn1', phone_number: '+1111', groups: ['g1'] },
    ];
    const group2: Line[] = [
      { id: '2', number: 'Line A alt', phone_number_id: 'pn1-alt', phone_number: '+1111', groups: ['g2'] },
    ];

    const result = consolidateLines([group1, group2]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
    expect(result[0].number).toBe('Line A');
    expect(result[0].phone_number_id).toBe('pn1');
  });

  it('should merge groups arrays when duplicates are found', () => {
    const group1: Line[] = [
      { id: '1', number: 'Line A', phone_number_id: 'pn1', phone_number: '+1111', groups: ['g1'] },
    ];
    const group2: Line[] = [
      { id: '2', number: 'Line A', phone_number_id: 'pn1', phone_number: '+1111', groups: ['g2'] },
    ];

    const result = consolidateLines([group1, group2]);
    expect(result).toHaveLength(1);
    expect(result[0].groups).toEqual(['g1', 'g2']);
  });

  it('should handle lines without groups field', () => {
    const group1: Line[] = [
      { id: '1', number: 'Line A', phone_number_id: 'pn1', phone_number: '+1111' },
    ];
    const group2: Line[] = [
      { id: '2', number: 'Line A', phone_number_id: 'pn1', phone_number: '+1111', groups: ['g2'] },
    ];

    const result = consolidateLines([group1, group2]);
    expect(result).toHaveLength(1);
    expect(result[0].groups).toEqual(['g2']);
  });

  it('should deduplicate group IDs when merging', () => {
    const group1: Line[] = [
      { id: '1', number: 'Line A', phone_number_id: 'pn1', phone_number: '+1111', groups: ['g1', 'g2'] },
    ];
    const group2: Line[] = [
      { id: '2', number: 'Line A', phone_number_id: 'pn1', phone_number: '+1111', groups: ['g2', 'g3'] },
    ];

    const result = consolidateLines([group1, group2]);
    expect(result).toHaveLength(1);
    expect(result[0].groups).toEqual(['g1', 'g2', 'g3']);
  });

  it('should handle a single group with multiple lines', () => {
    const group: Line[] = [
      { id: '1', number: 'Line A', phone_number_id: 'pn1', phone_number: '+1111', groups: ['g1'] },
      { id: '2', number: 'Line B', phone_number_id: 'pn2', phone_number: '+2222', groups: ['g1'] },
    ];

    const result = consolidateLines([group]);
    expect(result).toHaveLength(2);
  });

  it('should handle duplicates within the same group', () => {
    const group: Line[] = [
      { id: '1', number: 'Line A', phone_number_id: 'pn1', phone_number: '+1111', groups: ['g1'] },
      { id: '2', number: 'Line A dup', phone_number_id: 'pn1-dup', phone_number: '+1111', groups: ['g1'] },
    ];

    const result = consolidateLines([group]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });
});
