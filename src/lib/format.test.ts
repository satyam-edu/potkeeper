import { describe, expect, it } from 'vitest';
import { seatLabels } from './format';

const label = (...names: string[]) => Object.values(seatLabels(names.map((name, i) => ({ userId: `u${i}`, name }))));

describe('seatLabels', () => {
  it('uses the first word of the name', () => {
    expect(label('Harshvardhan aurora', 'Priyanshu Bhardwaj', 'Satyam')).toEqual(['Harshvardhan', 'Priyanshu', 'Satyam']);
  });
  it('lets the next word join a first word of one or two letters', () => {
    expect(label('S Kumar', 'Mr Rao', 'Dr. Mehta', 'Ab')).toEqual(['S Kumar', 'Mr Rao', 'Dr. Mehta', 'Ab']);
  });
  it('tells two of the same first name apart, whatever the case', () => {
    expect(label('Rahul Sharma', 'rahul verma', 'Amit')).toEqual(['Rahul S.', 'rahul V.', 'Amit']);
  });
  it('uses the full name when a duplicate has no second word, and keeps identical names as they are', () => {
    expect(label('Rahul', 'Rahul Sharma')).toEqual(['Rahul', 'Rahul S.']);
    expect(label('Sam', 'Sam')).toEqual(['Sam', 'Sam']);
  });
  it('copes with extra spaces and a single word', () => {
    expect(label('  Ravi   Teja ', 'x')).toEqual(['Ravi', 'x']);
  });
});
