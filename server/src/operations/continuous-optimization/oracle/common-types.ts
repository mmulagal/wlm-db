import { OracleMappedOntapVolumesResponse } from '../../workloads/oracle/common-types';

interface ISCIOSAssessment {
    'host-utilities'?: {
        error?: string | null;
        'sanlun-version'?: string | null;
        'sanlun-installed'?: boolean;
        'os-version': string;
    };
    selinux?: {
        error?: string | null;
        'selinux-value'?: string;
        'selinux-disabled'?: boolean;
    };
    'multipath-io'?: {
        error?: string | null;
        'multipath-io-is-active'?: boolean;
        'multipath-io-active-value'?: string;
        'multipath-io-is-enabled'?: boolean;
        'multipath-io-enabled-value'?: string;
    };
    'tcp-advanced-options'?: {
        error?: string | null;
        'tcp-features'?: {
            'tcp-sack-value'?: string;
            'tcp-sack-enabled'?: boolean;
            'tcp-timestamps-value'?: string;
            'tcp-timestamps-enabled'?: boolean;
            'tcp-window-scaling-value'?: string;
            'tcp-window-scaling-enabled'?: boolean;
        };
    };
    'transparent-hugepages'?: {
        error?: string | null;
        'thp-value'?: string;
        'thp-disabled'?: boolean;
    };
    'iscsi-targets-sessions'?: {
        error?: string | null;
        'iscsi-targets-found'?: number;
        'total-active-sessions'?: number;
        'iscsi-sessions-per-target'?: Record<string, any>;
    };

    'iscsi-replacement-timeout'?: {
        error?: string | null;
        'replacement-timeout'?: number;
    };
    'oracle-parameters'?: {
        error?: string | null;
        'filesystemio-options'?: {
            value?: string;
            found?: boolean;
        };
        'db-file-multiblock-read-count'?: {
            value?: string;
            found?: boolean;
        };
    };
    'multipath-configuration'?: {
        error?: string | null;
        defaults?: Record<string, string | number | boolean>;
        'netapp-device'?: Record<string, string | number | boolean>;
    };
    'oracle-parameters-from-init'?: {
        error?: string | null;
        'db-file-multiblock-read-count-in-init'?: [
            {
                path?: string;
                error?: string | null;
                'parameter-found'?: boolean;
                'parameter-value'?: string;
            }
        ];
    };
    'asm-os-config'?: {
        isIscsi?: string;
        'asm-setup'?: string;
        'asm-external-redundancy'?: {
            error?: string;
            assessment?: {
                violations?: string[];
                result?: string;
                totalObjects?: number;
            };
        };
        'afd-logical-block-size'?: {
            error?: string;
            assessment?: {
                result?: string;
            };
        };
        'asmlib-logical-block-size'?: {
            error?: string;
            assessment?: {
                result?: string;
            };
        };
    };
}

interface NFSOSAssessment {
    'kernel-parameters'?: {
        error?: string | null;
        'sunrpc-tcp-slot-entries'?: {
            error?: string | null;
            'tcp-max-slot-table'?: string;
            'tcp-slot-table'?: string;
        };
    };
    'nfs-mount-options'?: {
        error?: string | null;
        'nfs-mount-options'?: Array<{
            error?: string | null;
            options?: Record<string, string | boolean>;
            server?: string;
            'mount-point'?: string;
            'remote-path'?: string;
            'filesystem-type'?: string;
        }>;
    };
    'adr-info'?: {
        error?: string | null;
        'adr-home'?: string;
        'adr-home-mount'?: string;
        'adr-home-mount-info'?: {
            error?: string | null;
            'mount-point'?: string;
            'filesystem-type'?: string;
            'mount-options'?: Record<string, string>;
        };
    };
    'idmapd-domain-config'?: {
        error?: string | null;
        domain?: string | null;
        'config-exists'?: boolean;
    };
    'hostname-domain'?: {
        error?: string | null;
        domain?: string | null;
    };
    'dnfs-oranfstab'?: {
        oranfstab_servers?: Array<{
            server: string;
            paths: string[];
            exports: Array<{
                export: string;
                mount: string;
            }>;
            nfs_version: string | null;
            options: Record<string, string | boolean>;
        }>;
        error?: string | null;
    };
    'dnfs-ip-resolution'?: {
        dns_resolution?: Record<string, string[]>;
        error?: string | null;
    };
    'nfs-exports'?: {
        'nfs-exports'?: Record<string, string[]>;
        error?: string | null;
    };
}

