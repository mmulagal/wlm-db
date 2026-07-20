import { compact, map } from 'lodash-es';

import { executeSSMDocumentMultipleInstances, extractSsmResponse } from './aws/ssm-operations';
import {
    AWS_FLEET_MANAGER_GET_WINDOWS_REGISTRY_CONTENT_DOC,
    SQL_SERVER_INSTANCE_NAMES_REGISTRY_PATH,
    SSM_COMMAND_RUNTIMES
} from '../utils/consts';
import { SQL_SERVER_VERSION_TO_YEAR } from './workloads/mssql/discover-consts';
import { SqlServerInstanceInfoType, DiscoverResponseInfoType } from '../routes/types/discover.types';
import { DiscoverySource, SsmTargetsInfo } from '../utils/common-types';
import getLogger from '../utils/logger';

const logger = getLogger();

function parseRegistryOutput(output: string): SqlServerInstanceInfoType[] {
    logger.info('Parsing Fleet Manager registry output');
    const parsed = JSON.parse(output);
    const registryItems: { Name?: string; Value?: string; Data?: string }[] =
        parsed?.data?.results ?? parsed?.Items ?? [];

    return compact(
        map(registryItems, ({ Name, Value, Data }): SqlServerInstanceInfoType | undefined => {
            if (!Name) {
                return undefined;
            }
            const versionString = Value ?? Data ?? '';
            const majorVersion = Number(String(versionString).match(/MSSQL(\d+)\./)?.[1]);
            return {
                sqlServerInstance: Name,
                sqlServerState: 'Running',
                sqlServerVersion: majorVersion ? `${majorVersion}.0` : 'Unknown',
                sqlServerProductYear: SQL_SERVER_VERSION_TO_YEAR.get(majorVersion) ?? 0,
                isDefaultInstance: Name === 'MSSQLSERVER',
                windowsAuthentication: false,
                sqlServerAuthentication: false,
                windowsDomainUserAuthentication: false,
                windowsOsVersion: 'Unknown'
            };
        })
    );
}

async function getSqlServerInstancesFromRegistry(
    credentialsId: string,
    region: string,
    ec2InstanceIds: string[],
    accountId: string
): Promise<Map<string, SqlServerInstanceInfoType[]>> {
    logger.info('Fetching SQL Server instances from Windows registry via Fleet Manager', {
        region,
        instanceCount: ec2InstanceIds.length
    });

    try {
        const ssmResponses = await executeSSMDocumentMultipleInstances(
            credentialsId,
            region,
            {
                DocumentName: AWS_FLEET_MANAGER_GET_WINDOWS_REGISTRY_CONTENT_DOC,
                InstanceIds: ec2InstanceIds,
                Comment: 'Discover SQL Server instances via Fleet Manager registry fallback',
                Parameters: { Path: [SQL_SERVER_INSTANCE_NAMES_REGISTRY_PATH] }
            },
            accountId
        );

        const resultsByInstanceId = new Map<string, SqlServerInstanceInfoType[]>();

        await Promise.all(
            ssmResponses.map(async ssmResponse => {
                const { instanceId } = ssmResponse;
                const { output, error } = await extractSsmResponse(
                    credentialsId,
                    region,
                    SSM_COMMAND_RUNTIMES.POWERSHELL,
                    ssmResponse,
                    accountId
                );

                if (error || !output) {
                    logger.warn('Fleet Manager registry read returned no usable output', {
                        instanceId,
                        error
                    });
                    resultsByInstanceId.set(instanceId, []);
                    return;
                }

                try {
                    resultsByInstanceId.set(instanceId, parseRegistryOutput(output));
                } catch (parseError) {
                    logger.warn('Failed to parse Fleet Manager registry output', {
                        instanceId,
                        parseError
                    });
                    resultsByInstanceId.set(instanceId, []);
                }
            })
        );

        logger.info('Fetched SQL Server instances from Windows registry via Fleet Manager', {
            region,
            instanceCount: ec2InstanceIds.length
        });
        return resultsByInstanceId;
    } catch (error) {
        logger.warn('Failed to fetch SQL Server instances from registry fallback', {
            ec2InstanceIds,
            error
        });
        return new Map();
    }
}

async function getRegistryOnlySqlServerInstances(
    accountId: string,
    credentialsId: string,
    region: string,
    ssmTargets: SsmTargetsInfo[],
    alreadyReportedInstanceIds: Set<string>
): Promise<DiscoverResponseInfoType[]> {
    const startTime = Date.now();
    logger.info('Populating SQL Server instances from Fleet Manager registry fallback', {
        region,
        targetCount: ssmTargets.length
    });

    const eligibleTargets = ssmTargets.filter(
        ({ hostManageReadiness, ec2InstanceId }) =>
            hostManageReadiness?.extensiveRunPermission === false &&
            hostManageReadiness?.canReadAWSSSMDocuments === true &&
            !alreadyReportedInstanceIds.has(ec2InstanceId)
    );

    if (!eligibleTargets.length) {
        return [];
    }

    const resultsByInstanceId = await getSqlServerInstancesFromRegistry(
        credentialsId,
        region,
        eligibleTargets.map(({ ec2InstanceId }) => ec2InstanceId),
        accountId
    );

    const responseInfo = eligibleTargets.flatMap((target): DiscoverResponseInfoType[] => {
        const {
            ec2InstanceId,
            ec2InstanceType,
            ec2InstanceName,
            ec2UsageOperation,
            ssmState,
            vpc,
            hostManageReadiness
        } = target;
        const sqlServerInstances = resultsByInstanceId.get(ec2InstanceId) ?? [];
        if (!sqlServerInstances.length) {
            return [];
        }
        return [
            {
                ec2InstanceId,
                ec2InstanceType,
                ec2InstanceName,
                ec2UsageOperation,
                ssmState,
                sqlServerInstances,
                vpc,
                source: DiscoverySource.TAGGING_SERVICE,
                hostManageReadiness
            }
        ];
    });

    logger.info('Populated SQL Server instances from Fleet Manager registry fallback', {
        region,
        eligibleCount: eligibleTargets.length,
        resultCount: responseInfo.length,
        durationMs: Date.now() - startTime
    });
    return responseInfo;
}

export { getSqlServerInstancesFromRegistry, getRegistryOnlySqlServerInstances };
