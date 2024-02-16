import { GENERAL, SELECT_CONFIG } from './appConstants';
import { CREATE_DATABASE_YAML, SQL_DEPLOYMENT_MODE } from './consts';
import {
    getSelectedFromSelectionState,
    formatSize,
    formatKmsData,
    formatVpcSubnetsData,
    dbPassVal,
    adPassVal,
    fsxPassVal,
    encodeAll,
    requiredFieldError,
    customErrorMessages,
    getCssVariableValue,
    formatDate,
    formatDateWithTime,
    isNotNumberOrNA,
    formatSizeOrString,
    regionsSort,
    isValidUserName,
    sortListOfDict,
    formatSizeOnePrecision,
    formatSizeSplit,
    displayFormattedValue,
    generateRandomDBName,
    formatFractionalNumber,
    mergeDatabaseHostsData,
    jobStatusPercent,
    getHostStatusCount,
    getAggrProtection,
    getAggrStorageSavings,
    getAggrCost,
    wrapContext,
    getWlmdbPayload,
    setRecommendedValues,
    getCredDetails,
    validateChatbotField,
    databaseTableSort,
    delay,
    getChatbotParamsFromPayload,
    jobMonitoringStatusMapping,
    addBlankCell,
    createJobMonitorCSV,
    cfDownloadName,
    getShiftedHoursList,
    groupByTime,
    groupByJobSummaryTimeline
} from './utilityFunctions';
import numeral from 'numeral';

const databaseHostItem: any = [
    {
        id: 'resource-id-1',
        name: 'Database hostname 1',
        status: 'Up',
        databaseCount: 10,
        databaseServer: {
            operatingSystem: 'Windows Server 2019',
            serverEdition: 'Microsoft SQL Server 2022 (RTM-CU6) (KB5027505)',
            serverVersion: '16.0.4055.4',
            nodeNames: ['SQLDBAPQHU'],
            activeConnections: 6,
            creationDate: '2022-11-21T02:47:42'
        },
        topology: {
            region: 'US East (N.Virginia)',
            serverType: 'Microsoft SQL Server',
            serverInstallationMode: 'Standalone',
            fileSystemType: 'FSx for Windows',
            fileSystemId: 'fsx-id-1',
            vpcId: 'vpc1',
            ec2Details: [
                {
                    id: 'id1',
                    name: 'ec2-name1',
                    ebsVolumeId: 'ebs-volume1'
                }
            ]
        },
        protection: {
            isAwsBackUpEnabled: true,
            isFsxOntapSnapshotsEnabled: true,
            isSqlNativeEnabled: true,
            protectedDatabases: 8
        },
        performance: {
            latency: 10,
            assessment: 'High'
        },
        storage: {
            size: 0,
            used: 0,
            spaceSavings: 0
        },
        estimatedUsageCost: {
            compute: 700,
            storage: 200,
            connectivity: 100,
            others: 24,
            estimationType: 'pricing'
        }
    },
    {
        id: 'resource-id-2',
        name: 'Database hostname 2',
        status: 'Down',
        databaseCount: 10,
        topology: {
            region: 'US East (N.Virginia)',
            serverType: 'Microsoft SQL Server',
            serverInstallationMode: 'FCI',
            fileSystemType: 'FSx for ONTAP',
            fileSystemId: 'fsx-id-1',
            vpcId: 'vpc1',
            ec2Details: [
                {
                    id: 'id2',
                    name: 'ec2-name2',
                    ebsVolumeId: 'ebs-volume2'
                }
            ]
        },
        protection: {
            isAwsBackUpEnabled: false,
            isFsxOntapSnapshotsEnabled: false,
            isSqlNativeEnabled: false,
            protectedDatabases: 8
        },
        performance: {
            latency: 10,
            assessment: 'High'
        },
        storage: {
            size: 3932364972032,
            used: 181537648640,
            spaceSavings: 10737418240
        },
        estimatedUsageCost: {
            compute: 700,
            storage: 200,
            connectivity: 100,
            others: 24,
            estimationType: 'pricing'
        }
    }
];
const databaseJobsItem: any = [
    {
        id: 'resource-id-ini1',
        name: 'Database hostname Ini1',
        status: 'CREATE_IN_PROGRESS',
        metadata: {
            region: 'US East (N.Virginia)',
            serverType: 'Microsoft SQL Server',
            serverInstallationMode: 'Standalone',
            fileSystemType: 'FSx for Windows'
        }
    },
    {
        id: 'resource-id-ini2',
        name: 'Database hostname Ini2',
        status: 'CREATE_FAILED',
        metadata: {
            region: 'US East (N.Virginia)',
            serverType: 'Microsoft SQL Server',
            serverInstallationMode: 'FCI',
            fileSystemType: 'FSx for ONTAP'
        }
    }
];

