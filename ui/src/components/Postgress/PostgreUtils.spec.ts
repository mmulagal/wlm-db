import { describe, it, expect, vi, beforeEach } from 'vitest';

import { createPgsqlPayload, handleCreatePgsql } from './PostgreUtils';

// Mock modules that access external state (Redux store)
vi.mock('../../utils/utilityFunctions', () => ({
    isFsxnNew: (val: any) => val === 'fsxn_new',
    isFsxnExisting: (val: any) => val === 'fsxn_existing',
    isValidUserName: (userName: string) => {
        if (userName && (userName.length < 5 || userName === 'admin')) return 'Invalid username';
        return undefined;
    },
    fsxPassVal: vi.fn().mockReturnValue('')
}));

vi.mock('../../store/mssql/msSqlActionSlice', () => ({
    setCreatePressed: (val: any) => ({ type: 'msSqlAction/setCreatePressed', payload: val }),
    setCreateHit: (val: any) => ({ type: 'msSqlAction/setCreateHit', payload: val }),
    setVPCSelectedValue: (val: any) => ({ type: 'msSqlAction/setVPCSelectedValue', payload: val }),
    setAZSelectedValue: (val: any) => ({ type: 'msSqlAction/setAZSelectedValue', payload: val }),
    setFSXNNameValue: (val: any) => ({ type: 'msSqlAction/setFSXNNameValue', payload: val }),
    setPgDBNameValue: (val: any) => ({ type: 'msSqlAction/setPgDBNameValue', payload: val }),
    setDBCredentialPasswordValue: (val: any) => ({ type: 'msSqlAction/setDBCredentialPasswordValue', payload: val })
}));

vi.mock('../../store/notificationSlice', () => ({
    addNotification: (val: any) => ({ type: 'notification/addNotification', payload: val }),
    NOTIFICATION_TYPES: { ERROR: 'error', INFO: 'info' }
}));

// ─── Helpers ────────────────────────────────────────────────────────────────

const buildState = (overrides: any = {}) => ({
    mssqlForm: {
        regionAndVpc: {
            selectedVPC: { data: { id: 'vpc-123', cidrBlock: '10.0.0.0/16' } },
            selectedRegion: { data: { regionCode: 'us-east-1' } }
        },
        availabilityZones: {
            selectedAzNode1: { value: 'us-east-1a' },
            selectedSubnetNode1: { data: { id: 'subnet-1', routeTableId: 'rt-1' } },
            selectedAzNode2: { value: 'us-east-1b' },
            selectedSubnetNode2: { data: { id: 'subnet-2', routeTableId: 'rt-2' } }
        },
        securityGroup: {
            selectedSecurityType: '',
            selectedExistingSecurityGroup: { value: '' }
        },
        instanceType: { value: 't3.medium' },
        keyPair: { selectedKeyPair: { value: 'my-keypair' } },
        fsxN: {
            fsxNType: 'fsxn_new',
            fsxNNewUserName: 'fsxadmin',
            fsxNPassword: 'Password1',
            fsxNExistingName: null,
            fsxNExistingUserName: ''
        },
        storageCapacity: { capacity: 100, unit: { value: 'GiB' } },
        provisionedIOPS: { provisionedType: 'Automatic', IOPSValue: 0 },
        throughput: { value: '128 MBps' },
        simpleNotification: { snsState: false, snsARN: '' },
        cloudWatch: true,
        snapshotPolicyToggle: true,
        encryption: {
            encryptionType: 'Select a key from your account',
            selectedRow: [{ id: 'kms-key-1' }],
            encryptionArn: ''
        },
        tags: [{ key: 'env', value: 'prod' }],
        dbDeploymentModel: { label: 'Failover cluster instance (FCI)', value: 'fci' },
        dbCredentials: { name: 'sqluser', password: 'MyPass1!' },
        selectConfig: 'Standard create',
        ...overrides.mssqlForm
    },
    postgreForm: {
        postgreServerName: 'pgsqlserver',
        postgreVersion: { value: 'postgresql16' },
        ...overrides.postgreForm
    },
    auth: { isDemoMode: false, ...overrides.auth },
    chatbot: { isShow: false, ...overrides.chatbot }
});

