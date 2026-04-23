import { describe, it, expect, vi } from 'vitest';
import { generateOracleInstanceData, OracleServerInstance } from './OracleAccordionUtils';

// Mock DATABASE_DEPLOYMENT_MODE since it's imported from consts
vi.mock('../../../../../utils/consts', () => ({
    DATABASE_DEPLOYMENT_MODE: {
        STANDALONE: 'Standalone',
        AOAG: 'Always on availability group',
        DATAGUARD: 'Data Guard'
    }
}));

describe('OracleAccordionUtils', () => {
    // =========================================================================
    // generateOracleInstanceData
    // =========================================================================
    describe('generateOracleInstanceData', () => {
        it('should return empty object when storageSavingsResponse is null', () => {
            const result = generateOracleInstanceData(null, {});
            expect(result).toEqual({});
        });

        it('should return empty object when storageSavingsResponse is undefined', () => {
            const result = generateOracleInstanceData(undefined, {});
            expect(result).toEqual({});
        });

        // ---- Single host mode (no hostName) ----

        it('should extract instanceType from first compute entry (single host mode)', () => {
            const response = {
                compute: [
                    {
                        recommended: { instanceType: 'r5.xlarge, m5.xlarge' }
                    }
                ]
            };
            const result = generateOracleInstanceData(response, {});
            expect(result.instanceType).toBe('r5.xlarge');
        });

        it('should handle non-array compute (single object)', () => {
            const response = {
                compute: {
                    recommended: { instanceType: 'm5.2xlarge' }
                }
            };
            const result = generateOracleInstanceData(response, {});
            expect(result.instanceType).toBe('m5.2xlarge');
        });

        it('should return empty instanceType when recommended is missing', () => {
            const response = { compute: [{}] };
            const result = generateOracleInstanceData(response, {});
            expect(result.instanceType).toBe('');
        });

        // ---- Oracle edition from selectedHostDetails ----

        it('should get oracleEdition directly from selectedHostDetails (EBS bulk mode)', () => {
            const response = { compute: [{ recommended: { instanceType: 'm5.xlarge' } }] };
            const hostDetails = { oracleEdition: 'Enterprise' };
            const result = generateOracleInstanceData(response, hostDetails);
            expect(result.oracleEdition).toBe('Enterprise');
        });

        it('should get oracleEdition from oracleDatabases array (on-prem mode)', () => {
            const response = { compute: [{ recommended: { instanceType: 'm5.xlarge' } }] };
            const hostDetails = {
                oracleDatabases: [{ oracleEdition: 'Standard' }, { oracleEdition: 'Enterprise' }]
            };
            const result = generateOracleInstanceData(response, hostDetails);
            expect(result.oracleEdition).toBe('Standard'); // Takes first
        });

        it('should prefer direct oracleEdition over oracleDatabases array', () => {
            const response = { compute: [{ recommended: { instanceType: 'm5.xlarge' } }] };
            const hostDetails = {
                oracleEdition: 'Enterprise',
                oracleDatabases: [{ oracleEdition: 'Standard' }]
            };
            const result = generateOracleInstanceData(response, hostDetails);
            expect(result.oracleEdition).toBe('Enterprise');
        });

        it('should return empty oracleEdition when neither source exists', () => {
            const response = { compute: [{ recommended: { instanceType: 'm5.xlarge' } }] };
            const result = generateOracleInstanceData(response, {});
            expect(result.oracleEdition).toBe('');
        });

        it('should return empty oracleEdition when oracleDatabases is empty array', () => {
            const response = { compute: [{ recommended: { instanceType: 'm5.xlarge' } }] };
            const hostDetails = { oracleDatabases: [] };
            const result = generateOracleInstanceData(response, hostDetails);
            expect(result.oracleEdition).toBe('');
        });

        // ---- Deployment model ----

        it('should always return Standalone as deploymentModel', () => {
            const response = { compute: [{ recommended: { instanceType: 'm5.xlarge' } }] };
            const result = generateOracleInstanceData(response, {});
            expect(result.deploymentModel).toBe('Standalone');
        });

        // ---- Bulk mode (hostName provided) ----

        it('should find compute entry matching hostname in bulk mode (Oracle EBS)', () => {
            const response = {
                compute: [
                    {
                        hostname: 'ip-10-0-141-134.ap-south-1.compute.internal',
                        recommended: { instanceType: 'm5.large' }
                    },
                    {
                        hostname: 'ip-10-0-141-135.ap-south-1.compute.internal',
                        recommended: { instanceType: 'r5.xlarge' }
                    }
                ]
            };
            const result = generateOracleInstanceData(response, {}, 'ip-10-0-141-135.ap-south-1.compute.internal');
            expect(result.instanceType).toBe('r5.xlarge');
        });

        it('should find compute entry matching resourceName in bulk mode (Oracle On-Prem)', () => {
            const response = {
                compute: [
                    { resourceName: 'oracle-host-1', recommended: { instanceType: 'm5.large' } },
                    { resourceName: 'oracle-host-2', recommended: { instanceType: 'r5.xlarge' } }
                ]
            };
            const result = generateOracleInstanceData(response, {}, 'oracle-host-2');
            expect(result.instanceType).toBe('r5.xlarge');
        });

        it('should return empty instanceType when hostName does not match any compute entry', () => {
            const response = {
                compute: [
                    {
                        hostname: 'ip-10-0-141-134.ap-south-1.compute.internal',
                        recommended: { instanceType: 'm5.large' }
                    }
                ]
            };
            const result = generateOracleInstanceData(response, {}, 'ip-99-99-99-99.compute.internal');
            expect(result.instanceType).toBe('');
        });

        // ---- Null selectedHostDetails ----

        it('should handle null selectedHostDetails without throwing', () => {
            const response = { compute: [{ recommended: { instanceType: 'm5.xlarge' } }] };
            const result = generateOracleInstanceData(response, null);
            expect(result.oracleEdition).toBe('');
            expect(result.instanceType).toBe('m5.xlarge');
            expect(result.deploymentModel).toBe('Standalone');
        });
    });

    // =========================================================================
    // OracleServerInstance
    // =========================================================================
    describe('OracleServerInstance', () => {
        const mockT = (key: string) => key;

        it('should return array with 3 items (deployment, edition, instanceType)', () => {
            const oracleInstance = {
                deploymentModel: 'Standalone',
                oracleEdition: 'Enterprise',
                instanceType: 'r5.xlarge'
            };
            const result = OracleServerInstance(oracleInstance, mockT as any);
            expect(result).toHaveLength(3);
        });

        it('should include deployment mode label and value', () => {
            const oracleInstance = { deploymentModel: 'Standalone', oracleEdition: '', instanceType: '' };
            const result = OracleServerInstance(oracleInstance, mockT as any);
            expect(result[0].label).toBe('databases.explore-savings.oracle-deployment-mode-label');
            expect(result[0].value).toBe('Standalone');
        });

        it('should include oracle edition label and value', () => {
            const oracleInstance = { deploymentModel: '', oracleEdition: 'Enterprise', instanceType: '' };
            const result = OracleServerInstance(oracleInstance, mockT as any);
            expect(result[1].label).toBe('databases.explore-savings.oracle-edition-label');
            expect(result[1].value).toBe('Enterprise');
        });

        it('should include instance type label and value', () => {
            const oracleInstance = { deploymentModel: '', oracleEdition: '', instanceType: 'm5.xlarge' };
            const result = OracleServerInstance(oracleInstance, mockT as any);
            expect(result[2].label).toBe('databases.explore-savings.oracle-instance-type-label');
            expect(result[2].value).toBe('m5.xlarge');
        });

        it('should use not-available fallback for missing values', () => {
            const oracleInstance = {};
            const result = OracleServerInstance(oracleInstance, mockT as any);
            expect(result[0].value).toBe('databases.general.not-available');
            expect(result[1].value).toBe('databases.general.not-available');
            expect(result[2].value).toBe('databases.general.not-available');
        });

        it('should handle null oracleInstance', () => {
            const result = OracleServerInstance(null, mockT as any);
            expect(result).toHaveLength(3);
            expect(result[0].value).toBe('databases.general.not-available');
        });
    });
});