describe('formatVpcSubnetsData', () => {
    it('should format bytes with default format', () => {
        const data = {
            id: 'vpc-7d4a2818',
            state: 'available',
            cidrBlock: [
                {
                    AssociationId: 'vpc-cidr-assoc-c08773a9',
                    CidrBlock: '172.30.0.0/20',
                    CidrBlockState: {
                        State: 'associated'
                    }
                }
            ],
            tags: [
                {
                    Key: 'Name',
                    Value: 'sathish'
                }
            ],
            isDefault: false,
            name: 'sathish',
            subnets: [
                {
                    id: 'subnet-5a37222d',
                    state: 'available',
                    vpcId: 'vpc-ba1ed1de',
                    cidrBlock: '192.168.16.0/24',
                    availabilityZone: 'us-east-1a',
                    availableIps: 251,
                    tags: [
                        {
                            Key: 'KubernetesCluster',
                            Value: 'netehenfhk'
                        },
                        {
                            Key: 'eco-groupname',
                            Value: 'HCL'
                        },
                        {
                            Key: 'Name',
                            Value: 'HCL-CC-1'
                        },
                        {
                            Key: 'eco-shared-resource',
                            Value: 'Y'
                        }
                    ],
                    name: 'HCL-CC-1',
                    routeTableId: 'rtb-0252de162c006de11'
                },
                {
                    id: 'subnet-74a1b303',
                    state: 'available',
                    vpcId: 'vpc-ba1ed1de',
                    cidrBlock: '192.168.17.0/24',
                    availabilityZone: 'us-east-1b',
                    availableIps: 251,
                    tags: [
                        {
                            Key: 'Name',
                            Value: 'HCL-CC-2'
                        },
                        {
                            Key: 'eco-shared-resource',
                            Value: 'Y'
                        },
                        {
                            Key: 'eco-groupname',
                            Value: 'HCL'
                        }
                    ],
                    name: 'HCL-CC-2',
                    routeTableId: 'rtb-0252de162c006de11'
                }
            ],
            securityGroups: [
                {
                    id: 'sg-ad2b38d1',
                    description: 'default VPC security group',
                    vpcId: 'vpc-62720a04',
                    ipPermissions: [
                        {
                            FromPort: 22,
                            IpProtocol: 'tcp',
                            IpRanges: [
                                {
                                    CidrIp: '0.0.0.0/0'
                                }
                            ],
                            Ipv6Ranges: [],
                            PrefixListIds: [],
                            ToPort: 22,
                            UserIdGroupPairs: []
                        }
                    ],
                    name: '-'
                }
            ]
        };

        const expectedResult = {
            'us-east-1a': [
                {
                    id: 'subnet-5a37222d',
                    state: 'available',
                    vpcId: 'vpc-ba1ed1de',
                    cidrBlock: '192.168.16.0/24',
                    availabilityZone: 'us-east-1a',
                    availableIps: 251,
                    tags: [
                        {
                            Key: 'KubernetesCluster',
                            Value: 'netehenfhk'
                        },
                        {
                            Key: 'eco-groupname',
                            Value: 'HCL'
                        },
                        {
                            Key: 'Name',
                            Value: 'HCL-CC-1'
                        },
                        {
                            Key: 'eco-shared-resource',
                            Value: 'Y'
                        }
                    ],
                    name: 'HCL-CC-1',
                    routeTableId: 'rtb-0252de162c006de11'
                }
            ],
            'us-east-1b': [
                {
                    id: 'subnet-74a1b303',
                    state: 'available',
                    vpcId: 'vpc-ba1ed1de',
                    cidrBlock: '192.168.17.0/24',
                    availabilityZone: 'us-east-1b',
                    availableIps: 251,
                    tags: [
                        {
                            Key: 'Name',
                            Value: 'HCL-CC-2'
                        },
                        {
                            Key: 'eco-shared-resource',
                            Value: 'Y'
                        },
                        {
                            Key: 'eco-groupname',
                            Value: 'HCL'
                        }
                    ],
                    name: 'HCL-CC-2',
                    routeTableId: 'rtb-0252de162c006de11'
                }
            ]
        };

        const formattedData = formatVpcSubnetsData(data);

        expect(formattedData).toEqual(expectedResult);
    });
});