// ─── createPgsqlPayload ──────────────────────────────────────────────────────

describe('createPgsqlPayload', () => {
    describe('encryption key', () => {
        it('returns kms key id when encryptionType is "Select from your account" with selectedRow', () => {
            const state = buildState();
            const payload = createPgsqlPayload(state);
            expect(payload.fsxConfiguration.encryptionKey).toBe('kms-key-1');
        });

        it('returns empty string when "Select from your account" but selectedRow is null', () => {
            const state = buildState({
                mssqlForm: {
                    encryption: { encryptionType: 'Select from your account', selectedRow: null, encryptionArn: '' }
                }
            });
            const payload = createPgsqlPayload(state);
            expect(payload.fsxConfiguration.encryptionKey).toBe('');
        });

        it('returns encryptionArn when encryptionType is not "Select from your account"', () => {
            const state = buildState({
                mssqlForm: {
                    encryption: {
                        encryptionType: 'Enter ARN from another account',
                        selectedRow: null,
                        encryptionArn: 'arn:aws:kms:us-east-1:123456789012:key/my-key'
                    }
                }
            });
            const payload = createPgsqlPayload(state);
            expect(payload.fsxConfiguration.encryptionKey).toBe('arn:aws:kms:us-east-1:123456789012:key/my-key');
        });
    });

    describe('file system (FSxN new vs existing)', () => {
        it('uses new FSxN credentials when type is fsxn_new', () => {
            const state = buildState();
            const payload = createPgsqlPayload(state);
            expect(payload.fsxConfiguration.fsxFileSystemId).toBe('');
            expect(payload.fsxConfiguration.fsxUsername).toBe('fsxadmin');
            expect(payload.fsxConfiguration.fsxPassword).toBe('Password1');
        });

        it('uses existing FSxN data when type is fsxn_existing', () => {
            const state = buildState({
                mssqlForm: {
                    fsxN: {
                        fsxNType: 'fsxn_existing',
                        fsxNExistingName: { data: { fileSystemId: 'fs-abc123', securityGroups: ['sg-1'] } },
                        fsxNExistingUserName: 'existinguser',
                        fsxNPassword: 'ExistPass1',
                        fsxNNewUserName: 'fsxadmin'
                    }
                }
            });
            const payload = createPgsqlPayload(state);
            expect(payload.fsxConfiguration.fsxFileSystemId).toBe('fs-abc123');
            expect(payload.fsxConfiguration.fsxUsername).toBe('existinguser');
            expect(payload.fsxConfiguration.fsxPassword).toBe('ExistPass1');
        });
    });

    describe('database size / storage capacity', () => {
        it('returns capacity in GiB as-is', () => {
            const state = buildState({
                mssqlForm: { storageCapacity: { capacity: 100, unit: { value: 'GiB' } } }
            });
            const payload = createPgsqlPayload(state);
            expect(payload.fsxConfiguration.databaseSize).toBe(100);
        });

        it('converts TiB capacity to GiB (multiplied by 1024)', () => {
            const state = buildState({
                mssqlForm: { storageCapacity: { capacity: 2, unit: { value: 'TiB' } } }
            });
            const payload = createPgsqlPayload(state);
            expect(payload.fsxConfiguration.databaseSize).toBe(2048);
        });

        it('defaults to 0 when capacity is not set', () => {
            const state = buildState({
                mssqlForm: { storageCapacity: { capacity: undefined, unit: { value: 'GiB' } } }
            });
            const payload = createPgsqlPayload(state);
            expect(payload.fsxConfiguration.databaseSize).toBe(0);
        });
    });

    describe('throughput', () => {
        it('returns numeric MBps value from string "128 MBps"', () => {
            const state = buildState({ mssqlForm: { throughput: { value: '128 MBps' } } });
            const payload = createPgsqlPayload(state);
            expect(payload.fsxConfiguration.fsxVolThroughput).toBe('128');
        });

        it('converts GBps to MBps (multiplied by 1024) for "1 GBps"', () => {
            const state = buildState({ mssqlForm: { throughput: { value: '1 GBps' } } });
            const payload = createPgsqlPayload(state);
            expect(payload.fsxConfiguration.fsxVolThroughput).toBe(1024);
        });

        it('returns raw value when no space in throughput string', () => {
            const state = buildState({ mssqlForm: { throughput: { value: '512' } } });
            const payload = createPgsqlPayload(state);
            expect(payload.fsxConfiguration.fsxVolThroughput).toBe('512');
        });

        it('defaults to "128" when throughput is undefined', () => {
            const state = buildState({ mssqlForm: { throughput: null } });
            const payload = createPgsqlPayload(state);
            expect(payload.fsxConfiguration.fsxVolThroughput).toBe('128');
        });
    });

    describe('IOPS', () => {
        it('returns 3 when provisionedType is "Automatic"', () => {
            const state = buildState({
                mssqlForm: { provisionedIOPS: { provisionedType: 'Automatic', IOPSValue: 5000 } }
            });
            const payload = createPgsqlPayload(state);
            expect(payload.fsxConfiguration.fsxIOPS).toBe(3);
        });

        it('returns specified IOPSValue when not Automatic', () => {
            const state = buildState({
                mssqlForm: { provisionedIOPS: { provisionedType: 'Provisioned', IOPSValue: 3000 } }
            });
            const payload = createPgsqlPayload(state);
            expect(payload.fsxConfiguration.fsxIOPS).toBe(3000);
        });

        it('returns 0 when not Automatic and IOPSValue is not set', () => {
            const state = buildState({
                mssqlForm: { provisionedIOPS: { provisionedType: 'Provisioned', IOPSValue: 0 } }
            });
            const payload = createPgsqlPayload(state);
            expect(payload.fsxConfiguration.fsxIOPS).toBe(0);
        });
    });

    describe('security group list', () => {
        it('includes existing security group id when type is "Use an existing security group"', () => {
            const state = buildState({
                mssqlForm: {
                    securityGroup: {
                        selectedSecurityType: 'Use an existing security group',
                        selectedExistingSecurityGroup: [{ data: { id: 'sg-existing' } }]
                    }
                }
            });
            const payload = createPgsqlPayload(state);
            expect(payload.fsxConfiguration.ontapSgGroupId).toContain('sg-existing');
        });

        it('includes multiple existing security group ids', () => {
            const state = buildState({
                mssqlForm: {
                    securityGroup: {
                        selectedSecurityType: 'Use an existing security group',
                        selectedExistingSecurityGroup: [
                            { data: { id: 'sg-existing-1' } },
                            { data: { id: 'sg-existing-2' } }
                        ]
                    }
                }
            });
            const payload = createPgsqlPayload(state);
            expect(payload.fsxConfiguration.ontapSgGroupId).toContain('sg-existing-1');
            expect(payload.fsxConfiguration.ontapSgGroupId).toContain('sg-existing-2');
        });

        it('does not auto-include FSxN security groups when using existing FSxN', () => {
            const state = buildState({
                mssqlForm: {
                    securityGroup: { selectedSecurityType: '', selectedExistingSecurityGroup: { value: '' } },
                    fsxN: {
                        fsxNType: 'fsxn_existing',
                        fsxNExistingName: {
                            data: {
                                fileSystemId: 'fs-1',
                                securityGroups: ['sg-fsxn-1', 'sg-fsxn-2'],
                                deploymentType: 'MULTI_AZ_1'
                            }
                        },
                        fsxNExistingUserName: 'user',
                        fsxNPassword: 'pass',
                        fsxNNewUserName: 'fsxadmin'
                    }
                }
            });
            const payload = createPgsqlPayload(state);
            expect(payload.fsxConfiguration.ontapSgGroupId).toEqual([]);
        });

        it('returns empty array when no security group selected', () => {
            const state = buildState({
                mssqlForm: {
                    securityGroup: { selectedSecurityType: '', selectedExistingSecurityGroup: { value: '' } }
                }
            });
            const payload = createPgsqlPayload(state);
            expect(payload.fsxConfiguration.ontapSgGroupId).toEqual([]);
        });

        it('adds up to 4 SGs (max selection) to ontapSgGroupIdsList', () => {
            const state = buildState({
                mssqlForm: {
                    securityGroup: {
                        selectedSecurityType: 'Use an existing security group',
                        selectedExistingSecurityGroup: [
                            { data: { id: 'sg-1' } },
                            { data: { id: 'sg-2' } },
                            { data: { id: 'sg-3' } },
                            { data: { id: 'sg-4' } }
                        ]
                    }
                }
            });
            const payload = createPgsqlPayload(state);
            expect(payload.fsxConfiguration.ontapSgGroupId).toHaveLength(4);
            expect(payload.fsxConfiguration.ontapSgGroupId).toContain('sg-1');
            expect(payload.fsxConfiguration.ontapSgGroupId).toContain('sg-4');
        });

        it('extracts SG id from sg.id fallback when data.id is absent', () => {
            const state = buildState({
                mssqlForm: {
                    securityGroup: {
                        selectedSecurityType: 'Use an existing security group',
                        selectedExistingSecurityGroup: [{ id: 'sg-from-id' }]
                    }
                }
            });
            const payload = createPgsqlPayload(state);
            expect(payload.fsxConfiguration.ontapSgGroupId).toContain('sg-from-id');
        });

        it('extracts SG id from sg.value fallback when data.id and id are absent', () => {
            const state = buildState({
                mssqlForm: {
                    securityGroup: {
                        selectedSecurityType: 'Use an existing security group',
                        selectedExistingSecurityGroup: [{ value: 'sg-from-value' }]
                    }
                }
            });
            const payload = createPgsqlPayload(state);
            expect(payload.fsxConfiguration.ontapSgGroupId).toContain('sg-from-value');
        });
    });

    describe('FSx deployment mode', () => {
        it('uses existing FSxN deployment type when available', () => {
            const state = buildState({
                mssqlForm: {
                    fsxN: {
                        fsxNType: 'fsxn_existing',
                        fsxNExistingName: {
                            data: { fileSystemId: 'fs-1', securityGroups: [], deploymentType: 'MULTI_AZ_1' }
                        },
                        fsxNExistingUserName: 'user',
                        fsxNPassword: 'pass',
                        fsxNNewUserName: 'fsxadmin'
                    }
                }
            });
            const payload = createPgsqlPayload(state);
            expect(payload.fsxConfiguration.fsxDeploymentMode).toBe('MULTI_AZ_1');
        });

        it('returns SINGLE_AZ_1 when standalone deployment model', () => {
            const state = buildState({
                mssqlForm: { dbDeploymentModel: { label: 'Single instance', value: 'standalone' } }
            });
            const payload = createPgsqlPayload(state);
            expect(payload.fsxConfiguration.fsxDeploymentMode).toBe('SINGLE_AZ_1');
        });

        it('returns MULTI_AZ_1 when failover cluster deployment model', () => {
            const state = buildState({
                mssqlForm: { dbDeploymentModel: { label: 'Failover cluster instance (FCI)', value: 'fci' } }
            });
            const payload = createPgsqlPayload(state);
            expect(payload.fsxConfiguration.fsxDeploymentMode).toBe('MULTI_AZ_1');
        });

        it('falls through to deployment model when existing FSxN has no deploymentType', () => {
            const state = buildState({
                mssqlForm: {
                    fsxN: {
                        fsxNType: 'fsxn_existing',
                        fsxNExistingName: { data: { fileSystemId: 'fs-1', securityGroups: [], deploymentType: '' } },
                        fsxNExistingUserName: 'user',
                        fsxNPassword: 'pass',
                        fsxNNewUserName: 'fsxadmin'
                    },
                    dbDeploymentModel: { label: 'Single instance', value: 'standalone' }
                }
            });
            const payload = createPgsqlPayload(state);
            expect(payload.fsxConfiguration.fsxDeploymentMode).toBe('SINGLE_AZ_1');
        });
    });

    describe('snapshot policy', () => {
        it('returns "daily_weekretention" when snapshotPolicyToggle is true', () => {
            const state = buildState({ mssqlForm: { snapshotPolicyToggle: true } });
            const payload = createPgsqlPayload(state);
            expect(payload.fsxConfiguration.snapshotPolicy).toBe('daily_weekretention');
        });

        it('returns "none" when snapshotPolicyToggle is false', () => {
            const state = buildState({ mssqlForm: { snapshotPolicyToggle: false } });
            const payload = createPgsqlPayload(state);
            expect(payload.fsxConfiguration.snapshotPolicy).toBe('none');
        });
    });

    describe('SQL configuration', () => {
        it('uses "ha" sqlDeploymentMode for EASY_CREATE config', () => {
            const state = buildState({ mssqlForm: { selectConfig: 'Quick create' } });
            const payload = createPgsqlPayload(state);
            expect(payload.sqlConfiguration.sqlDeploymentMode).toBe('ha');
        });

        it('uses "ha" for Standard create with failover cluster', () => {
            const state = buildState({
                mssqlForm: {
                    selectConfig: 'Standard create',
                    dbDeploymentModel: { label: 'Failover cluster instance (FCI)', value: 'fci' }
                }
            });
            const payload = createPgsqlPayload(state);
            expect(payload.sqlConfiguration.sqlDeploymentMode).toBe('ha');
        });

        it('uses "standalone" for Standard create with standalone', () => {
            const state = buildState({
                mssqlForm: {
                    selectConfig: 'Standard create',
                    dbDeploymentModel: { label: 'Single instance', value: 'standalone' }
                }
            });
            const payload = createPgsqlPayload(state);
            expect(payload.sqlConfiguration.sqlDeploymentMode).toBe('standalone');
        });

        it('sets postgreServerName and postgreVersion in sqlConfiguration', () => {
            const state = buildState({
                postgreForm: { postgreServerName: 'mypgsql', postgreVersion: { value: 'postgresql15' } }
            });
            const payload = createPgsqlPayload(state);
            expect(payload.sqlConfiguration.sqlServerName).toBe('mypgsql');
            expect(payload.sqlConfiguration.sqlVersion).toBe('postgresql15');
        });
    });

    describe('network and other fields', () => {
        it('includes VPC id and CIDR in networkConfiguration', () => {
            const state = buildState();
            const payload = createPgsqlPayload(state);
            expect(payload.networkConfiguration.vpcId).toBe('vpc-123');
            expect(payload.networkConfiguration.vpcCidr).toBe('10.0.0.0/16');
        });

        it('includes availability zone values', () => {
            const state = buildState();
            const payload = createPgsqlPayload(state);
            expect(payload.networkConfiguration.availabilityZone1).toBe('us-east-1a');
            expect(payload.networkConfiguration.availabilityZone2).toBe('us-east-1b');
        });

        it('sets topicArn when sns state is true', () => {
            const state = buildState({
                mssqlForm: {
                    simpleNotification: { snsState: true, snsARN: { value: 'arn:aws:sns:us-east-1:123:topic' } }
                }
            });
            const payload = createPgsqlPayload(state);
            expect(payload.topicArn).toBe('arn:aws:sns:us-east-1:123:topic');
        });

        it('sets topicArn to empty string when sns state is false', () => {
            const state = buildState({
                mssqlForm: { simpleNotification: { snsState: false, snsARN: '' } }
            });
            const payload = createPgsqlPayload(state);
            expect(payload.topicArn).toBe('');
        });

        it('filters out empty tag keys', () => {
            const state = buildState({
                mssqlForm: {
                    tags: [
                        { key: 'env', value: 'test' },
                        { key: '', value: 'empty' }
                    ]
                }
            });
            const payload = createPgsqlPayload(state);
            expect(payload.tags).toHaveLength(1);
            expect(payload.tags[0].key).toBe('env');
        });

        it('returns empty arrays/strings when optional fields are null', () => {
            const state = buildState({
                mssqlForm: {
                    regionAndVpc: { selectedVPC: null, selectedRegion: null },
                    availabilityZones: {
                        selectedAzNode1: null,
                        selectedSubnetNode1: null,
                        selectedAzNode2: null,
                        selectedSubnetNode2: null
                    },
                    instanceType: null,
                    keyPair: { selectedKeyPair: null }
                }
            });
            const payload = createPgsqlPayload(state);
            expect(payload.networkConfiguration.vpcId).toBe('');
            expect(payload.networkConfiguration.availabilityZone1).toBe('');
            expect(payload.ec2Configuration.workloadInstanceType).toBe('');
            expect(payload.ec2Configuration.keyPairName).toBe('');
        });
    });
});

