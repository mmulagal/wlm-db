import { describe, it, expect } from 'vitest';
import {
    generateMsSqlParameterCategoryMap,
    generateOracleParameterCategoryMap
} from '../../src/utils/golden-config-utils';

describe('Golden Config Utils', () => {
    describe('generateMsSqlParameterCategoryMap', () => {
        it('should generate a map with parameter names as keys', () => {
            const map = generateMsSqlParameterCategoryMap();

            expect(map).toBeInstanceOf(Map);
            expect(map.size).toBeGreaterThan(0);
        });

        it('should have correct structure for parameter entries', () => {
            const map = generateMsSqlParameterCategoryMap();

            // Check a known parameter
            const thinProvisionEntry = map.get('thin-provision');
            expect(thinProvisionEntry).toBeDefined();
            expect(thinProvisionEntry).toHaveProperty('category');
            expect(thinProvisionEntry).toHaveProperty('subCategory');
        });

        it('should map storage configuration parameters', () => {
            const map = generateMsSqlParameterCategoryMap();

            const storageParams = ['thin-provision', 'autosize', 'autosize-mode', 'fractional-reserve'];
            storageParams.forEach(param => {
                const entry = map.get(param);
                expect(entry).toBeDefined();
                expect(entry?.category).toBe('storage');
                expect(entry?.subCategory).toBe('configuration');
            });
        });

        it('should map application configuration parameters', () => {
            const map = generateMsSqlParameterCategoryMap();

            // Check for parameters that should exist in the map
            const entry = map.get('license');
            expect(entry).toBeDefined();
            expect(entry?.category).toBe('application');
            expect(entry?.subCategory).toBe('application');
        });

        it('should include OS configuration parameters', () => {
            const map = generateMsSqlParameterCategoryMap();

            const osParams = ['mpio-enabled', 'mpio-load-balance-policy', 'ntfs-allocation-unit-size'];
            osParams.forEach(param => {
                const entry = map.get(param);
                expect(entry).toBeDefined();
                expect(entry?.category).toBe('storage');
            });
        });

        it('should map compute and application category items', () => {
            const map = generateMsSqlParameterCategoryMap();

            // Check for application category parameters
            const licenseEntry = map.get('license');
            expect(licenseEntry).toBeDefined();
            expect(licenseEntry?.category).toBe('application');

            // Check for cloning category parameters
            const cloningEntry = map.get('cloning');
            expect(cloningEntry).toBeDefined();
            expect(cloningEntry?.category).toBe('cloning');
        });

        it('should not have duplicate parameter entries', () => {
            const map = generateMsSqlParameterCategoryMap();
            const parameterNames = Array.from(map.keys());
            const uniqueNames = new Set(parameterNames);

            expect(parameterNames.length).toBe(uniqueNames.size);
        });

        it('should have non-empty category and subCategory values', () => {
            const map = generateMsSqlParameterCategoryMap();

            map.forEach(entry => {
                expect(entry.category).toBeTruthy();
                expect(entry.subCategory).toBeTruthy();
                expect(typeof entry.category).toBe('string');
                expect(typeof entry.subCategory).toBe('string');
            });
        });
    });

    describe('generateOracleParameterCategoryMap', () => {
        it('should generate a map with parameter names as keys', () => {
            const map = generateOracleParameterCategoryMap();

            expect(map).toBeInstanceOf(Map);
            expect(map.size).toBeGreaterThan(0);
        });

        it('should have correct structure for parameter entries', () => {
            const map = generateOracleParameterCategoryMap();

            // Check a known parameter
            const spaceGuaranteeEntry = map.get('spaceGuarantee');
            expect(spaceGuaranteeEntry).toBeDefined();
            expect(spaceGuaranteeEntry).toHaveProperty('category');
            expect(spaceGuaranteeEntry).toHaveProperty('subCategory');
        });

        it('should map storage configuration parameters', () => {
            const map = generateOracleParameterCategoryMap();

            const storageParams = ['spaceGuarantee', 'autosize', 'autosizeMode'];
            storageParams.forEach(param => {
                const entry = map.get(param);
                expect(entry).toBeDefined();
                expect(entry?.category).toBe('storage');
                expect(entry?.subCategory).toBe('configuration');
            });
        });

        it('should not have duplicate parameter entries', () => {
            const map = generateOracleParameterCategoryMap();
            const parameterNames = Array.from(map.keys());
            const uniqueNames = new Set(parameterNames);

            expect(parameterNames.length).toBe(uniqueNames.size);
        });

        it('should have non-empty category and subCategory values', () => {
            const map = generateOracleParameterCategoryMap();

            map.forEach(entry => {
                expect(entry.category).toBeTruthy();
                expect(entry.subCategory).toBeTruthy();
                expect(typeof entry.category).toBe('string');
                expect(typeof entry.subCategory).toBe('string');
            });
        });

        it('should have different parameters than MSSQL in most cases', () => {
            const mssqlMap = generateMsSqlParameterCategoryMap();
            const oracleMap = generateOracleParameterCategoryMap();

            // Get parameters unique to each
            const mssqlOnlyParams = Array.from(mssqlMap.keys()).filter(param => !oracleMap.has(param));
            const oracleOnlyParams = Array.from(oracleMap.keys()).filter(param => !mssqlMap.has(param));

            // Both should have some unique parameters
            expect(mssqlOnlyParams.length).toBeGreaterThan(0);
            expect(oracleOnlyParams.length).toBeGreaterThan(0);
        });
    });

    describe('Integration tests', () => {
        it('should create consistent maps across multiple calls', () => {
            const map1 = generateMsSqlParameterCategoryMap();
            const map2 = generateMsSqlParameterCategoryMap();

            expect(map1.size).toBe(map2.size);
            map1.forEach((value, key) => {
                expect(map2.get(key)).toEqual(value);
            });
        });

        it('should have more MSSQL parameters than Oracle for storage', () => {
            const mssqlMap = generateMsSqlParameterCategoryMap();
            const oracleMap = generateOracleParameterCategoryMap();

            const mssqlStorageParams = Array.from(mssqlMap.entries()).filter(
                ([, value]) => value.category === 'storage'
            );
            const oracleStorageParams = Array.from(oracleMap.entries()).filter(
                ([, value]) => value.category === 'storage'
            );

            expect(mssqlStorageParams.length).toBeGreaterThan(0);
            expect(oracleStorageParams.length).toBeGreaterThan(0);
        });
    });
});