describe('formatKmsData', () => {
    it('should filter and map keys correctly', () => {
        const data = {
            keys: [
                {
                    id: '0022459d-e581-45e3-acc5-4fa298d413d2',
                    name: 'aws/fsx',
                    origin: 'AWS_KMS',
                    state: 'Enabled'
                },
                {
                    id: '038e4010-d061-4375-b002-e3bfb5ec194e',
                    name: 'alias/nviet-openlab-key6',
                    origin: 'AWS_KMS',
                    state: 'PendingDeletion',
                    expirationDate: 'Aug 23, 2023'
                },
                {
                    id: '0a93acf4-ca6e-4847-8baa-9b0f561567b1',
                    name: 'alias/nviet-openlab-key6',
                    origin: 'AWS_KMS',
                    state: 'Disabled',
                    expirationDate: 'June 23, 2023'
                },
                {
                    id: '1149596e-3d5c-4207-a2cc-2c0443c07aa4',
                    name: 'alias/nviet-openlab-key6',
                    origin: 'AWS_KMS',
                    state: 'Disabled',
                    expirationDate: 'June 23, 2023'
                },
                {
                    id: '11b78ef1-7b45-4b2a-ae0e-2c8811094833',
                    name: 'alias/nviet-openlab-key6',
                    origin: 'AWS_KMS',
                    state: 'Enabled',
                    expirationDate: 'Dec 23, 2023'
                }
            ]
        };

        const expectedResult = [
            {
                id: '0022459d-e581-45e3-acc5-4fa298d413d2',
                name: 'aws/fsx',
                origin: 'AWS_KMS',
                state: 'Enabled',
                default: true
            },
            {
                id: '038e4010-d061-4375-b002-e3bfb5ec194e',
                name: 'alias/nviet-openlab-key6',
                origin: 'AWS_KMS',
                state: 'PendingDeletion',
                expirationDate: 'Aug 23, 2023'
            },
            {
                id: '11b78ef1-7b45-4b2a-ae0e-2c8811094833',
                name: 'alias/nviet-openlab-key6',
                origin: 'AWS_KMS',
                state: 'Enabled',
                expirationDate: 'Dec 23, 2023'
            }
        ];

        const formattedData = formatKmsData(data);

        expect(formattedData).toEqual(expectedResult);
    });

    it('should handle empty data', () => {
        const formattedData = formatKmsData({});

        expect(formattedData).toEqual([]);
    });

    it('should handle missing keys', () => {
        const formattedData = formatKmsData({});

        expect(formattedData).toEqual([]);
    });
});

describe('formatSize', () => {
    it('should format bytes to KiB', () => {
        const value = 2;
        const format = 'kib';
        const expectedResult = numeral(value * 1024).format('0.[00] ib');

        const result = formatSize(value, format);

        expect(result).toEqual(expectedResult);
    });

    it('should format bytes to MiB', () => {
        const value = 2;
        const format = 'mib';
        const expectedResult = numeral(value * 1024 * 1024).format('0.[00] ib');

        const result = formatSize(value, format);

        expect(result).toEqual(expectedResult);
    });

    it('should format bytes to GiB', () => {
        const value = 2;
        const format = 'gib';
        const expectedResult = numeral(value * 1024 * 1024 * 1024).format('0.[00] ib');

        const result = formatSize(value, format);

        expect(result).toEqual(expectedResult);
    });

    it('should format bytes to TiB', () => {
        const value = 2;
        const format = 'tib';
        const expectedResult = numeral(value * 1024 * 1024 * 1024 * 1024).format('0.[00] ib');

        const result = formatSize(value, format);

        expect(result).toEqual(expectedResult);
    });

    it('should format bytes with default format', () => {
        const value = 12345;
        const expectedResult = numeral(value).format('0.[00] ib');

        const result = formatSize(value);

        expect(result).toEqual(expectedResult);
    });
});

describe('getSelectedFromSelectionState', () => {
    it('should return selected rows from data based on selection state', () => {
        const selectionState = {
            rows: {
                '1': true,
                '2': false,
                '3': true
            }
        };

        const data = [
            { id: '1', name: 'Row 1' },
            { id: '2', name: 'Row 2' },
            { id: '3', name: 'Row 3' }
        ];

        //@ts-ignore
        const selectedRows = getSelectedFromSelectionState(selectionState, data);

        expect(selectedRows).toEqual([
            { id: '1', name: 'Row 1' },
            { id: '3', name: 'Row 3' }
        ]);
    });

    it('should handle empty selection state', () => {
        const selectionState = null;
        const data = [
            { id: '1', name: 'Row 1' },
            { id: '2', name: 'Row 2' }
        ];
        //@ts-ignore
        const selectedRows = getSelectedFromSelectionState(selectionState, data);

        expect(selectedRows).toEqual([]);
    });

    it('should handle no selected rows', () => {
        const selectionState = {
            rows: {
                '1': false,
                '2': false
            }
        };

        const data = [
            { id: '1', name: 'Row 1' },
            { id: '2', name: 'Row 2' }
        ];
        //@ts-ignore
        const selectedRows = getSelectedFromSelectionState(selectionState, data);

        expect(selectedRows).toEqual([]);
    });

    it('should handle data without matching entries in selection state', () => {
        const selectionState = {
            rows: {
                '1': true,
                '4': true
            }
        };

        const data = [
            { id: '2', name: 'Row 2' },
            { id: '3', name: 'Row 3' }
        ];
        //@ts-ignore
        const selectedRows = getSelectedFromSelectionState(selectionState, data);

        expect(selectedRows).toEqual([]);
    });
});

describe('dbPassVal', () => {
    it('Valid password', () => {
        const result = dbPassVal('Testing@123');
        expect(result).toEqual('');
    });
    it('Invalid password', () => {
        const result = dbPassVal('test');
        expect(result).toEqual(GENERAL.PASSWORD_ERROR_CHECK);
    });
});

describe('adPassVal', () => {
    it('Valid password', () => {
        const result = adPassVal('Testing@123');
        expect(result).toEqual(undefined);
    });
    it('Invalid password', () => {
        const result = adPassVal('test');
        expect(result).toEqual(GENERAL.PASSWORD_MIN_LENGTH_8);
    });
});

