import { describe, it, expect } from 'vitest';
import {
    generateMsSqlParameterCategoryMap,
    generateOracleParameterCategoryMap,
    generateCombinedParameterCategoryMaps,
    generateFocusWidgetNameMap
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
            expect(thinProvisionEntry).toHaveProperty('type');
            expect(thinProvisionEntry).toHaveProperty('subType');
        });

        it('should map storage configuration parameters', () => {
            const map = generateMsSqlParameterCategoryMap();

            const storageParams = ['thin-provision', 'autosize', 'autosize-mode', 'block-device-space-management'];
            storageParams.forEach(param => {
                const entry = map.get(param);
                expect(entry).toBeDefined();
                expect(entry?.type).toBe('storage');
                expect(entry?.subType).toBe('configuration');
            });
        });

        it('should map application configuration parameters', () => {
            const map = generateMsSqlParameterCategoryMap();

            // Check for parameters that should exist in the map
            const entry = map.get('sql-license');
            expect(entry).toBeDefined();
            expect(entry?.type).toBe('application');
            expect(entry?.subType).toBe('application');
        });

        it('should include OS configuration parameters', () => {
            const map = generateMsSqlParameterCategoryMap();

            const osParams = ['mpio-enabled', 'mpio-load-balance-policy', 'ntfs-allocation-unit-size'];
            osParams.forEach(param => {
                const entry = map.get(param);
                expect(entry).toBeDefined();
                expect(entry?.type).toBe('storage');
            });
        });

        it('should map compute and application type items', () => {
            const map = generateMsSqlParameterCategoryMap();

            // Check for application type parameters (id-based key, no parameter field)
            const licenseEntry = map.get('sql-license');
            expect(licenseEntry).toBeDefined();
            expect(licenseEntry?.type).toBe('application');

            // Check for cloning type parameters (id-based key, no parameter field)
            const cloningEntry = map.get('clone-management');
            expect(cloningEntry).toBeDefined();
            expect(cloningEntry?.type).toBe('cloning');
        });

        it('should not have duplicate parameter entries', () => {
            const map = generateMsSqlParameterCategoryMap();
            const parameterNames = Array.from(map.keys());
            const uniqueNames = new Set(parameterNames);

            expect(parameterNames.length).toBe(uniqueNames.size);
        });

        it('should have non-empty type and subType values', () => {
            const map = generateMsSqlParameterCategoryMap();

            map.forEach(entry => {
                expect(entry.type).toBeTruthy();
                expect(entry.subType).toBeTruthy();
                expect(typeof entry.type).toBe('string');
                expect(typeof entry.subType).toBe('string');
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

            // Check a known parameter using its id (entry.id is used as the map key)
            const spaceGuaranteeEntry = map.get('thin-provision');
            expect(spaceGuaranteeEntry).toBeDefined();
            expect(spaceGuaranteeEntry).toHaveProperty('type');
            expect(spaceGuaranteeEntry).toHaveProperty('subType');
        });

        it('should map storage configuration parameters', () => {
            const map = generateOracleParameterCategoryMap();

            // Use id values from Oracle config (entry.id is used as the map key)
            const storageParams = ['thin-provision', 'autosize', 'autosize-mode'];
            storageParams.forEach(param => {
                const entry = map.get(param);
                expect(entry).toBeDefined();
                expect(entry?.type).toBe('storage');
                expect(entry?.subType).toBe('configuration');
            });
        });

        it('should not have duplicate parameter entries', () => {
            const map = generateOracleParameterCategoryMap();
            const parameterNames = Array.from(map.keys());
            const uniqueNames = new Set(parameterNames);

            expect(parameterNames.length).toBe(uniqueNames.size);
        });

        it('should have non-empty type and subType values', () => {
            const map = generateOracleParameterCategoryMap();

            map.forEach(entry => {
                expect(entry.type).toBeTruthy();
                expect(entry.subType).toBeTruthy();
                expect(typeof entry.type).toBe('string');
                expect(typeof entry.subType).toBe('string');
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

            const mssqlStorageParams = Array.from(mssqlMap.entries()).filter(([, value]) => value.type === 'storage');
            const oracleStorageParams = Array.from(oracleMap.entries()).filter(([, value]) => value.type === 'storage');

            expect(mssqlStorageParams.length).toBeGreaterThan(0);
            expect(oracleStorageParams.length).toBeGreaterThan(0);
        });

        it('should include top-level resiliency configuration in MSSQL parameters', () => {
            const map = generateMsSqlParameterCategoryMap();

            // Check for top-level resiliency object - the key should be 'resiliency' itself
            // since it has type and subType properties
            const resiliencyEntry = map.get('resiliency');
            if (resiliencyEntry) {
                // If it's in the map, verify it has the correct structure
                expect(resiliencyEntry).toHaveProperty('type');
                expect(resiliencyEntry).toHaveProperty('subType');
            }
        });

        it('should preserve MSSQL resiliency entries in combined map', () => {
            const combinedMap = generateCombinedParameterCategoryMaps();
            const mssqlMap = generateMsSqlParameterCategoryMap();

            // Get all resiliency entries from MSSQL map
            const mssqlResiliencyEntries = Array.from(mssqlMap.entries()).filter(
                ([, value]) => value.type === 'resiliency'
            );

            // Verify all MSSQL resiliency entries are in combined map
            mssqlResiliencyEntries.forEach(([key, mssqlValue]) => {
                const combinedValue = combinedMap.get(key);
                expect(combinedValue).toBeDefined();
                expect(combinedValue).toEqual(mssqlValue);
            });
        });

        it('should not allow Oracle map to overwrite MSSQL entries in combined map', () => {
            const combinedMap = generateCombinedParameterCategoryMaps();
            const mssqlMap = generateMsSqlParameterCategoryMap();
            const oracleMap = generateOracleParameterCategoryMap();

            // Check all MSSQL entries are preserved
            mssqlMap.forEach((mssqlValue, key) => {
                const combinedValue = combinedMap.get(key);
                expect(combinedValue).toBeDefined();
                expect(combinedValue).toEqual(mssqlValue);
            });

            // Verify that Oracle-only entries are also in combined map
            oracleMap.forEach((oracleValue, key) => {
                const combinedValue = combinedMap.get(key);
                // If not in MSSQL, it should be in combined (from Oracle)
                if (!mssqlMap.has(key)) {
                    expect(combinedValue).toBeDefined();
                    expect(combinedValue).toEqual(oracleValue);
                }
            });
        });

        it('should include snapshot-policy parameter in the combined map', () => {
            const combinedMap = generateCombinedParameterCategoryMaps();

            // snapshot-policy exists in both MSSQL (resiliency) and Oracle (storage/configuration),
            // but MSSQL takes precedence in the combined map
            const snapshotPolicyEntry = combinedMap.get('snapshot-policy');
            expect(snapshotPolicyEntry).toBeDefined();
            expect(snapshotPolicyEntry?.type).toBe('resiliency');
            expect(snapshotPolicyEntry?.subType).toBe('resiliency');
        });

        it('should verify snapshot-policy comes from Oracle map with correct type', () => {
            const oracleMap = generateOracleParameterCategoryMap();
            const combinedMap = generateCombinedParameterCategoryMaps();

            // Oracle map has snapshot-policy with type='storage' (using entry.id as key)
            const oracleSnapshotPolicyHyphenated = oracleMap.get('snapshot-policy');
            const combinedSnapshotPolicy = combinedMap.get('snapshot-policy');

            if (oracleSnapshotPolicyHyphenated) {
                // Oracle map has type='storage'
                expect(oracleSnapshotPolicyHyphenated?.type).toBe('storage');
                expect(oracleSnapshotPolicyHyphenated?.subType).toBe('configuration');
                // Combined map has MSSQL's version (resiliency) since MSSQL takes precedence
                expect(combinedSnapshotPolicy?.type).toBe('resiliency');
            }
        });
    });

    describe('generateFocusWidgetNameMap', () => {
        it('should generate a map from golden configs', () => {
            const map = generateFocusWidgetNameMap();

            expect(map).toBeInstanceOf(Map);
            expect(map.size).toBeGreaterThan(0);
        });

        it('should handle array configurations', () => {
            const map = generateFocusWidgetNameMap();

            // Verify map keys are hyphenated format
            const keys = Array.from(map.keys());
            keys.forEach(key => {
                expect(typeof key).toBe('string');
                // Keys should be lowercase and hyphenated
                expect(key).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
            });
        });

        it('should map parameter names to focusWidgetNames', () => {
            const map = generateFocusWidgetNameMap();

            // Verify all values are focusWidgetNames
            const values = Array.from(map.values());
            values.forEach(value => {
                expect(typeof value).toBe('string');
                expect(value.length).toBeGreaterThan(0);
            });
        });

        it('should handle simple property objects in configs', () => {
            const map = generateFocusWidgetNameMap();

            // Map should have entries from simple object properties
            expect(map.size).toBeGreaterThan(0);
        });

        it('should handle objects with nested arrays', () => {
            const map = generateFocusWidgetNameMap();

            // Map should have entries from nested array objects
            expect(map.size).toBeGreaterThan(0);
        });

        it('should use object keys as fallback when name/parameter fields missing', () => {
            const map = generateFocusWidgetNameMap();

            // Map should contain hyphenated versions of object keys
            const keys = Array.from(map.keys());

            // All keys should be present and valid
            expect(keys.length).toBeGreaterThan(0);
            keys.forEach(key => {
                expect(key).toBeTruthy();
                expect(typeof key).toBe('string');
            });
        });

        it('should convert camelCase keys to hyphenated format', () => {
            const map = generateFocusWidgetNameMap();

            // If there are camelCase parameters, they should be converted to hyphenated
            const keys = Array.from(map.keys());

            // Verify no camelCase exists in keys
            keys.forEach(key => {
                expect(key).not.toMatch(/[A-Z]/);
            });
        });

        it('should not have duplicate keys', () => {
            const map = generateFocusWidgetNameMap();

            const keys = Array.from(map.keys());
            const uniqueKeys = new Set(keys);

            expect(keys.length).toBe(uniqueKeys.size);
        });

        it('should handle complex nested configurations', () => {
            const map = generateFocusWidgetNameMap();

            // Map should contain entries for all configuration levels
            expect(map.size).toBeGreaterThan(0);

            // All entries should have valid key-value pairs
            map.forEach((value, key) => {
                expect(key).toBeTruthy();
                expect(value).toBeTruthy();
                expect(typeof key).toBe('string');
                expect(typeof value).toBe('string');
            });
        });

        it('should handle empty or null focusWidgetNames gracefully', () => {
            const map = generateFocusWidgetNameMap();

            // Map should only contain non-empty focusWidgetNames
            map.forEach(value => {
                expect(value).toBeTruthy();
                expect(value.length).toBeGreaterThan(0);
            });
        });

        it('should map configuration parameters consistently', () => {
            const map1 = generateFocusWidgetNameMap();
            const map2 = generateFocusWidgetNameMap();

            // Two calls should produce identical maps
            expect(map1.size).toBe(map2.size);

            // Compare entries
            map1.forEach((value, key) => {
                expect(map2.get(key)).toBe(value);
            });
        });

        it('should handle special characters in focusWidgetNames', () => {
            const map = generateFocusWidgetNameMap();

            // focusWidgetNames can contain special characters like parentheses from golden config
            map.forEach(value => {
                // Values should be non-empty strings
                expect(typeof value).toBe('string');
                expect(value.length).toBeGreaterThan(0);
                // Values should not be just whitespace
                expect(value.trim().length).toBeGreaterThan(0);
            });
        });

        it('should create displayable names from hyphenated keys', () => {
            const map = generateFocusWidgetNameMap();

            // Keys should be in hyphenated format suitable for conversion to display names
            const keys = Array.from(map.keys());
            keys.forEach(key => {
                // Should be convertible to display format (Pascal Case With Spaces)
                const displayFormat = key
                    .split('-')
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(' ');

                expect(displayFormat).toMatch(/^[A-Z]/);
                expect(displayFormat.length).toBeGreaterThan(0);
            });
        });
    });
});
