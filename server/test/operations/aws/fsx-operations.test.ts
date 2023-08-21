import '../../simulator/scopes/aws/fsx-scope';
import '../../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import { DEFAULT_AWS_REGION } from '../../../src/utils/consts';
import { getFSxFileSystemsList } from '../../../src/operations/aws/fsx-operations';
import { DEFAULT_AWS_CREDENTIALS_TYPE, DEFAULT_AWS_VPC_ID } from '../../utils/consts';

describe('Testcases for Amazon FSx resources operations', () => {
    it('List FSx filesystems and volume details', async () => {
        const fsxFilesystemResponse = {
            filesystems: [
                {
                    fileSystemId: 'fs-03773e21b2f0e39b4',
                    name: 'DBSFSX',
                    kmsKeyId: 'arn:aws:kms:ap-southeast-1:464262061435:key/0a96542a-f57b-487c-a0fc-4db5d74c0a89',
                    lifecycle: 'AVAILABLE',
                    networkInterfaceIds: ['eni-0f21c7486b651ca11', 'eni-01a4d0d5f61d75ee4'],
                    subnetIds: ['subnet-f4484e80', 'subnet-4cdd3b29'],
                    vpcId: 'vpc-84b3afe6',
                    ontapConfiguration: {
                        deploymentType: 'MULTI_AZ_1',
                        endpointIpAddressRange: '172.31.255.255/26',
                        fsxAdminPassword: undefined,
                        preferredSubnetId: 'subnet-f4484e80',
                        routeTableIds: ['rtb-65aeb107'],
                        throughputCapacity: 128,
                        diskIopsConfiguration: {
                            iops: 3072,
                            mode: 'AUTOMATIC'
                        },
                        endpoints: {
                            intercluster: {
                                dnsName: undefined,
                                ipAddresses: undefined
                            },
                            management: {
                                dnsName: undefined,
                                ipAddresses: undefined
                            }
                        }
                    },
                    volumes: [
                        {
                            volumeId: 'fsvol-0245cba066cb77500',
                            volumeType: 'ONTAP',
                            securityStyle: 'UNIX',
                            sizeInMegabytes: 1048576,
                            storageEfficiencyEnabled: false,
                            storageVirtualMachineId: 'svm-03985e26ffd55441d',
                            ontapVolumeType: 'RW'
                        },
                        {
                            volumeId: 'fsvol-0be5ccb4d6b461a2f',
                            volumeType: 'ONTAP',
                            securityStyle: 'UNIX',
                            sizeInMegabytes: 1024,
                            storageEfficiencyEnabled: false,
                            storageVirtualMachineId: 'svm-03985e26ffd55441d',
                            ontapVolumeType: 'RW'
                        }
                    ]
                }
            ]
        };

        const response = await getFSxFileSystemsList(
            DEFAULT_AWS_CREDENTIALS_TYPE,
            DEFAULT_AWS_REGION,
            DEFAULT_AWS_VPC_ID
        );

        expect(response).toEqual(fsxFilesystemResponse);
    });
});