describe('fsxPassVal', () => {
    it('Valid password', () => {
        const result = fsxPassVal('Testing@123');
        expect(result).toEqual('');
    });
    it('Invalid password', () => {
        const result = fsxPassVal('test');
        expect(result).toEqual(GENERAL.PASSWORD_ERROR_CHECK);
    });
});

describe('encodeAll', () => {
    it('should encode text value', () => {
        const value = 'SpecialChar%__._-_/_(';
        expect(encodeAll(value)).toEqual('SpecialChar---2525__---252E_---252D_---252F_---252C');
    });
    it('should return same text', () => {
        const value = '';
        expect(encodeAll(value)).toEqual('');
    });
});

describe('requiredFieldError', () => {
    it('Valid field error', () => {
        const result = requiredFieldError("body/adConfiguration must have required property 'domainDnsName'");
        expect(result).toEqual('domainDnsName');
    });
    it('Invalid field error', () => {
        const result = requiredFieldError('random text');
        expect(result).toBeNull();
    });
    it('Return null for null input', () => {
        const result = requiredFieldError('');
        expect(result).toBeNull();
    });
});

describe('customErrorMessages', () => {
    it('Duplicate config case', () => {
        const result = customErrorMessages('An unique key constraint violated uk_wlmdb_config_account_id_name_user');
        expect(result).toEqual(SELECT_CONFIG.DUPLICATE_CONFIG_NAME);
    });
    it('Non duplicate config case', () => {
        const result = customErrorMessages('test');
        expect(result).toEqual('test');
    });
    it('Null case', () => {
        const result = customErrorMessages('');
        expect(result).toBeNull();
    });
});

describe('getCssVariableValue', () => {
    it('Get css variable name', () => {
        const result = getCssVariableValue('--scroller');
        expect(result).toEqual('');
    });
});

describe('formatDate', () => {
    it('Return formatted date', () => {
        const result = formatDate(1705602600000);
        expect(result).toEqual('January 1, 1970');
    });
});

describe('formatDateWithTime', () => {
    it('Return formatted date', () => {
        const result = formatDateWithTime(1705602600000);
        expect(result).toEqual('January 19, 2024 00:00');
    });
});

describe('isNotNumberOrNA', () => {
    it('Return false if number', () => {
        const result = isNotNumberOrNA('12345');
        expect(result).toEqual(false);
    });
    it('Return true if text', () => {
        const result = isNotNumberOrNA('abc');
        expect(result).toEqual(true);
    });
    it('Return false if empty', () => {
        const result = isNotNumberOrNA('');
        expect(result).toEqual(false);
    });
});

describe('formatSizeOrString', () => {
    it('Return size in KiB', () => {
        const result = formatSizeOrString(123456);
        expect(result).toEqual('120.56 KiB');
    });
});

describe('regionsSort', () => {
    it('Should return sorted region', () => {
        const regionsList = [
            {
                regionCode: 'ap-southeast-1',
                regionName: 'Asia Pacific (Singapore)'
            },
            {
                regionCode: 'us-east-1',
                regionName: 'US East (N. Virginia)'
            },
            {
                regionCode: 'us-east-2',
                regionName: 'US East (Ohio)'
            }
        ];
        const result = regionsSort(regionsList);
        expect(result[0].regionName).toEqual('US East (N. Virginia)');
    });
    it('Should return same list if less than 2', () => {
        const regionsList = [
            {
                regionCode: 'ap-southeast-1',
                regionName: 'Asia Pacific (Singapore)'
            }
        ];
        const result = regionsSort(regionsList);
        expect(result[0].regionName).toEqual('Asia Pacific (Singapore)');
    });
});

describe('isValidUserName', () => {
    it('Return invalid username', () => {
        const result = isValidUserName('admin');
        expect(result).toEqual(GENERAL.USERNAME_TOOLTIP);
    });
    it('Return valid username', () => {
        const result = isValidUserName('Collector123');
        expect(result).toBeUndefined();
    });
});

describe('sortListOfDict', () => {
    it('Return asc sorted list', () => {
        const input = [
            {
                id: 'id2',
                name: 'name2'
            },
            {
                id: 'id1',
                name: 'name1'
            }
        ];
        const result = sortListOfDict(input, 'id');
        expect(result[0].name).toEqual('name1');
    });
    it('Return dsc sorted list', () => {
        const input = [
            {
                id: 'id2',
                name: 'name2'
            },
            {
                id: 'id3',
                name: 'name3'
            }
        ];
        const result = sortListOfDict(input, 'id', false);
        expect(result[0].name).toEqual('name3');
    });
    it('Return list if only 1 row', () => {
        const input = [
            {
                id: 'id2',
                name: 'name2'
            }
        ];
        const result = sortListOfDict(input, 'id');
        expect(result[0].name).toEqual('name2');
    });
    it('Return same list if any error', () => {
        const input = [
            {
                id: 'id2',
                name: 'name2'
            },
            {
                ids: 'id2',
                name: 'name2'
            }
        ];
        const result = sortListOfDict(input, 'ids');
        expect(result[0].name).toEqual('name2');
    });
});

