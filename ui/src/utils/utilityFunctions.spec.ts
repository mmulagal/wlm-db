import { getSelectedFromSelectionState, formatSize, formatKmsData, formatVpcSubnetsData } from './utilityFunctions';
import numeral from 'numeral';
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
                    state: 'Enabled',
                    expiryStatus: ''
                },
                {
                    id: '038e4010-d061-4375-b002-e3bfb5ec194e',
                    name: 'alias/nviet-openlab-key6',
                    origin: 'AWS_KMS',
                    state: 'Enabled',
                    expiryStatus: 'expiring',
                    expirationDate: 'Aug 23, 2023'
                },
                {
                    id: '0a93acf4-ca6e-4847-8baa-9b0f561567b1',
                    name: 'alias/nviet-openlab-key6',
                    origin: 'AWS_KMS',
                    state: 'Enabled',
                    expiryStatus: 'expired',
                    expirationDate: 'June 23, 2023'
                },
                {
                    id: '1149596e-3d5c-4207-a2cc-2c0443c07aa4',
                    name: 'alias/nviet-openlab-key6',
                    origin: 'AWS_KMS',
                    state: 'Disabled',
                    expiryStatus: 'expired',
                    expirationDate: 'June 23, 2023'
                },
                {
                    id: '11b78ef1-7b45-4b2a-ae0e-2c8811094833',
                    name: 'alias/nviet-openlab-key6',
                    origin: 'AWS_KMS',
                    state: 'Enabled',
                    expiryStatus: '',
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
                expiryStatus: '',
                default: true
            },
            {
                id: '038e4010-d061-4375-b002-e3bfb5ec194e',
                name: 'alias/nviet-openlab-key6',
                origin: 'AWS_KMS',
                state: 'Enabled',
                expiryStatus: 'expiring',
                expirationDate: 'Aug 23, 2023'
            },
            {
                id: '0a93acf4-ca6e-4847-8baa-9b0f561567b1',
                name: 'alias/nviet-openlab-key6',
                origin: 'AWS_KMS',
                state: 'Enabled',
                expiryStatus: 'expired',
                expirationDate: 'June 23, 2023',
                cellProps: {
                    isDisabled: true
                }
            },
            {
                id: '11b78ef1-7b45-4b2a-ae0e-2c8811094833',
                name: 'alias/nviet-openlab-key6',
                origin: 'AWS_KMS',
                state: 'Enabled',
                expiryStatus: '',
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
