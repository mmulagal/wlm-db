import { parseConcatenatedJSON } from '../../src/utils/logs-analyzer/logs-analyzer-utils';

describe('parseConcatenatedJSON', () => {
    it('parses a single JSON object', () => {
        const input = '{"a":1}';
        const result = parseConcatenatedJSON(input);
        expect(result).toEqual([{ a: 1 }]);
    });

    it('parses multiple concatenated JSON objects', () => {
        const input = '{"a":1}{"b":2}';
        const result = parseConcatenatedJSON(input);
        expect(result).toEqual([{ a: 1 }, { b: 2 }]);
    });

    it('parses concatenated JSON objects with whitespace', () => {
        const input = '{"a":1}   {"b":2}\n{"c":3}';
        const result = parseConcatenatedJSON(input);
        expect(result).toEqual([{ a: 1 }, { b: 2 }, { c: 3 }]);
    });

    it('throws on invalid JSON', () => {
        const input = '{"a":1}{invalid}';
        expect(() => parseConcatenatedJSON(input)).toThrow();
    });
});
