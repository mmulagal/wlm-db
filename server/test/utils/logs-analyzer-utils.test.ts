import { parseConcatenatedJSON, mapSeverityLevel } from '../../src/utils/logs-analyzer/logs-analyzer-utils';

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

describe('mapSeverityLevel', () => {
    it('returns "warning" for severity level 16', () => {
        expect(mapSeverityLevel(16)).toBe('warning');
    });

    it('returns "severe" for severity levels 17-19', () => {
        expect(mapSeverityLevel(17)).toBe('severe');
        expect(mapSeverityLevel(18)).toBe('severe');
        expect(mapSeverityLevel(19)).toBe('severe');
    });

    it('returns "critical" for severity levels 20-24', () => {
        expect(mapSeverityLevel(20)).toBe('critical');
        expect(mapSeverityLevel(21)).toBe('critical');
        expect(mapSeverityLevel(22)).toBe('critical');
        expect(mapSeverityLevel(23)).toBe('critical');
        expect(mapSeverityLevel(24)).toBe('critical');
    });

    it('returns undefined for severity levels below 16', () => {
        expect(mapSeverityLevel(15)).toBeUndefined();
        expect(mapSeverityLevel(10)).toBeUndefined();
        expect(mapSeverityLevel(0)).toBeUndefined();
    });

    it('returns undefined for severity levels above 24', () => {
        expect(mapSeverityLevel(25)).toBeUndefined();
        expect(mapSeverityLevel(30)).toBeUndefined();
    });

    it('returns undefined for undefined input', () => {
        expect(mapSeverityLevel(undefined)).toBeUndefined();
    });

    it('returns undefined for null input', () => {
        expect(mapSeverityLevel(null as any)).toBeUndefined();
    });
});