describe('formatSizeOnePrecision', () => {
    it('Return formatSizeOnePrecision', () => {
        const result = formatSizeOnePrecision('12345');
        expect(result).toEqual('12.1 KiB');
    });
});

describe('formatSizeSplit', () => {
    it('Return formatSizeSplit', () => {
        const result = formatSizeSplit('12345');
        expect(result.value).toEqual('12.1');
        expect(result.format).toEqual('KiB');
    });
});

describe('displayFormattedValue', () => {
    it('Return displayFormattedValue', () => {
        const result = displayFormattedValue(12345, 'storage used');
        expect(result).toEqual('12.06 KiB storage used');
    });
});

describe('generateRandomDBName', () => {
    it('Generate random number', () => {
        const result = generateRandomDBName();
        expect(result).toBeDefined();
    });
});

describe('formatFractionalNumber', () => {
    it('Return fractional number', () => {
        const result = formatFractionalNumber(12.345, 2);
        expect(result).toEqual('12.35');
    });
    it('Return undefined', () => {
        const result = formatFractionalNumber(undefined, 2);
        expect(result).toBeUndefined();
    });
});

describe('mergeDatabaseHostsData', () => {
    it('Return merged list', () => {
        const result = mergeDatabaseHostsData(databaseHostItem);
        expect(result.length).toEqual(4);
    });
    it('Should return null is empty list', () => {
        const result = mergeDatabaseHostsData(null);
        expect(result.length).toEqual(0);
    });
});

describe('jobStatusPercent', () => {
    it('Return job status percent', () => {
        const jobSummaryResponse = {
            completed: 180,
            failed: 48,
            inProgress: 2
        };
        const result = jobStatusPercent(jobSummaryResponse);
        expect(result?.totalJobs).toEqual(230);
        expect(result?.completedPercent).toEqual(78.26086956521739);
        expect(result?.failedPercent).toEqual(20.869565217391305);
        expect(result?.inProgressPercent).toEqual(0.8695652173913043);
    });
    it('Return null if input is empty', () => {
        let jobSummaryResponse: any;
        const result = jobStatusPercent(jobSummaryResponse);
        expect(result).toBeNull();
    });
});

describe('getHostStatusCount', () => {
    it('Return host status data', () => {
        const result = getHostStatusCount(mergeDatabaseHostsData(databaseHostItem));
        expect(result?.totalDatabases).toEqual(20);
        expect(result?.totalHosts).toEqual(4);
        expect(result?.totalUpHosts).toEqual(1);
        expect(result?.totalDownHosts).toEqual(1);
        expect(result?.totalInitializingHosts).toEqual(1);
        expect(result?.totalFailedHosts).toEqual(1);
    });
});

describe('getAggrProtection', () => {
    it('Return protection data', () => {
        const result = getAggrProtection(databaseHostItem);
        expect(result?.protectedDb).toEqual(1);
        expect(result?.unprotectedDb).toEqual(1);
        expect(result?.protectedPercent).toEqual(50);
        expect(result?.unprotectedPercent).toEqual(50);
        expect(result?.awsBackupDb).toEqual(1);
        expect(result?.fsxOntapSnapshotsDb).toEqual(1);
        expect(result?.sqlServerBackupDb).toEqual(1);
    });
});

describe('getAggrStorageSavings', () => {
    it('Return storage savings data', () => {
        const result = getAggrStorageSavings(databaseHostItem);
        expect(result?.storageConsumes).toEqual('159.1 GiB');
        expect(result?.storageSavings).toEqual('10 GiB');
        expect(result?.storageSavingsPercent).toEqual(5.914706024034134);
    });
});

describe('getAggrCost', () => {
    it('Return aggr cost data with same fsx id and diff ec2 details', () => {
        const result = getAggrCost(databaseHostItem);
        expect(result?.storageCost).toEqual(200);
        expect(result?.computeCost).toEqual(1400);
        expect(result?.connectivityCost).toEqual(100);
        expect(result?.otherCost).toEqual(48);
        expect(result?.totalCost).toEqual(1748);
        expect(result?.storageCostPercent).toEqual('11.4');
        expect(result?.computeCostPercent).toEqual('80.1');
        expect(result?.connectivityCostPercent).toEqual('5.7');
        expect(result?.otherCostPercent).toEqual('2.7');
        expect(result?.requireBillingPerm).toEqual(true);
    });
});

describe('wrapContext', () => {
    it('Return wrap context string', () => {
        const result = wrapContext('Deploy SQL');
        expect(result).toEqual(`\n\nHuman: Deploy SQL \n\nAssistant:`);
    });
});

describe('getWlmdbPayload', () => {
    it('Return wlmdb payload', () => {
        const result = getWlmdbPayload({ domainPassword: 'netapp1!' });
        expect(result?.adConfiguration?.domainPassword).toEqual('********');
    });
});

