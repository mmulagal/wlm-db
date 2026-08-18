import createError from 'http-errors';
import { HEADERS, HttpErrorCodes, WORKLOAD_FACTORY_ENDPOINT } from '../../utils/consts';
import { gotInstanceForInternalRequest, isHTTPError } from '../../utils/got';
import getLogger from '../../utils/logger';
import { getWfServiceToken } from './auth';

const logger = getLogger();

const EC2_STORAGE_ORACLE_MSSQL_QUERY = `
query Ec2StorageOracleMssql(
  $accountId: JSON!
  $credential: JSON!
  $region: JSON!
  $first: Int = 1000
) {
  relationships(
    where: [{ field: "accountId", op: EQ, value: $accountId }]
    first: $first
  ) {
    computeId
    storageId
    storageType
  }
  ec2Instances(
    where: [
      { field: "accountId", op: EQ, value: $accountId }
      { field: "credential", op: EQ, value: $credential }
      { field: "region", op: EQ, value: $region }
    ]
    first: $first
  ) {
    accountId
    credential
    region
    instanceId
    instanceType
    platform
    privateIpAddress
    vpcId
    subnetId
    state { name }
    tags { key value }
    workloads(
      where: [{ field: "workload", op: IN, value: ["Oracle Database", "Microsoft SQL Server"] }]
    ) {
      workload
      category
      confidence
      isPrimary
    }
  }
  fsxVolumes(
    where: [
      { field: "accountId", op: EQ, value: $accountId }
      { field: "credential", op: EQ, value: $credential }
      { field: "region", op: EQ, value: $region }
    ]
    first: $first
  ) {
    accountId
    credential
    region
    volumeId
    fileSystemId
    ontapUuid
    name
    lifecycle
    storageVirtualMachineId
    ontapConfiguration { sizeInMegabytes }
    workloads { workload category confidence isPrimary }
  }
  ontapVolumes(
    where: [
      { field: "accountId", op: EQ, value: $accountId }
      { field: "credential", op: EQ, value: $credential }
      { field: "region", op: EQ, value: $region }
    ]
    first: $first
  ) {
    accountId
    credential
    region
    uuid
    name
    fileSystemId
    svmName
    state
    size
    workloads { workload category confidence isPrimary }
  }
  ontapLuns(
    where: [
      { field: "accountId", op: EQ, value: $accountId }
      { field: "credential", op: EQ, value: $credential }
      { field: "region", op: EQ, value: $region }
    ]
    first: $first
  ) {
    accountId
    credential
    region
    uuid
    name
    fileSystemId
    volumeName
    osType
    workloads { workload category confidence isPrimary }
  }
}
`.trim();

const EC2_DATABASE_INSTANCES_QUERY = `
query Ec2DatabaseInstances(
  $accountId: JSON!
  $credential: JSON!
  $region: JSON!
  $first: Int = 1000
) {
  ec2Instances(
    where: [
      { field: "accountId", op: EQ, value: $accountId }
      { field: "credential", op: EQ, value: $credential }
      { field: "region", op: EQ, value: $region }
    ]
    first: $first
  ) {
    instanceId
    instanceType
    platform
    platformDetails
    usageOperation
    privateIpAddress
    privateDnsName
    vpcId
    subnetId
    rootDeviceName
    rootDeviceType
    placement {
      availabilityZone
      availabilityZoneId
      affinity
      groupId
      groupName
      hostId
      hostResourceGroupArn
      partitionNumber
      spreadDomain
      tenancy
    }
    iamInstanceProfile { arn id }
    blockDeviceMappings {
      deviceName
      ebs {
        volumeId
        status
        attachTime
        deleteOnTermination
        volumeOwnerId
        ebsCardIndex
        associatedResource
      }
    }
    workloads(
      where: [{ field: "workload", op: IN, value: ["Oracle Database", "Microsoft SQL Server", "PostgreSQL"] }]
    ) {
      workload
      category
      confidence
      reasoning
      isPrimary
    }
  }
}
`.trim();

async function callWlmHostsGraphql<T>(
    accountId: string,
    credentialsId: string,
    region: string,
    query: string
): Promise<T> {
    logger.info('Fetching wlm-hosts resources via graphql', { accountId, credentialsId, region });

    try {
        const { token } = await getWfServiceToken();

        const { data, errors } = await gotInstanceForInternalRequest
            .post('wlm-hosts/graphql', {
                prefixUrl: WORKLOAD_FACTORY_ENDPOINT,
                headers: {
                    [HEADERS.AUTHORIZATION]: token
                },
                json: {
                    query,
                    variables: { accountId, credential: credentialsId, region, first: 1000 }
                }
            })
            .json<{ data: T; errors?: { message: string }[] }>();

        if (errors?.length) {
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errors.map(({ message }) => message).join('; '));
        }

        return data;
    } catch (error: unknown) {
        const statusCode = error instanceof Error && isHTTPError(error) ? error.response.statusCode : undefined;
        logger.error('wlm-hosts graphql request failed', { accountId, credentialsId, region, statusCode, error });
        throw createError(
            statusCode ?? HttpErrorCodes.INTERNAL_SERVER_ERROR,
            `wlm-hosts graphql listing for credentials ${credentialsId} in ${region} failed`
        );
    }
}

export { callWlmHostsGraphql, EC2_DATABASE_INSTANCES_QUERY, EC2_STORAGE_ORACLE_MSSQL_QUERY };