// ─── handleCreatePgsql ───────────────────────────────────────────────────────

describe('handleCreatePgsql', () => {
    let dispatch: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        dispatch = vi.fn();
        vi.clearAllMocks();
    });

    it('calls setCreatePressed(true) and setCreateHit on every call', () => {
        const state = buildState({ auth: { isDemoMode: true } });
        handleCreatePgsql(state, dispatch);
        expect(dispatch).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'msSqlAction/setCreatePressed', payload: true })
        );
        expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'msSqlAction/setCreateHit' }));
    });

    describe('demo mode', () => {
        it('returns payload directly in demo mode without validation', () => {
            const state = buildState({ auth: { isDemoMode: true } });
            const payload = handleCreatePgsql(state, dispatch);
            expect(payload).toBeDefined();
            expect(payload).toHaveProperty('networkConfiguration');
        });
    });

    describe('normal mode validation', () => {
        it('returns payload when all fields are valid', async () => {
            const { fsxPassVal } = vi.mocked(await import('../../utils/utilityFunctions'));
            (fsxPassVal as any).mockReturnValue('');

            const state = buildState({
                auth: { isDemoMode: false },
                postgreForm: { postgreServerName: 'myserver', postgreVersion: { value: 'postgresql16' } },
                mssqlForm: {
                    dbCredentials: { name: 'sqluser', password: 'MyPass1!' },
                    fsxN: {
                        fsxNType: 'fsxn_new',
                        fsxNPassword: 'FsxPass1',
                        fsxNNewUserName: 'fsxadmin',
                        fsxNExistingName: null,
                        fsxNExistingUserName: ''
                    }
                }
            });

            const payload = handleCreatePgsql(state, dispatch);
            expect(payload).toBeDefined();
            expect(dispatch).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'msSqlAction/setVPCSelectedValue', payload: true })
            );
            expect(dispatch).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'msSqlAction/setAZSelectedValue', payload: true })
            );
        });

        it('dispatches setVPCSelectedValue(false) when VPC is not selected', () => {
            const state = buildState({
                auth: { isDemoMode: false },
                mssqlForm: { regionAndVpc: { selectedVPC: null, selectedRegion: null } }
            });
            handleCreatePgsql(state, dispatch);
            expect(dispatch).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'msSqlAction/setVPCSelectedValue', payload: false })
            );
        });

        it('dispatches setAZSelectedValue(false) when failover cluster AZ is missing', () => {
            const state = buildState({
                auth: { isDemoMode: false },
                mssqlForm: {
                    dbDeploymentModel: { label: 'Failover cluster instance (FCI)', value: 'fci' },
                    availabilityZones: {
                        selectedAzNode1: null,
                        selectedSubnetNode1: null,
                        selectedAzNode2: null,
                        selectedSubnetNode2: null
                    }
                }
            });
            handleCreatePgsql(state, dispatch);
            expect(dispatch).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'msSqlAction/setAZSelectedValue', payload: false })
            );
        });

        it('dispatches setAZSelectedValue(false) when single instance AZ node1 is missing', () => {
            const state = buildState({
                auth: { isDemoMode: false },
                mssqlForm: {
                    dbDeploymentModel: { label: 'Single Instance', value: 'standalone' },
                    availabilityZones: {
                        selectedAzNode1: null,
                        selectedSubnetNode1: null,
                        selectedAzNode2: { value: 'us-east-1b' },
                        selectedSubnetNode2: { data: { id: 'subnet-2', routeTableId: 'rt-2' } }
                    }
                }
            });
            handleCreatePgsql(state, dispatch);
            expect(dispatch).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'msSqlAction/setAZSelectedValue', payload: false })
            );
        });

        it('dispatches setDBCredentialPasswordValue(false) when password is empty', () => {
            const state = buildState({
                auth: { isDemoMode: false },
                mssqlForm: { dbCredentials: { name: 'sqluser', password: '' } }
            });
            handleCreatePgsql(state, dispatch);
            expect(dispatch).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'msSqlAction/setDBCredentialPasswordValue', payload: false })
            );
        });

        it('dispatches setFSXNNameValue when new FSxN has no password', () => {
            const state = buildState({
                auth: { isDemoMode: false },
                mssqlForm: {
                    fsxN: {
                        fsxNType: 'fsxn_new',
                        fsxNPassword: '',
                        fsxNNewUserName: 'fsxadmin',
                        fsxNExistingName: null,
                        fsxNExistingUserName: ''
                    }
                }
            });
            handleCreatePgsql(state, dispatch);
            expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'msSqlAction/setFSXNNameValue' }));
        });

        it('dispatches setFSXNNameValue when existing FSxN has no selected name', () => {
            const state = buildState({
                auth: { isDemoMode: false },
                mssqlForm: {
                    fsxN: {
                        fsxNType: 'fsxn_existing',
                        fsxNPassword: 'pass',
                        fsxNNewUserName: 'fsxadmin',
                        fsxNExistingName: null,
                        fsxNExistingUserName: ''
                    }
                }
            });
            handleCreatePgsql(state, dispatch);
            expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'msSqlAction/setFSXNNameValue' }));
        });

        it('dispatches setPgDBNameValue(false) for invalid db name > 15 chars', () => {
            const state = buildState({
                auth: { isDemoMode: false },
                postgreForm: {
                    postgreServerName: 'thisnameiswaytooolongname',
                    postgreVersion: { value: 'postgresql16' }
                }
            });
            handleCreatePgsql(state, dispatch);
            expect(dispatch).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'msSqlAction/setPgDBNameValue', payload: false })
            );
        });

        it('dispatches setPgDBNameValue(false) when name starts with non-alphanumeric char', () => {
            const state = buildState({
                auth: { isDemoMode: false },
                postgreForm: { postgreServerName: '-invalid', postgreVersion: { value: 'postgresql16' } }
            });
            handleCreatePgsql(state, dispatch);
            expect(dispatch).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'msSqlAction/setPgDBNameValue', payload: false })
            );
        });

        it('dispatches setPgDBNameValue(false) when name has special characters', () => {
            const state = buildState({
                auth: { isDemoMode: false },
                postgreForm: { postgreServerName: 'name@sql', postgreVersion: { value: 'postgresql16' } }
            });
            handleCreatePgsql(state, dispatch);
            expect(dispatch).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'msSqlAction/setPgDBNameValue', payload: false })
            );
        });

        it('dispatches error notification when chatbot is visible and fields are missing', () => {
            const state = buildState({
                auth: { isDemoMode: false },
                chatbot: { isShow: true },
                mssqlForm: { regionAndVpc: { selectedVPC: null, selectedRegion: null } }
            });
            handleCreatePgsql(state, dispatch);
            expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'notification/addNotification' }));
        });

        it('does NOT dispatch error notification when chatbot is hidden and fields are missing', () => {
            const state = buildState({
                auth: { isDemoMode: false },
                chatbot: { isShow: false },
                mssqlForm: { regionAndVpc: { selectedVPC: null, selectedRegion: null } }
            });
            handleCreatePgsql(state, dispatch);
            const notificationCalls = dispatch.mock.calls.filter(
                (call: any) => call[0]?.type === 'notification/addNotification'
            );
            expect(notificationCalls.length).toBe(0);
        });

        it('returns undefined when validation fails', () => {
            const state = buildState({
                auth: { isDemoMode: false },
                mssqlForm: { regionAndVpc: { selectedVPC: null, selectedRegion: null } }
            });
            const payload = handleCreatePgsql(state, dispatch);
            expect(payload).toBeUndefined();
        });
    });
});