describe('setRecommendedValues', () => {
    it('Return recommended values for dev', () => {
        const result = setRecommendedValues({}, '0');
        expect(result?.selectConfig).toEqual(SELECT_CONFIG.STANDARD_CREATE);
        expect(result?.instanceType?.value).toEqual('m5.xlarge');
        expect(result?.dbEdition?.value).toEqual(GENERAL.SQL_SERVER_STANDARD);
        expect(result?.dbDeploymentModel?.value).toEqual(SQL_DEPLOYMENT_MODE.SINGLE_INSTANCE_VALUE);
        expect(result?.storageCapacity?.capacity).toEqual('100');
        expect(result?.throughput).toEqual('128');
    });
    it('Return recommended values for prod', () => {
        const result = setRecommendedValues({}, '1');
        expect(result?.selectConfig).toEqual(SELECT_CONFIG.STANDARD_CREATE);
        expect(result?.instanceType?.value).toEqual('m5.2xlarge');
        expect(result?.dbEdition?.value).toEqual(GENERAL.SQL_SERVER_STANDARD);
        expect(result?.dbDeploymentModel?.value).toEqual(SQL_DEPLOYMENT_MODE.FAILOVER_CLUSTER_VALUE);
        expect(result?.storageCapacity?.capacity).toEqual('500');
        expect(result?.throughput).toEqual('128');
    });
});

describe('getCredDetails', () => {
    it('Return cred details', () => {
        const input = {
            awsAccount: {
                selectedCredential: {
                    data: {
                        credentialsId: 'cred123'
                    }
                }
            },
            regionAndVpc: {
                selectedRegion: {
                    data: {
                        regionCode: 'region123'
                    }
                }
            }
        };
        const result = getCredDetails(input);
        expect(result?.credId).toEqual('cred123');
        expect(result?.region).toEqual('region123');
    });
});

describe('validateChatbotField', () => {
    it('Return empty if valid fsxPassword', () => {
        const result = validateChatbotField('fsxPassword', 'netapp1!');
        expect(result).toEqual('');
    });
    it('Return error if invalid fsxPassword', () => {
        const result = validateChatbotField('fsxPassword', 'netapp');
        expect(result).toEqual(GENERAL.PASSWORD_ERROR_CHECK);
    });
    it('Return empty if valid serviceAccountName', () => {
        const result = validateChatbotField('serviceAccountName', 'sqladmin');
        expect(result).toEqual('');
    });
    it('Return error if invalid serviceAccountName', () => {
        const result = validateChatbotField('serviceAccountName', 'admin');
        expect(result).toEqual(GENERAL.USERNAME_TOOLTIP);
    });
    it('Return empty if valid serviceAccountPassword', () => {
        const result = validateChatbotField('serviceAccountPassword', 'netapp1!');
        expect(result).toEqual('');
    });
    it('Return error if invalid serviceAccountPassword', () => {
        const result = validateChatbotField('serviceAccountPassword', 'netapp');
        expect(result).toEqual(GENERAL.PASSWORD_ERROR_CHECK);
    });
    it('Return empty if valid databaseSize', () => {
        const result = validateChatbotField('databaseSize', '13319');
        expect(result).toEqual('');
    });
    it('Return error if invalid databaseSize', () => {
        const result = validateChatbotField('databaseSize', '13321');
        expect(result).toContain('Supported capacity should be between 120 GiB to 13320 GiB');
    });
    it('Return empty if valid sqlServerName', () => {
        const result = validateChatbotField('sqlServerName', 'sqldatabase');
        expect(result).toEqual('');
    });
    it('Return error if invalid sqlServerName', () => {
        const result = validateChatbotField('sqlServerName', 'sqldatabase_testing');
        expect(result).toContain(GENERAL.DB_NAME_TOOLTIP);
    });
    it('Return empty if valid domainPassword', () => {
        const result = validateChatbotField('domainPassword', 'collector@123');
        expect(result).toEqual('');
    });
    it('Return error if invalid domainPassword', () => {
        const result = validateChatbotField('domainPassword', 'test');
        expect(result).toContain(GENERAL.PASSWORD_MIN_LENGTH_8);
    });
});

describe('databaseTableSort', () => {
    it('Return sorted table rows', () => {
        const result = databaseTableSort(databaseHostItem);
        expect(result?.[1]?.id).toEqual('resource-id-2');
    });
    it('Return same list if input size is less than 1', () => {
        const result = databaseTableSort([databaseHostItem[0]]);
        expect(result?.[0]?.id).toEqual('resource-id-1');
    });
});

describe('delay', () => {
    it('Return delay response', () => {
        const result = delay(100);
        expect(result).toBeDefined();
    });
});

