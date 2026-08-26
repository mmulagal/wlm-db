import { faker } from '@faker-js/faker';
import nock from 'nock';
import { WORKLOAD_FACTORY_ENDPOINT } from '../../../../src/utils/consts';
import registerCredentialsResponse from '../../responses/cloud-manager/register-credentials-fsx-core.json';
import listFSXFileSystemsResponse from '../../responses/cloud-manager/list-file-systems.json';

const LIST_PATH_REGEX = /^\/accounts\/[^/]+\/fsx\/v2\/credentials\/([^/]+)\/regions\/([^/]+)\/file-systems/;
const CREDENTIALS_PATH_REGEX = /^\/accounts\/[^/]+\/fsx\/v2\/file-systems\/([^/?]+)\/ontap-credentials(?:\?.*)?$/;

nock(`${WORKLOAD_FACTORY_ENDPOINT}`, {
    allowUnmocked: process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator'
})
    .persist(true)
    .post(/^\/accounts\/(.+)\/fsx\/v2\/credentials\/(.+)\/regions\/(.+)\/file-systems\/(.+)\/ontap-credentials$/)
    .reply(() => [200, registerCredentialsResponse])
    .get(CREDENTIALS_PATH_REGEX)
    .reply(() => [
        200,
        {
            credentials: {
                ip: 'management.fs-0f32f6c69fb7e40ac.fsx.ap-southeast-1.amazonaws.com',
                userName: 'fsxadmin',
                password: `${faker.string.alphanumeric(20)}`
            }
        }
    ])
    .get(LIST_PATH_REGEX)
    .reply(() => [200, listFSXFileSystemsResponse])
    .post(/^\/accounts\/(.+)\/fsx\/v2\/file-systems$/)
    .reply(() => [
        200,
        {
            id: 'fs-8b810ed2978f24edea',
            accountId: '293795455044',
            lifecycle: 'CREATING',
            storageType: 'SSD',
            storageCapacity: 2199023255552,
            vpcId: 'vpc-a1',
            subnetIds: ['subnet-a1', 'subnet-a2'],
            networkInterfaceIds: ['eni-nb6OwtAeRUlw', 'eni-jihIUgV8HZPQ'],
            kmsKeyId: '329e6bf0-9b59-46c1-81ab-ab2280c3f65c',
            arn: 'arn:aws:fsx:us-east-1:293795455044:file-system/fs-8b810ed2978f24edea',
            tags: [{ key: 'Name', value: 'fsx-wlmdb-SSNGI' }],
            deploymentType: 'MULTI_AZ',
            awsDeploymentType: 'MULTI_AZ_1',
            endpointIpAddressRange: `${faker.internet.ipv4}/16`, // use faker to generate a random ip address
            endpoints: {
                intercluster: {
                    dnsName: 'intercluster.fs-8b810ed2978f24edea.fsx.us-east-1.amazonaws.com',
                    ipAddresses: [faker.internet.ipv4, faker.internet.ipv4]
                },
                management: { dnsName: 'management.fs-8b810ed2978f24edea.fsx.us-east-1.amazonaws.com' }
            },
            minimumSsdIops: 6144,
            preferredSubnetId: 'subnet-a1',
            routeTableIds: ['rtb-11111111'],
            throughputCapacity: 134217728,
            throughputCapacityPerHAPair: 134217728,
            diskIopsConfiguration: { mode: 'AUTOMATIC', iops: 6144 },
            weeklyMaintenanceStartTime: '1:08:30',
            haPairs: 1,
            creationTime: 1746196018000,
            automaticBackupRetentionDays: 30,
            dailyAutomaticBackupStartTime: '05:00',
            propertiesPendingUpdate: {}
        }
    ]);
