export const offlineAssessmentDemoOracleISCSI = {
    metadata: {
        hostname: 'ORACLE-PROD-ISCSI-01',
        storageEndpoint: 'fs-0d5efc3057c4f12cb',
        assessmentTimestamp: '2026-02-11T05:41:20Z',
        scriptVersion: '1.0.0',
        osVersion: 'Red Hat Enterprise Linux 8.9 (Ootpa)',
        databaseType: 'ORACLE',
        ec2InstanceId: 'demo-oracle-prod-iscsi-001',
        vmName: 'ORACLE-PROD-ISCSI-01',
        virtualNetworkId: 'vpc-046f7e26255458373',
        virtualNetworkName: 'demo-vpc',
        numberOfDatabaseInstances: 1,
        vmPlatform: 'Red Hat Enterprise Linux',
        oracleSid: 'ORCL',
        oracleHome: '/u01/app/oracle/product/19c/db_1',
        deploymentType: 'Standalone',
        fsxId: 'fs-0d5efc3057c4f12cb',
        region: 'ap-southeast-1'
    },
    rawdata: {
        hostLevelDetails: {
            errors: {},
            headroom: {
                ssdStorageCapacityInBytes: 5463910256640,
                storageUsedInBytes: 146218283008,
                storageAvailableInBytes: 5317691973632,
                headroomPercent: 98,
                aggregateCount: 1
            }
        },
        instanceLevelDetails: {
            'oracle-prod-iscsi-001': {
                instanceDetails: {
                    databaseInstanceId: 'oracle-prod-iscsi-001',
                    databaseInstanceName: 'oracle-prod-iscsi-001',
                    oracleHome: '/u01/app/oracle/product/19c/db_1',
                    hostname: 'ip-171-30-40-178.ap-southeast-1.compute.internal',
                    databaseVersion: '19.0.0.0.0',
                    databaseName: 'ORCL',
                    isCDB: true,
                    isASMManaged: true,
                    deploymentType: 'Standalone',
                    pdbNames: ['PDB1', 'PDB2', 'PDB3']
                },
                mappedOntapVolumes: {
                    protocol: 'iSCSI',
                    lunRecords: [
                        {
                            name: '/vol/wlmdb_oracle_extra_demo/lun1',
                            serial: 'DEMO123456789'
                        },
                        {
                            name: '/vol/wlmdb_oracle_log_demo/lun1',
                            serial: 'DEMO987654321'
                        },
                        {
                            name: '/vol/wlmdb_oracle_recovery_demo/lun1',
                            serial: 'DEMO456789123'
                        }
                    ],
                    isASMManaged: true,
                    volumeMappings: [
                        {
                            ORCL: {
                                isCDB: true,
                                ontapVolumes: {
                                    PDB1: {
                                        REDO_LOGS: [
                                            {
                                                volumeName: 'wlmdb_oracle_extra_demo',
                                                volumeId: '8e0f0014-06f2-11f1-a170-7143fc0c8c33',
                                                svmName: 'wlmdb_svm_demo',
                                                svmId: 'b2853ecd-b1f9-11ef-a881-1fbfd81226d0',
                                                lunName: '/vol/wlmdb_oracle_extra_demo/lun1',
                                                lunId: '89cc9266-1ca5-480d-a2ee-80dd66b07707',
                                                copiesCount: 0,
                                                diskName: 'DISK5',
                                                diskGroup: 'DATARG'
                                            },
                                            {
                                                volumeName: 'wlmdb_oracle_log_demo',
                                                volumeId: '102562ed-06f2-11f1-a170-7143fc0c8c33',
                                                svmName: 'wlmdb_svm_demo',
                                                svmId: 'b2853ecd-b1f9-11ef-a881-1fbfd81226d0',
                                                lunName: '/vol/wlmdb_oracle_log_demo/lun1',
                                                lunId: 'd97bf8aa-4a65-413d-a5a4-4829c990cf08',
                                                copiesCount: 0,
                                                diskName: 'DISK2',
                                                diskGroup: 'DATADG'
                                            },
                                            {
                                                volumeName: 'wlmdb_oracle_recovery_demo',
                                                volumeId: '3432e123-06f2-11f1-a170-7143fc0c8c33',
                                                svmName: 'wlmdb_svm_demo',
                                                svmId: 'b2853ecd-b1f9-11ef-a881-1fbfd81226d0',
                                                lunName: '/vol/wlmdb_oracle_recovery_demo/lun1',
                                                lunId: '4fccaa86-f9e5-40df-9789-0494374fc867',
                                                copiesCount: 0,
                                                diskName: 'DISK3',
                                                diskGroup: 'DATADG'
                                            }
                                        ],
                                        ARCHIVE_LOGS: [],
                                        CONTROL_FILES: [
                                            {
                                                volumeName: 'wlmdb_oracle_log_demo',
                                                volumeId: '102562ed-06f2-11f1-a170-7143fc0c8c33',
                                                svmName: 'wlmdb_svm_demo',
                                                svmId: 'b2853ecd-b1f9-11ef-a881-1fbfd81226d0',
                                                lunName: '/vol/wlmdb_oracle_log_demo/lun1',
                                                lunId: 'd97bf8aa-4a65-413d-a5a4-4829c990cf08',
                                                copiesCount: 0,
                                                diskName: 'DISK2',
                                                diskGroup: 'DATADG'
                                            },
                                            {
                                                volumeName: 'wlmdb_oracle_recovery_demo',
                                                volumeId: '3432e123-06f2-11f1-a170-7143fc0c8c33',
                                                svmName: 'wlmdb_svm_demo',
                                                svmId: 'b2853ecd-b1f9-11ef-a881-1fbfd81226d0',
                                                lunName: '/vol/wlmdb_oracle_recovery_demo/lun1',
                                                lunId: '4fccaa86-f9e5-40df-9789-0494374fc867',
                                                copiesCount: 0,
                                                diskName: 'DISK3',
                                                diskGroup: 'DATADG'
                                            },
                                            {
                                                volumeName: 'wlmdb_oracle_extra_demo',
                                                volumeId: '8e0f0014-06f2-11f1-a170-7143fc0c8c33',
                                                svmName: 'wlmdb_svm_demo',
                                                svmId: 'b2853ecd-b1f9-11ef-a881-1fbfd81226d0',
                                                lunName: '/vol/wlmdb_oracle_extra_demo/lun1',
                                                lunId: '89cc9266-1ca5-480d-a2ee-80dd66b07707',
                                                copiesCount: 0,
                                                diskName: 'DISK5',
                                                diskGroup: 'DATARG'
                                            }
                                        ],
                                        TEMP_FILES: [
                                            {
                                                volumeName: 'wlmdb_oracle_log_demo',
                                                volumeId: '102562ed-06f2-11f1-a170-7143fc0c8c33',
                                                svmName: 'wlmdb_svm_demo',
                                                svmId: 'b2853ecd-b1f9-11ef-a881-1fbfd81226d0',
                                                lunName: '/vol/wlmdb_oracle_log_demo/lun1',
                                                lunId: 'd97bf8aa-4a65-413d-a5a4-4829c990cf08',
                                                copiesCount: 0,
                                                diskName: 'DISK2',
                                                diskGroup: 'DATADG'
                                            },
                                            {
                                                volumeName: 'wlmdb_oracle_recovery_demo',
                                                volumeId: '3432e123-06f2-11f1-a170-7143fc0c8c33',
                                                svmName: 'wlmdb_svm_demo',
                                                svmId: 'b2853ecd-b1f9-11ef-a881-1fbfd81226d0',
                                                lunName: '/vol/wlmdb_oracle_recovery_demo/lun1',
                                                lunId: '4fccaa86-f9e5-40df-9789-0494374fc867',
                                                copiesCount: 0,
                                                diskName: 'DISK3',
                                                diskGroup: 'DATADG'
                                            }
                                        ],
                                        DATA_FILES: [
                                            {
                                                volumeName: 'wlmdb_oracle_log_demo',
                                                volumeId: '102562ed-06f2-11f1-a170-7143fc0c8c33',
                                                svmName: 'wlmdb_svm_demo',
                                                svmId: 'b2853ecd-b1f9-11ef-a881-1fbfd81226d0',
                                                lunName: '/vol/wlmdb_oracle_log_demo/lun1',
                                                lunId: 'd97bf8aa-4a65-413d-a5a4-4829c990cf08',
                                                copiesCount: 0,
                                                diskName: 'DISK2',
                                                diskGroup: 'DATADG'
                                            },
                                            {
                                                volumeName: 'wlmdb_oracle_recovery_demo',
                                                volumeId: '3432e123-06f2-11f1-a170-7143fc0c8c33',
                                                svmName: 'wlmdb_svm_demo',
                                                svmId: 'b2853ecd-b1f9-11ef-a881-1fbfd81226d0',
                                                lunName: '/vol/wlmdb_oracle_recovery_demo/lun1',
                                                lunId: '4fccaa86-f9e5-40df-9789-0494374fc867',
                                                copiesCount: 0,
                                                diskName: 'DISK3',
                                                diskGroup: 'DATADG'
                                            }
                                        ],
                                        FRA: [
                                            {
                                                volumeName: 'wlmdb_oracle_extra_demo',
                                                volumeId: '8e0f0014-06f2-11f1-a170-7143fc0c8c33',
                                                svmName: 'wlmdb_svm_demo',
                                                svmId: 'b2853ecd-b1f9-11ef-a881-1fbfd81226d0',
                                                lunName: '/vol/wlmdb_oracle_extra_demo/lun1',
                                                lunId: '89cc9266-1ca5-480d-a2ee-80dd66b07707',
                                                copiesCount: 0,
                                                diskName: 'DISK5',
                                                diskGroup: 'DATARG'
                                            }
                                        ]
                                    }
                                }
                            }
                        }
                    ]
                },
                storage: {
                    volumes: {
                        error: '',
                        data: [
                            {
                                name: 'wlmdb_oracle_log_demo',
                                uuid: '102562ed-06f2-11f1-a170-7143fc0c8c33',
                                thinProvision: true,
                                spaceGuarantee: 'none',
                                autosizeMode: 'off',
                                autosize: 'off',
                                fractionalReserve: 100,
                                snapshotCopyReserve: 10,
                                snapshotAutodelete: false,
                                snapshotPolicy: 'default',
                                tieringPolicy: 'snapshot_only',
                                tieringMinCoolingDays: 35,
                                svmName: 'wlmdb_svm_demo',
                                compression: 'inline',
                                compressionType: 'adaptive',
                                compaction: 'inline',
                                deduplication: 'background',
                                efficiencyType: 'efficient',
                                snapshotDeleteOrder: 'oldest_first',
                                spaceMgmtTryFirst: 'snap_delete',
                                junctionPath: '/wlmdb_oracle_log_demo'
                            },
                            {
                                name: 'wlmdb_oracle_recovery_demo',
                                uuid: '3432e123-06f2-11f1-a170-7143fc0c8c33',
                                thinProvision: true,
                                spaceGuarantee: 'none',
                                autosizeMode: 'off',
                                autosize: 'off',
                                fractionalReserve: 100,
                                snapshotCopyReserve: 10,
                                snapshotAutodelete: false,
                                snapshotPolicy: 'default',
                                tieringPolicy: 'snapshot_only',
                                tieringMinCoolingDays: 35,
                                svmName: 'wlmdb_svm_demo',
                                compression: 'inline',
                                compressionType: 'adaptive',
                                compaction: 'inline',
                                deduplication: 'background',
                                efficiencyType: 'efficient',
                                snapshotDeleteOrder: 'oldest_first',
                                spaceMgmtTryFirst: 'snap_delete',
                                junctionPath: '/wlmdb_oracle_recovery_demo'
                            },
                            {
                                name: 'wlmdb_oracle_extra_demo',
                                uuid: '8e0f0014-06f2-11f1-a170-7143fc0c8c33',
                                thinProvision: true,
                                spaceGuarantee: 'none',
                                autosizeMode: 'off',
                                autosize: 'off',
                                fractionalReserve: 100,
                                snapshotCopyReserve: 10,
                                snapshotAutodelete: false,
                                snapshotPolicy: 'default',
                                tieringPolicy: 'snapshot_only',
                                tieringMinCoolingDays: 35,
                                svmName: 'wlmdb_svm_demo',
                                compression: 'inline',
                                compressionType: 'adaptive',
                                compaction: 'inline',
                                deduplication: 'background',
                                efficiencyType: 'efficient',
                                snapshotDeleteOrder: 'oldest_first',
                                spaceMgmtTryFirst: 'snap_delete',
                                junctionPath: '/wlmdb_oracle_extra_demo'
                            }
                        ],
                        filesystemId: 'fs-0d5efc3057c4f12cb'
                    },
                    luns: {
                        error: '',
                        data: [
                            {
                                name: '/vol/wlmdb_oracle_log_demo/lun1',
                                uuid: 'd97bf8aa-4a65-413d-a5a4-4829c990cf08',
                                osType: 'linux',
                                spaceReservationEnabled: false,
                                spaceAllocationAllocated: false
                            },
                            {
                                name: '/vol/wlmdb_oracle_recovery_demo/lun1',
                                uuid: '4fccaa86-f9e5-40df-9789-0494374fc867',
                                osType: 'linux',
                                spaceReservationEnabled: false,
                                spaceAllocationAllocated: false
                            },
                            {
                                name: '/vol/wlmdb_oracle_extra_demo/lun1',
                                uuid: '89cc9266-1ca5-480d-a2ee-80dd66b07707',
                                osType: 'linux',
                                spaceReservationEnabled: false,
                                spaceAllocationAllocated: false
                            }
                        ]
                    },
                    binaryVolumes: {
                        error: '',
                        data: [
                            {
                                volumeId: null,
                                volumeName: 'root',
                                oracleHome: '/u01/app/oracle/product/19c/db_1',
                                isNfsMount: false,
                                hasBinaries: true,
                                mountPath: null,
                                nfsInfo: null,
                                oracleSid: 'ORCL'
                            }
                        ]
                    },
                    fraEnabled: 'yes',
                    rmanCompressionEnabled: 'no',
                    errors: {},
                    sizing: {
                        swapSpace: {
                            ramSizeInKb: '7659652',
                            swapSizeInKb: '16777212',
                            hugepagesSizeInKb: '0'
                        }
                    }
                },
                os: {
                    'multipath-io': {
                        'multipath-io-is-active': true,
                        'multipath-io-is-enabled': true,
                        'multipath-io-active-value': 'active',
                        'multipath-io-enabled-value': 'enabled',
                        error: null
                    },
                    'host-utilities': {
                        'sanlun-installed': false,
                        'sanlun-version': null,
                        error: 'sanlun command not found',
                        'os-version': 'rhel8'
                    },
                    'iscsi-targets-sessions': {
                        'iscsi-targets-found': 2,
                        'iscsi-targets': [
                            {
                                portal: '10.0.0.100:3260,1031 iqn.1992-08.com.netapp:sn.demo123:vs.345',
                                target_name: '10.0.0.100',
                                active_sessions: 1
                            },
                            {
                                portal: '10.0.0.101:3260,1032 iqn.1992-08.com.netapp:sn.demo123:vs.345',
                                target_name: '10.0.0.101',
                                active_sessions: 0
                            }
                        ],
                        'iscsi-sessions-per-target': {
                            '10.0.0.100': 1,
                            '10.0.0.101': 0
                        },
                        'total-active-sessions': 1,
                        error: null
                    },
                    'transparent-hugepages': {
                        'thp-disabled': true,
                        'thp-value': 'disabled',
                        error: null
                    },
                    selinux: {
                        'selinux-disabled': true,
                        'selinux-value': 'permissive',
                        error: null
                    },
                    'iscsi-replacement-timeout': {
                        'replacement-timeout': 120,
                        error: null
                    },
                    'tcp-advanced-options': {
                        'tcp-features': {
                            'tcp-timestamps-enabled': true,
                            'tcp-timestamps-value': '1',
                            'tcp-sack-enabled': true,
                            'tcp-sack-value': '1',
                            'tcp-window-scaling-enabled': true,
                            'tcp-window-scaling-value': '1'
                        },
                        error: null
                    },
                    'multipath-configuration': {
                        'multipath-config-found': true,
                        error: null,
                        defaults: {
                            find_multipaths: 'off',
                            user_friendly_names: 'yes',
                            polling_interval: 5
                        },
                        'netapp-device': {
                            vendor: 'NETAPP',
                            product: 'LUN',
                            path_grouping_policy: 'group_by_prio',
                            features: '2 pg_init_retries 50',
                            prio: 'ontap',
                            failback: 'immediate',
                            no_path_retry: 'queue',
                            flush_on_last_del: 'yes',
                            dev_loss_tmo: 'infinity',
                            user_friendly_names: 'no'
                        }
                    },
                    'oracle-parameters': {
                        'filesystemio-options': {
                            found: true,
                            value: 'none'
                        },
                        'db-file-multiblock-read-count': {
                            found: true,
                            value: '128'
                        },
                        error: null
                    },
                    'oracle-parameters-from-init': {
                        'db-file-multiblock-read-count-in-init': [],
                        'current-spfile-info': {
                            'spfile-path': '+DATADG/ORCL/PARAMETERFILE/spfile.269.1227496693',
                            'spfile-type': 'spfile',
                            'is-default': true,
                            error: null
                        },
                        error: 'SPFile path found but file does not exist: +DATADG/ORCL/PARAMETERFILE/spfile.269.1227496693'
                    },
                    'asm-os-config': {
                        isIscsi: 'true',
                        'asm-setup': 'true',
                        'asm-external-redundancy': {
                            error: '',
                            assessment: {
                                violations: [],
                                result: 'true',
                                totalObjects: 2
                            }
                        },
                        'afd-logical-block-size': {
                            assessment: {
                                result: '1'
                            },
                            error: ''
                        },
                        'asmlib-logical-block-size': {
                            assessment: {
                                result: 'Y'
                            },
                            error: ''
                        }
                    }
                },
                pluggableDatabases: [
                    {
                        pdbName: 'PDB1',
                        pdbId: '3',
                        pdbStatus: 'NORMAL',
                        pdbSizeInBytes: 161061273600,
                        pdbCreationTime: '2024-01-10T08:15:00',
                        serviceName: 'PDB1'
                    },
                    {
                        pdbName: 'PDB2',
                        pdbId: '4',
                        pdbStatus: 'NORMAL',
                        pdbSizeInBytes: 128849018880,
                        pdbCreationTime: '2024-01-10T08:20:00',
                        serviceName: 'PDB2'
                    },
                    {
                        pdbName: 'PDB3',
                        pdbId: '5',
                        pdbStatus: 'NORMAL',
                        pdbSizeInBytes: 96636764160,
                        pdbCreationTime: '2024-01-10T08:25:00',
                        serviceName: 'PDB3'
                    }
                ],
                isDataGuardDeployed: false,
                dataguardDetails: {},
                clone: {
                    cloneDetails: []
                },
                snapcenter: {
                    isDataguardPrimary: false,
                    volumes: [
                        {
                            svmId: '6c800e9f-06f2-11f1-a170-7143fc0c8c33',
                            svmName: 'wlmdb_svm_demo',
                            volumeId: '8e0f0014-06f2-11f1-a170-7143fc0c8c33',
                            volumeName: 'wlmdb_oracle_extra_demo',
                            hasSnapcenterSnapshot: true,
                            foundInSnapcenterLogs: true
                        },
                        {
                            svmId: '6c800e9f-06f2-11f1-a170-7143fc0c8c33',
                            svmName: 'wlmdb_svm_demo',
                            volumeId: '102562ed-06f2-11f1-a170-7143fc0c8c33',
                            volumeName: 'wlmdb_oracle_log_demo',
                            hasSnapcenterSnapshot: true,
                            foundInSnapcenterLogs: true
                        },
                        {
                            svmId: '6c800e9f-06f2-11f1-a170-7143fc0c8c33',
                            svmName: 'wlmdb_svm_demo',
                            volumeId: '3432e123-06f2-11f1-a170-7143fc0c8c33',
                            volumeName: 'wlmdb_oracle_recovery_demo',
                            hasSnapcenterSnapshot: true,
                            foundInSnapcenterLogs: true
                        }
                    ],
                    standaloneCheck: {
                        pluginServiceRunning: true,
                        sidFoundInLogs: true
                    },
                    errorMessage: ''
                }
            }
        },
        errors: []
    }
};