describe('getChatbotParamsFromPayload', () => {
    it('Return chatbot response from payload', () => {
        const payload = {
            awsAccount: {
                selectedCredential: {
                    data: {
                        credentialsId: 'cred123'
                    }
                }
            },
            dbDeploymentModel: {
                value: 'fci'
            },
            regionAndVpc: {
                selectedRegion: {
                    data: {
                        regionCode: 'region123'
                    }
                },
                selectedVPC: {
                    data: {
                        id: 'vpc123'
                    }
                }
            },
            availabilityZones: {
                selectedAzNode1: {
                    data: {
                        availabilityZone: 'AZ_1'
                    }
                },
                selectedSubnetNode1: {
                    data: {
                        id: 'subnet_1'
                    }
                },
                selectedAzNode2: {
                    data: {
                        availabilityZone: 'AZ_2'
                    }
                },
                selectedSubnetNode2: {
                    data: {
                        id: 'subnet_2'
                    }
                }
            },
            keyPair: {
                selectedKeyPair: {
                    data: {
                        name: 'keypair123'
                    }
                }
            },
            instanceType: {
                data: {
                    instanceType: 'm5.xlarge'
                }
            },
            activeDirectory: {
                userName: 'admin',
                password: 'collector@123',
                domainName: {
                    value: 'wlm.com'
                },
                domainAddress: '10.0.0.1',
                scenarioType: 'custom'
            },
            dbCredentials: {
                name: 'admin',
                password: 'netapp1!'
            },
            license: {
                selectedLicenseId: {
                    value: 'license123'
                }
            },
            fsxN: {
                fsxNExistingName: {
                    data: {
                        fileSystemId: 'fsx123'
                    }
                },
                fsxNNewUserName: 'admin',
                fsxNPassword: 'netapp1!',
                fsxNType: 'EXISTING'
            },
            throughput: {
                value: '128'
            },
            securityGroup: {
                selectedExistingSecurityGroup: {
                    value: 'sg-123'
                }
            },
            dbName: 'sqldatabase',
            storageCapacity: {
                capacity: '120',
                unit: {
                    value: 'GiB'
                }
            },
            tags: [
                {
                    key: 'key1',
                    value: 'value1'
                },
                {
                    key: '',
                    value: 'value2'
                }
            ],
            cloudWatch: true
        };
        const result = getChatbotParamsFromPayload(payload);
        expect(result.credentialsId).toEqual('cred123');
        expect(result.fsxDeploymentMode).toEqual('MULTI_AZ_1');
        expect(result.region).toEqual('region123');
        expect(result.vpcId).toEqual('vpc123');
        expect(result.availabilityZone1).toEqual('AZ_1');
        expect(result.availabilityZone2).toEqual('AZ_2');
        expect(result.privateSubnet1Id).toEqual('subnet_1');
        expect(result.privateSubnet2Id).toEqual('subnet_2');
        expect(result.keyPairName).toEqual('keypair123');
        expect(result.workloadInstanceType).toEqual('m5.xlarge');
        expect(result.domainUsername).toEqual('admin');
        expect(result.domainPassword).toEqual('collector@123');
        expect(result.domainDnsname).toEqual('wlm.com');
        expect(result.dnsIpaddress).toEqual('10.0.0.1');
        expect(result.serviceAccountName).toEqual('admin');
        expect(result.serviceAccountPassword).toEqual('netapp1!');
        expect(result.sqlAmiId).toEqual('license123');
        expect(result.fsxFileSystemId).toEqual('fsx123');
        expect(result.fsxUsername).toEqual('admin');
        expect(result.fsxPassword).toEqual('netapp1!');
        expect(result.fsxVolThroughput).toEqual('128');
        expect(result.ontapSgGroupId).toEqual('sg-123');
        expect(result.sqlServerName).toEqual('sqldatabase');
        expect(result.fsxType).toEqual('EXISTING');
        expect(result.sqlDeploymentMode).toEqual('fci');
        expect(result.databaseSize).toEqual(120);
        expect(result.tags.length).toEqual(1);
        expect(result.adScenarioType).toEqual('custom');
        expect(result.enableCloudWatch).toEqual(true);
    });
});

describe('jobMonitoringStatusMapping', () => {
    it('Return completed', () => {
        const result = jobMonitoringStatusMapping('COMPLETED');
        expect(result).toEqual('Completed');
    });
    it('Return running', () => {
        const result = jobMonitoringStatusMapping('IN_PROGRESS');
        expect(result).toEqual('Running');
    });
    it('Return failed', () => {
        const result = jobMonitoringStatusMapping('FAILED');
        expect(result).toEqual('Failed');
    });
});

describe('addBlankCell', () => {
    it('Return comma to match blank cell in csv', () => {
        const result = addBlankCell(2, '');
        expect(result).toEqual(',,');
    });
});

describe('createJobMonitorCSV', () => {
    it('Return csv text', () => {
        const keys = ['name', 'status', 'type'];
        const headers = 'Job Id,Status,Type';
        let result = '';
        const dataList = [
            {
                name: 'stack1',
                status: 'COMPLETED'
            },
            {
                name: 'stack1;href:',
                status: 'FAILED',
                subJobs: [
                    {
                        id: '9876543219236789',
                        name: '9876543219236789',
                        description: 'Microsoft SQL server deployed with stack <stack-name>.',
                        status: 'COMPLETED',
                        startTime: 1704785588798,
                        endTime: 1704871988798
                    }
                ]
            },
            {
                name: 'stack1',
                status: 'IN_PROGRESS'
            }
        ];
        result = createJobMonitorCSV(dataList, keys, headers, result, 0);
        expect(result).toContain('January 9 2024 13:03,January 10 2024 13:03');
    });
});

