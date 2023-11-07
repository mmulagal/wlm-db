import '../../simulator/scopes/aws/ec2-scope';
import '../../simulator/scopes/aws/fsx-scope';
import '../../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import '../../simulator/scopes/cloud-manager/workload-factory-credentials-scope';
import '../../simulator/scopes/opentelemetry-scope';
import '../../simulator/scopes/aws/ssm-scope';
import '../../simulator/scopes/cloud-manager/cloud-manager-tenancy-scope';
import { DEFAULT_AWS_REGION } from '../../../src/utils/consts';
import {
    getFSxFileSystemsList,
    getOntapVolumesSnapshotCount,
    isAWSBackupEnabled
} from '../../../src/operations/aws/fsx-operations';
import { ACTIVE_INSTANCE_ID, DEFAULT_AWS_CREDENTIALS_TYPE, DEFAULT_AWS_VPC_ID } from '../../utils/consts';

const FSX_FILESYSTEM_ID = 'fs-03773e21b2f0e39b4';
const FSX_SECRET = 'wlmdb-fsx1698373976113';

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
                    ],
                    securityGroups: ['sg-05f4939d6670b405f', 'sg-3924c15c'],
                    storageVirtualMachines: [
                        {
                            storageVirtualMachineId: 'svm-0491dd89a76b7ca3d',
                            storageVirtualMachineName: 'wlmdb_sqlsvm_1695189650293',
                            resourceARN:
                                'arn:aws:fsx:ap-southeast-1:464262061435:storage-virtual-machine/fs-0b6426cf6960a5082/svm-0491dd89a76b7ca3d',
                            lifeCycle: 'CREATED',
                            subtype: 'DEFAULT',
                            creationTime: '2023-09-20T06:43:53.667Z',
                            uuid: '3bb505f5-5781-11ee-bbaa-73441e925a97'
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

    it('AWS backup enabled check', async () => {
        const response = await isAWSBackupEnabled(DEFAULT_AWS_CREDENTIALS_TYPE, DEFAULT_AWS_REGION, FSX_FILESYSTEM_ID);
        expect(response).toEqual(true);
    });

    it('Get Ontap volume snapshots count', async () => {
        const response = await getOntapVolumesSnapshotCount(
            DEFAULT_AWS_CREDENTIALS_TYPE,
            DEFAULT_AWS_REGION,
            FSX_FILESYSTEM_ID,
            FSX_SECRET,
            ACTIVE_INSTANCE_ID
        );
        expect(response).toBeDefined();
    });
});
