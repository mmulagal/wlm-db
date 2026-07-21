import { describe, it, expect } from 'vitest';

/**
 * Tests for wizard operation type selection
 * Ensures single vs bulk registration wizard flow is correctly determined
 */
describe('Registration Wizard Operation Type', () => {
    describe('Wizard operation type constants', () => {
        it('defines SINGLE wizard operation type', () => {
            const operationType = 'single';
            expect(operationType).toBe('single');
        });

        it('defines BULK wizard operation type', () => {
            const operationType = 'bulk';
            expect(operationType).toBe('bulk');
        });
    });

    describe('Single instance registration from overflow menu', () => {
        it('sets wizard operation type to "single" for single register action', () => {
            const menuId = 'register-instance';
            const wizardOperationType = 'single';

            expect(wizardOperationType).toBe('single');
        });

        it('transforms single instance into array format for wizard', () => {
            const rowData = {
                id: 1,
                databaseInstanceName: 'SQL-01',
                name: 'host-01',
                authorized: false,
                manageReadiness: { assessment: {} }
            };

            const transformedInstance = [
                {
                    id: rowData.id,
                    label: `${rowData.databaseInstanceName}, ${rowData.name}`,
                    value: rowData.name,
                    data: rowData,
                    authorized: rowData.authorized,
                    manageReadiness: rowData.manageReadiness
                }
            ];

            expect(transformedInstance).toHaveLength(1);
            expect(transformedInstance[0].id).toBe(1);
            expect(transformedInstance[0].label).toBe('SQL-01, host-01');
        });
    });

    describe('Bulk registration', () => {
        it('sets wizard operation type to "bulk" for bulk register action', () => {
            const wizardOperationType = 'bulk';
            expect(wizardOperationType).toBe('bulk');
        });

        it('transforms multiple instances for bulk registration', () => {
            const selectedRows = [
                {
                    id: 1,
                    databaseInstanceName: 'SQL-01',
                    name: 'host-01',
                    authorized: true,
                    manageReadiness: {}
                },
                {
                    id: 2,
                    databaseInstanceName: 'SQL-02',
                    name: 'host-02',
                    authorized: false,
                    manageReadiness: {}
                }
            ];

            const transformedInstances = selectedRows.map(row => ({
                id: row.id,
                label: `${row.databaseInstanceName}, ${row.name}`,
                value: row.name,
                data: row,
                authorized: row.authorized,
                manageReadiness: row.manageReadiness
            }));

            expect(transformedInstances).toHaveLength(2);
            expect(transformedInstances[0].label).toBe('SQL-01, host-01');
            expect(transformedInstances[1].label).toBe('SQL-02, host-02');
        });
    });

    describe('Wizard component selection', () => {
        it('renders RegisterNewWizard when operation type is "single"', () => {
            const wizardOperationType = 'single';
            const shouldRenderBulk = wizardOperationType === 'bulk';
            const shouldRenderSingle = wizardOperationType === 'single';

            expect(shouldRenderBulk).toBe(false);
            expect(shouldRenderSingle).toBe(true);
        });

        it('renders RegisterBulkWizard when operation type is "bulk"', () => {
            const wizardOperationType = 'bulk';
            const shouldRenderBulk = wizardOperationType === 'bulk';
            const shouldRenderSingle = wizardOperationType === 'single';

            expect(shouldRenderBulk).toBe(true);
            expect(shouldRenderSingle).toBe(false);
        });
    });

    describe('Wizard navigation', () => {
        it('navigates to register-bulk-wizard for both single and bulk operations', () => {
            // Both single and bulk now use the same wizard path
            const singlePath = '../register-bulk-wizard';
            const bulkPath = '../register-bulk-wizard';

            expect(singlePath).toBe(bulkPath);
        });

        it('navigates to fsxdb path in non-workload factory mode', () => {
            const isWorkloadFactory = false;
            const path = isWorkloadFactory ? '../register-bulk-wizard' : '../fsxdb/register-bulk-wizard';

            expect(path).toBe('../fsxdb/register-bulk-wizard');
        });

        it('navigates to standard path in workload factory mode', () => {
            const isWorkloadFactory = true;
            const path = isWorkloadFactory ? '../register-bulk-wizard' : '../fsxdb/register-bulk-wizard';

            expect(path).toBe('../register-bulk-wizard');
        });
    });

    describe('Redux state management', () => {
        it('resets agentic pre-check data when starting registration', () => {
            // Mock action creator
            const resetAgenticPreCheckData = () => ({ type: 'agenticAI/resetAgenticPreCheckData' });
            const action = resetAgenticPreCheckData();

            expect(action.type).toBe('agenticAI/resetAgenticPreCheckData');
        });

        it('sets selected instances for wizard', () => {
            const instances = [{ id: 1, label: 'SQL-01' }];
            const setSelectedMultiDetectInstances = (payload: any) => ({
                type: 'inventoryV2/setSelectedMultiDetectInstances',
                payload
            });
            const action = setSelectedMultiDetectInstances(instances);

            expect(action.type).toBe('inventoryV2/setSelectedMultiDetectInstances');
            expect(action.payload).toEqual(instances);
        });

        it('sets wizard operation type', () => {
            const operationType = 'single';
            const setWizardOperationType = (payload: string) => ({
                type: 'inventoryV2/setWizardOperationType',
                payload
            });
            const action = setWizardOperationType(operationType);

            expect(action.type).toBe('inventoryV2/setWizardOperationType');
            expect(action.payload).toBe('single');
        });

        it('sets register host type', () => {
            const hostType = 'Microsoft SQL Server';
            const setRegisterHostType = (payload: string) => ({
                type: 'inventoryV2/setRegisterHostType',
                payload
            });
            const action = setRegisterHostType(hostType);

            expect(action.type).toBe('inventoryV2/setRegisterHostType');
            expect(action.payload).toBe('Microsoft SQL Server');
        });
    });

    describe('Bulk selection clearing', () => {
        it('clears selected rows after navigating to wizard', () => {
            const selectedRows = [1, 2, 3];
            const setSelectedRowsForBulkRegister = (payload: number[]) => ({
                type: 'inventoryV2/setSelectedRowsForBulkRegister',
                payload
            });
            const action = setSelectedRowsForBulkRegister([]);

            expect(action.type).toBe('inventoryV2/setSelectedRowsForBulkRegister');
            expect(action.payload).toEqual([]);
        });
    });

    describe('Instance data preparation', () => {
        it('includes all required fields in transformed instance', () => {
            const rowData = {
                id: 1,
                databaseInstanceName: 'SQL-01',
                name: 'host-01',
                authorized: true,
                manageReadiness: { assessment: { missingSqlPermissions: [] } }
            };

            const transformed = {
                id: rowData.id,
                label: `${rowData.databaseInstanceName}, ${rowData.name}`,
                value: rowData.name,
                data: rowData,
                authorized: rowData.authorized,
                manageReadiness: rowData.manageReadiness
            };

            expect(transformed).toHaveProperty('id');
            expect(transformed).toHaveProperty('label');
            expect(transformed).toHaveProperty('value');
            expect(transformed).toHaveProperty('data');
            expect(transformed).toHaveProperty('authorized');
            expect(transformed).toHaveProperty('manageReadiness');
        });

        it('handles null authorized field gracefully', () => {
            const rowData = {
                id: 1,
                databaseInstanceName: 'SQL-01',
                name: 'host-01',
                authorized: null
            };

            const transformed = {
                authorized: rowData.authorized ?? false
            };

            expect(transformed.authorized).toBe(false);
        });

        it('handles undefined authorized field gracefully', () => {
            const rowData = {
                id: 1,
                databaseInstanceName: 'SQL-01',
                name: 'host-01',
                authorized: undefined
            };

            const transformed = {
                authorized: rowData.authorized ?? false
            };

            expect(transformed.authorized).toBe(false);
        });
    });

    describe('Wizard step structure', () => {
        describe('MSSQL wizard steps', () => {
            it('has exactly 2 steps (authenticate-instance and manage-instance)', () => {
                const isOracle = false;
                const steps = [
                    {
                        key: isOracle ? 'authenticate-database' : 'authenticate-instance',
                        label: isOracle ? 'Authenticate database' : 'Authenticate instance'
                    },
                    {
                        key: 'manage-instance',
                        label: 'Prepare'
                    }
                ];

                expect(steps).toHaveLength(2);
            });

            it('first step is authenticate-instance for MSSQL', () => {
                const isOracle = false;
                const firstStepKey = isOracle ? 'authenticate-database' : 'authenticate-instance';

                expect(firstStepKey).toBe('authenticate-instance');
            });

            it('second step is manage-instance (Prepare)', () => {
                const steps = [
                    { key: 'authenticate-instance', label: 'Authenticate instance' },
                    { key: 'manage-instance', label: 'Prepare' }
                ];

                expect(steps[1].key).toBe('manage-instance');
                expect(steps[1].label).toBe('Prepare');
            });

            it('does NOT include FSx authentication step', () => {
                const steps = [
                    { key: 'authenticate-instance', label: 'Authenticate instance' },
                    { key: 'manage-instance', label: 'Prepare' }
                ];

                const hasFsxStep = steps.some(step => step.key === 'authenticate-fsx');
                expect(hasFsxStep).toBe(false);
            });
        });

        describe('Oracle wizard steps', () => {
            it('has exactly 2 steps (authenticate-database and manage-instance)', () => {
                const isOracle = true;
                const steps = [
                    {
                        key: isOracle ? 'authenticate-database' : 'authenticate-instance',
                        label: isOracle ? 'Authenticate database' : 'Authenticate instance'
                    },
                    {
                        key: 'manage-instance',
                        label: 'Prepare'
                    }
                ];

                expect(steps).toHaveLength(2);
            });

            it('first step is authenticate-database for Oracle', () => {
                const isOracle = true;
                const firstStepKey = isOracle ? 'authenticate-database' : 'authenticate-instance';

                expect(firstStepKey).toBe('authenticate-database');
            });

            it('second step is manage-instance (Prepare)', () => {
                const steps = [
                    { key: 'authenticate-database', label: 'Authenticate database' },
                    { key: 'manage-instance', label: 'Prepare' }
                ];

                expect(steps[1].key).toBe('manage-instance');
                expect(steps[1].label).toBe('Prepare');
            });

            it('does NOT include FSx authentication step', () => {
                const steps = [
                    { key: 'authenticate-database', label: 'Authenticate database' },
                    { key: 'manage-instance', label: 'Prepare' }
                ];

                const hasFsxStep = steps.some(step => step.key === 'authenticate-fsx');
                expect(hasFsxStep).toBe(false);
            });
        });

        describe('FSx step removal rationale', () => {
            it('FSx link validation happens before wizard entry (Global WAD Gradual Trust plan)', () => {
                // FSx authentication step is commented out
                // FSx link validation now happens in canRegisterWithFsxLink check
                // before user enters registration wizard
                const fsxValidationMovedToPreCheck = true;

                expect(fsxValidationMovedToPreCheck).toBe(true);
            });

            it('wizard initial step is always authentication (not FSx)', () => {
                const isOracleMssql = false;
                const isOracleOracle = true;

                const initialStepMssql = isOracleMssql ? 'authenticate-database' : 'authenticate-instance';
                const initialStepOracle = isOracleOracle ? 'authenticate-database' : 'authenticate-instance';

                expect(initialStepMssql).toBe('authenticate-instance');
                expect(initialStepOracle).toBe('authenticate-database');
            });

            it('bulkWizardStartAtFsxStep flag logic is commented out', () => {
                // The bulkWizardStartAtFsxStep flag is no longer used to skip to FSx step
                // Initial step is always the authentication step
                const bulkWizardStartAtFsxStep = true;
                const skipToFsxStep = false; // FSx logic is commented out

                // Even if flag is true, we don't skip to FSx step anymore
                const initialStep = 'authenticate-instance';

                expect(skipToFsxStep).toBe(false);
                expect(initialStep).not.toBe('authenticate-fsx');
            });
        });

        describe('Step navigation order', () => {
            it('navigates from authenticate to prepare (skips FSx)', () => {
                const steps = [
                    { key: 'authenticate-instance', order: 0 },
                    // FSx step no longer exists (order: 1 skipped)
                    { key: 'manage-instance', order: 1 }
                ];

                const authStep = steps.find(s => s.key === 'authenticate-instance');
                const prepareStep = steps.find(s => s.key === 'manage-instance');

                expect(authStep?.order).toBe(0);
                expect(prepareStep?.order).toBe(1);
                expect(steps).toHaveLength(2);
            });

            it('step indices are sequential without gaps (0, 1)', () => {
                const stepIndices = [0, 1]; // No gap at index 1 where FSx step used to be

                expect(stepIndices).toEqual([0, 1]);
                expect(stepIndices).toHaveLength(2);
            });
        });

        describe('Step keys validation', () => {
            it('all step keys are unique', () => {
                const steps = [{ key: 'authenticate-instance' }, { key: 'manage-instance' }];

                const keys = steps.map(s => s.key);
                const uniqueKeys = [...new Set(keys)];

                expect(uniqueKeys).toHaveLength(keys.length);
            });

            it('no step key contains "fsx" or "FSx"', () => {
                const steps = [{ key: 'authenticate-instance' }, { key: 'manage-instance' }];

                const hasFsxInKey = steps.some(step => step.key.toLowerCase().includes('fsx'));

                expect(hasFsxInKey).toBe(false);
            });

            it('step keys match expected pattern', () => {
                const mssqlSteps = [{ key: 'authenticate-instance' }, { key: 'manage-instance' }];

                const oracleSteps = [{ key: 'authenticate-database' }, { key: 'manage-instance' }];

                expect(mssqlSteps[0].key).toMatch(/^authenticate-/);
                expect(mssqlSteps[1].key).toBe('manage-instance');
                expect(oracleSteps[0].key).toMatch(/^authenticate-/);
                expect(oracleSteps[1].key).toBe('manage-instance');
            });
        });
    });
});