describe('cfDownloadName', () => {
    it('Return CF download name', () => {
        const result = cfDownloadName('dev');
        expect(result).toContain(CREATE_DATABASE_YAML + '_dev');
    });
});

describe('getShiftedHoursList', () => {
    it('Return hours list in correct order', () => {
        const result = getShiftedHoursList(['00:00', '04:00', '08:00', '12:00', '16:00', '20:00']);
        expect(result.length).toEqual(6);
    });
});

describe('groupByJobSummaryTimeline', () => {
    const timelineData = [
        {
            endTime: 1705685400000,
            timeInterval: 19,
            completed: 1,
            failed: 0
        },
        {
            endTime: 1705599000000,
            timeInterval: 18,
            completed: 1,
            failed: 0
        },
        {
            endTime: 1705512600000,
            timeInterval: 17,
            completed: 1,
            failed: 1
        },
        {
            endTime: 1705426200000,
            timeInterval: 16,
            completed: 0,
            failed: 0
        },
        {
            endTime: 1705339800000,
            timeInterval: 15,
            completed: 2,
            failed: 1
        },
        {
            endTime: 1705253400000,
            timeInterval: 14,
            completed: 3,
            failed: 3
        },
        {
            endTime: 1705167000000,
            timeInterval: 13,
            completed: 1,
            failed: 0
        },
        {
            endTime: 1705080600000,
            timeInterval: 12,
            completed: 4,
            failed: 0
        },
        {
            endTime: 1704994200000,
            timeInterval: 11,
            completed: 0,
            failed: 4
        },
        {
            endTime: 1704907800000,
            timeInterval: 10,
            completed: 3,
            failed: 1
        },
        {
            endTime: 1704821400000,
            timeInterval: 9,
            completed: 0,
            failed: 1
        },
        {
            endTime: 1704735000000,
            timeInterval: 8,
            completed: 2,
            failed: 1
        },
        {
            endTime: 1704648600000,
            timeInterval: 7,
            completed: 2,
            failed: 1
        },
        {
            endTime: 1704562200000,
            timeInterval: 6,
            completed: 0,
            failed: 5
        },
        {
            endTime: 1704475800000,
            timeInterval: 5,
            completed: 6,
            failed: 1
        },
        {
            endTime: 1704389400000,
            timeInterval: 4,
            completed: 2,
            failed: 0
        },
        {
            endTime: 1704303000000,
            timeInterval: 3,
            completed: 2,
            failed: 0
        },
        {
            endTime: 1704216600000,
            timeInterval: 2,
            completed: 1,
            failed: 3
        },
        {
            endTime: 1704130200000,
            timeInterval: 1,
            completed: 1,
            failed: 0
        },
        {
            endTime: 1704043800000,
            timeInterval: 31,
            completed: 0,
            failed: 0
        },
        {
            endTime: 1703957400000,
            timeInterval: 30,
            completed: 3,
            failed: 1
        },
        {
            endTime: 1703871000000,
            timeInterval: 29,
            completed: 1,
            failed: 0
        },
        {
            endTime: 1703784600000,
            timeInterval: 28,
            completed: 0,
            failed: 0
        },
        {
            endTime: 1703698200000,
            timeInterval: 27,
            completed: 0,
            failed: 2
        },
        {
            endTime: 1703611800000,
            timeInterval: 26,
            completed: 0,
            failed: 2
        },
        {
            endTime: 1703525400000,
            timeInterval: 25,
            completed: 5,
            failed: 1
        },
        {
            endTime: 1703439000000,
            timeInterval: 24,
            completed: 3,
            failed: 1
        },
        {
            endTime: 1703352600000,
            timeInterval: 23,
            completed: 2,
            failed: 0
        },
        {
            endTime: 1703266200000,
            timeInterval: 22,
            completed: 7,
            failed: 0
        },
        {
            endTime: 1703179800000,
            timeInterval: 21,
            completed: 7,
            failed: 0
        }
    ];
    it('Return time grouped for 1 day', () => {
        const result = groupByJobSummaryTimeline(timelineData, 1);
        expect(result.time.length).toEqual(6);
        expect(result.completed.length).toEqual(6);
        expect(result.failed.length).toEqual(6);
    });
    it('Return time grouped for 7 days', () => {
        const result = groupByJobSummaryTimeline(timelineData, 7);
        expect(result.time.length).toEqual(7);
        expect(result.completed.length).toEqual(7);
        expect(result.failed.length).toEqual(7);
    });
    it('Return time grouped for 14 days', () => {
        const result = groupByJobSummaryTimeline(timelineData, 14);
        expect(result.time.length).toEqual(14);
        expect(result.completed.length).toEqual(14);
        expect(result.failed.length).toEqual(14);
    });
    it('Return time grouped for 30 days', () => {
        const result = groupByJobSummaryTimeline(timelineData, 30);
        expect(result.time.length).toEqual(30);
        expect(result.completed.length).toEqual(30);
        expect(result.failed.length).toEqual(30);
    });
    it('Return empty list if data is blank', () => {
        const result = groupByJobSummaryTimeline([], 30);
        expect(result).toEqual({ time: [], completed: [], failed: [] });
    });
});
