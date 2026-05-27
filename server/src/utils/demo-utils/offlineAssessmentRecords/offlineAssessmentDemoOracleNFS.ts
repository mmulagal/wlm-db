export const offlineAssessmentDemoOracleNFS = {
    metadata: {
        hostname: 'ORACLE-PROD-NFS-01',
        storageEndpoint: 'fs-0d5efc3057c4f12cb',
        assessmentTimestamp: '2026-02-11T05:41:20Z',
        scriptVersion: '1.0.0',
        osVersion: 'Red Hat Enterprise Linux 8.9 (Ootpa)',
        databaseType: 'ORACLE',
        ec2InstanceId: 'demo-oracle-prod-nfs-001',
        vmName: 'ORACLE-PROD-NFS-01',
        virtualNetworkId: 'vpc-046f7e26255458373',
        virtualNetworkName: 'demo-vpc',
        numberOfDatabaseInstances: 1,
        vmPlatform: 'Red Hat Enterprise Linux',
        oracleSid: 'ORCL',
        oracleHome: '/u01/app/oracle/product/21c/db_1',
        deploymentType: 'Standalone',
        fsxId: 'fs-0d5efc3057c4f12cb',
        region: 'ap-southeast-1'
    },
    rawdata: {
        hostLevelDetails: {
            errors: {},
            headroom: {
                ssdStorageCapacityInBytes: 5463910256640,
                storageUsedInBytes: 152763052032,
                storageAvailableInBytes: 5311147204608,
                headroomPercent: 98,
                aggregateCount: 1
            }
        },
        instanceLevelDetails: {
            'oracle-prod-nfs-01': {
                instanceDetails: {
                    databaseInstanceId: 'oracle-prod-nfs-01',
                    databaseInstanceName: 'oracle-prod-nfs-01',
                    oracleHome: '/u01/app/oracle/product/21c/db_1',
                    hostname: 'ip-171-30-40-179.ap-southeast-1.compute.internal',
                    databaseVersion: '21.0.0.0.0',
                    databaseName: 'ORCL',
                    isCDB: true,
                    isASMManaged: false,
                    deploymentType: 'Standalone',
                    pdbNames: ['PDB1']
                },
                mappedOntapVolumes: {
                    protocol: 'NFS',
                    lunRecords: [],
                    isASMManaged: false,
                    volumeMappings: [
                        {
                            ORCL: {
                                isCDB: true,
                                ontapVolumes: {
                                    PDB1: {
                                        REDO_LOGS: [
                                            {
                                                volumeName: 'wlmdb_oracle_redo_demo',
                                                volumeId: '40365dd0-06f2-11f1-a170-7143fc0c8c33',
                                                svmName: 'wlmdb_svm_demo',
                                                svmId: 'b2853ecd-b1f9-11ef-a881-1fbfd81226d0',
                                                copiesCount: 2
                                            }
                                        ],
                                        ARCHIVE_LOGS: [
                                            {
                                                volumeName: 'wlmdb_oracle_archive_demo',
                                                volumeId: '162f3991-06f2-11f1-a170-7143fc0c8c33',
                                                svmName: 'wlmdb_svm_demo',
                                                svmId: 'b2853ecd-b1f9-11ef-a881-1fbfd81226d0',
                                                copiesCount: 1
                                            }
                                        ],
                                        CONTROL_FILES: [
                                            {
                                                volumeName: 'wlmdb_oracle_data_demo',
                                                volumeId: 'ec0ea203-06f2-11f1-a170-7143fc0c8c33',
                                                svmName: 'wlmdb_svm_demo',
                                                svmId: 'b2853ecd-b1f9-11ef-a881-1fbfd81226d0',
                                                copiesCount: 1
                                            },
                                            {
                                                volumeName: 'wlmdb_oracle_redo_demo',
                                                volumeId: '40365dd0-06f2-11f1-a170-7143fc0c8c33',
                                                svmName: 'wlmdb_svm_demo',
                                                svmId: 'b2853ecd-b1f9-11ef-a881-1fbfd81226d0',
                                                copiesCount: 1
                                            }
                                        ],
                                        TEMP_FILES: [
                                            {
                                                volumeName: 'wlmdb_oracle_redo_demo',
                                                volumeId: '40365dd0-06f2-11f1-a170-7143fc0c8c33',
                                                svmName: 'wlmdb_svm_demo',
                                                svmId: 'b2853ecd-b1f9-11ef-a881-1fbfd81226d0',
                                                copiesCount: 1
                                            }
                                        ],
                                        DATA_FILES: [
                                            {
                                                volumeName: 'wlmdb_oracle_data_demo',
                                                volumeId: 'ec0ea203-06f2-11f1-a170-7143fc0c8c33',
                                                svmName: 'wlmdb_svm_demo',
                                                svmId: 'b2853ecd-b1f9-11ef-a881-1fbfd81226d0',
                                                copiesCount: 4
                                            }
                                        ],
                                        FRA: []
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
                                name: 'wlmdb_oracle_archive_demo',
                                uuid: '162f3991-06f2-11f1-a170-7143fc0c8c33',
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
                                junctionPath: '/wlmdb_oracle_archive_demo'
                            },
                            {
                                name: 'wlmdb_oracle_redo_demo',
                                uuid: '40365dd0-06f2-11f1-a170-7143fc0c8c33',
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
                                junctionPath: '/wlmdb_oracle_redo_demo'
                            },
                            {
                                name: 'wlmdb_oracle_data_demo',
                                uuid: 'ec0ea203-06f2-11f1-a170-7143fc0c8c33',
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
                                junctionPath: '/wlmdb_oracle_data_demo'
                            }
                        ],
                        filesystemId: 'fs-0d5efc3057c4f12cb'
                    },
                    luns: {
                        error: 'LUNs not applicable',
                        data: []
                    },
                    binaryVolumes: {
                        error: '',
                        data: [
                            {
                                volumeId: null,
                                volumeName: 'root',
                                oracleHome: '/u01/app/oracle/product/21c/db_1',
                                isNfsMount: false,
                                hasBinaries: true,
                                mountPath: null,
                                nfsInfo: null,
                                oracleSid: 'ORCL'
                            }
                        ]
                    },
                    fraEnabled: 'no',
                    rmanCompressionEnabled: 'no',
                    errors: {},
                    dnfsServers: {
                        error: null,
                        data: [
                            {
                                dirname: '/wlmdb_oracle_data_demo',
                                svrname: '10.0.0.100',
                                nfsversion: 'NFSv3.0'
                            },
                            {
                                dirname: '/wlmdb_oracle_redo_demo',
                                svrname: '10.0.0.100',
                                nfsversion: 'NFSv3.0'
                            }
                        ]
                    },
                    nfsv4DomainData: {
                        error: null,
                        data: {
                            v4IdDomain: 'demo.local',
                            v40Enabled: true,
                            v41Enabled: true
                        }
                    },
                    nfsRootonly: [
                        {
                            svmName: 'wlmdb_svm_demo',
                            nfsRootonly: 'enabled'
                        }
                    ],
                    sizing: {
                        swapSpace: {
                            ramSizeInKb: '7745680',
                            swapSizeInKb: '16777212',
                            hugepagesSizeInKb: '0'
                        }
                    }
                },
                os: {
                    'kernel-parameters': {
                        'sunrpc-tcp-slot-entries': {
                            'tcp-max-slot-table': '65536',
                            'tcp-slot-table': '2'
                        },
                        error: null
                    },
                    'nfs-mount-options': {
                        'nfs-mount-options': [
                            {
                                server: '10.0.0.100',
                                'remote-path': '/wlmdb_oracle_data_demo',
                                'mount-point': '/mnt/oradata',
                                'filesystem-type': 'nfs',
                                options: {
                                    rw: true,
                                    relatime: true,
                                    vers: '3',
                                    rsize: '262144',
                                    wsize: '262144',
                                    namlen: '255',
                                    hard: true,
                                    proto: 'tcp',
                                    timeo: '600',
                                    retrans: '2',
                                    sec: 'sys',
                                    mountaddr: '10.0.0.100',
                                    mountvers: '3',
                                    mountport: '635',
                                    mountproto: 'udp',
                                    local_lock: 'none',
                                    addr: '10.0.0.100',
                                    bg: false,
                                    nointr: false
                                }
                            },
                            {
                                server: '10.0.0.100',
                                'remote-path': '/wlmdb_oracle_data_demo',
                                'mount-point': '/mnt/oradata_clone',
                                'filesystem-type': 'nfs',
                                options: {
                                    rw: true,
                                    relatime: true,
                                    vers: '3',
                                    rsize: '262144',
                                    wsize: '262144',
                                    namlen: '255',
                                    hard: true,
                                    proto: 'tcp',
                                    timeo: '600',
                                    retrans: '2',
                                    sec: 'sys',
                                    mountaddr: '10.0.0.100',
                                    mountvers: '3',
                                    mountport: '635',
                                    mountproto: 'udp',
                                    local_lock: 'none',
                                    addr: '10.0.0.100',
                                    bg: false,
                                    nointr: false
                                }
                            },
                            {
                                server: '10.0.0.100',
                                'remote-path': '/wlmdb_oracle_archive_demo',
                                'mount-point': '/mnt/oraarch',
                                'filesystem-type': 'nfs',
                                options: {
                                    rw: true,
                                    relatime: true,
                                    vers: '3',
                                    rsize: '262144',
                                    wsize: '262144',
                                    namlen: '255',
                                    hard: true,
                                    proto: 'tcp',
                                    timeo: '600',
                                    retrans: '2',
                                    sec: 'sys',
                                    mountaddr: '10.0.0.100',
                                    mountvers: '3',
                                    mountport: '635',
                                    mountproto: 'udp',
                                    local_lock: 'none',
                                    addr: '10.0.0.100',
                                    bg: false,
                                    nointr: false
                                }
                            },
                            {
                                server: '10.0.0.100',
                                'remote-path': '/wlmdb_oracle_redo_demo',
                                'mount-point': '/mnt/oraredoctl',
                                'filesystem-type': 'nfs',
                                options: {
                                    rw: true,
                                    relatime: true,
                                    vers: '3',
                                    rsize: '262144',
                                    wsize: '262144',
                                    namlen: '255',
                                    hard: true,
                                    proto: 'tcp',
                                    timeo: '600',
                                    retrans: '2',
                                    sec: 'sys',
                                    mountaddr: '10.0.0.100',
                                    mountvers: '3',
                                    mountport: '635',
                                    mountproto: 'udp',
                                    local_lock: 'none',
                                    addr: '10.0.0.100',
                                    bg: false,
                                    nointr: false
                                }
                            }
                        ],
                        error: null
                    },
                    'nfs-exports': {
                        'nfs-exports': {
                            '10.0.0.100': [
                                '/wlmdb_oracle_data_demo',
                                '/wlmdb_oracle_archive_demo',
                                '/wlmdb_oracle_redo_demo'
                            ]
                        },
                        error: null
                    },
                    'idmapd-domain-config': {
                        'config-file': '/etc/idmapd.conf',
                        domain: null,
                        'config-exists': true,
                        error: 'No domain configuration found in idmapd.conf'
                    },
                    'hostname-domain': {
                        domain: 'demo.local',
                        error: null
                    },
                    'dnfs-oranfstab': {
                        oranfstab_servers: [
                            {
                                server: 'demo-fs',
                                paths: ['10.0.0.100'],
                                exports: [
                                    { export: '/wlmdb_oracle_data_demo', mount: '/mnt/oradata' },
                                    { export: '/wlmdb_oracle_archive_demo', mount: '/mnt/oraarch' },
                                    { export: '/wlmdb_oracle_redo_demo', mount: '/mnt/oraredoctl' }
                                ],
                                nfs_version: 'NFSv3',
                                options: {
                                    rsize: '262144',
                                    wsize: '262144',
                                    tcp_nodelay: true
                                }
                            }
                        ],
                        error: null
                    },
                    'dnfs-ip-resolution': {
                        dns_resolution: {
                            '10.0.0.100': ['10.0.0.100'],
                            'demo-fs': ['10.0.0.100']
                        },
                        error: null
                    }
                },
                pluggableDatabases: [
                    {
                        pdbName: 'PDB1',
                        pdbId: '3',
                        pdbStatus: 'NORMAL',
                        pdbSizeInBytes: 150323855360,
                        pdbCreationTime: '2024-01-12T10:30:00',
                        serviceName: 'PDB1'
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
                            volumeId: 'ec0ea203-06f2-11f1-a170-7143fc0c8c33',
                            volumeName: 'wlmdb_oracle_data_demo',
                            hasSnapcenterSnapshot: false,
                            foundInSnapcenterLogs: false
                        },
                        {
                            svmId: '6c800e9f-06f2-11f1-a170-7143fc0c8c33',
                            svmName: 'wlmdb_svm_demo',
                            volumeId: '40365dd0-06f2-11f1-a170-7143fc0c8c33',
                            volumeName: 'wlmdb_oracle_redo_demo',
                            hasSnapcenterSnapshot: false,
                            foundInSnapcenterLogs: false
                        },
                        {
                            svmId: '6c800e9f-06f2-11f1-a170-7143fc0c8c33',
                            svmName: 'wlmdb_svm_demo',
                            volumeId: '162f3991-06f2-11f1-a170-7143fc0c8c33',
                            volumeName: 'wlmdb_oracle_archive_demo',
                            hasSnapcenterSnapshot: false,
                            foundInSnapcenterLogs: false
                        }
                    ],
                    standaloneCheck: {
                        pluginServiceRunning: false,
                        sidFoundInLogs: false
                    },
                    errorMessage: ''
                },
                adrInfo: {
                    'adr-home': '/u01/app/oracle/diag/rdbms/orcl/orcl',
                    'adr-home-mount': '/dev/nvme0n1p3',
                    'adr-home-mount-info': {
                        'mount-point': '/dev/nvme0n1p3',
                        'filesystem-type': 'xfs',
                        'mount-options': {
                            rw: true,
                            relatime: true,
                            seclabel: true,
                            attr2: true,
                            inode64: true,
                            logbufs: '8',
                            logbsize: '32k',
                            noquota: true,
                            bg: false
                        },
                        error: null
                    },
                    error: null
                }
            }
        },
        errors: []
    }
};