interface StorageAssessment {
    fraEnabled?: string;
    rmanCompressionEnabled?: string;
    volumes: {
        error: string;
        data: Record<string, any>[];
        filesystemId: string;
    };
    luns?: {
        error: string;
        data: Record<string, any>[];
    };
    binaryVolumes?: {
        error?: string;
        data?: {
            volumeId: string;
            volumeName: string;
            isNfsMount?: boolean;
            nfsInfo?: {
                exportPolicyName?: string;
                svmName?: string;
                rules: { clients?: string[]; superuser?: string[]; allow_suid?: boolean }[];
            };
        }[];
    };
    sizing?: {
        swapSpace: {
            error?: string | null;
            ramSizeInKb: number;
            swapSizeInKb: number;
            hugepagesSizeInKb: number;
        };
    };
    mappedOntapVolumes?: Record<string, OracleMappedOntapVolumesResponse>;
}

interface StorageIscsiAssessment extends StorageAssessment {
    os?: ISCIOSAssessment;
}

interface StorageNfsAssessment extends StorageAssessment {
    dnfsServers?: {
        error?: string | null;
        data?: Array<{
            dirname?: string;
            svrname?: string;
            nfsversion?: string;
        }>;
    };
    nfsRootonly?: Array<{
        svmName?: string;
        nfsRootonly?: string;
    }>;
    nfsv4DomainData?: {
        error?: string | null;
        data?: {
            v40Enabled?: boolean;
            v41Enabled?: boolean;
            v4IdDomain?: string | null;
        };
    };
    os?: NFSOSAssessment;
}

const defaultMultipathExpected = { find_multipaths: ['yes', 'on'], polling_interval: 5 };

const netappMultipathExpected = {
    path_grouping_policy: 'group_by_prio',
    path_selector: 'service-time 0',
    prio: 'ontap',
    hardware_handler: 0,
    failback: 'immediate',
    rr_weight: 'uniform',
    no_path_retry: 'queue',
    fast_io_fail_tmo: 5,
    dev_loss_tmo: 'infinity',
    detect_prio: 'yes',
    flush_on_last_del: ['yes', 'always'],
    retain_attached_hw_handler: 'yes',
    path_checker: 'tur',
    max_sectors_kb: 4096
};

const nfsMountOptionExpected = {
    rw: true,
    bg: true,
    hard: true,
    proto: 'tcp',
    rsize: '262144',
    wsize: '262144',
    nointr: true,
    timeo: '600'
};

interface OptimizeOSParams {
    accountId: string;
    credentialsId: string;
    region: string;
    databaseHostId: string;
    serverNameWithHostName: string;
    parentJobId: string;
    databaseInstanceId: string;
    databaseInstanceName?: string;
    fsxId?: string;
    activeNodeInstanceId: string;
    instanceMetadata: unknown;
}

interface OracleSecurityPatchSsmResponse {
    version: string;
    appliedPatches: Record<string, string>;
    error?: string;
}

export {
    ISCIOSAssessment,
    NFSOSAssessment,
    StorageAssessment,
    StorageIscsiAssessment,
    StorageNfsAssessment,
    defaultMultipathExpected,
    netappMultipathExpected,
    nfsMountOptionExpected,
    OptimizeOSParams,
    OracleSecurityPatchSsmResponse
};
