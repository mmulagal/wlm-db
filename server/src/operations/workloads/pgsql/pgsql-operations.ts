import createError from 'http-errors';
import { isEmpty } from 'lodash-es';
import { generateHash } from '../../../utils/utils';
import { executeBashSsmCommand } from '../../aws/ssm-operations';
import getLogger from '../../../utils/logger';
import {
    DATABASE_INSTANCE_INDEX_MAPPING,
    DatabaseHostsQueryFields,
    HttpErrorCodes,
    ServerState,
    STORAGE_PROTOCOLS
} from '../../../utils/consts';
import { DatabaseInstance, PgSqlInstanceDetails, ResourceDetails } from '../../../utils/common-types';
import { DatabaseHostInstanceSummaryResponseType } from '../../../routes/types/database-hosts.types';
import DATABASES_COUNT from './queries';
import getPgSqlStorageSavings from './pgsql-ssm-script-utils';

const logger = getLogger();

async function getPgSqlInstanceInfo(
    accountId: string,
    credentialsId: string,
    region: string,
    instanceName: string,
    nodeIds: string[],
    fsxDataVolumeName: string
) {
    logger.info('Fetching pg sql instance info', { accountId, nodeIds, instanceName, fsxDataVolumeName });
    const commands = [`sudo -u postgres pg_controldata /${fsxDataVolumeName} | jq -R -s -c 'split("\\n")[:-1]'`];
    let response;
    try {
        for (const nodeId of nodeIds) {
            logger.info('Fetching PGSQL instance GUID', nodeId);
            response = await executeBashSsmCommand(credentialsId, region, commands, nodeId, accountId);
            if (response) {
                return response;
            }
        }

        if (!response) {
            const errorMessage = `Error fetching instance info from nodes: ${nodeIds.join(', ')}`;
            logger.error(errorMessage);
            throw createError(errorMessage);
        }
    } catch (err) {
        const errorMessage = `Error fetching pgsql instance id:,
            ${err},
            ${credentialsId},
            ${region},
            ${instanceName},`;
        throw createError(errorMessage);
    }
}

async function getPgSqlDatabaseCount(
    accountId: string,
    credentialsId: string,
    region: string,
    node1InstanceId: string
) {
    logger.info('Fetching pg sql database count', { accountId, credentialsId, region, node1InstanceId });

    try {
        const command = DATABASES_COUNT;
        const response = await executeBashSsmCommand(credentialsId, region, [command], node1InstanceId, accountId);
        if (response) {
            return response;
        }
        const errorMessage = `Error fetching database count from nodes: ${node1InstanceId}`;
        logger.error(errorMessage);
        throw createError(errorMessage);
    } catch (err) {
        const errorMessage = `Error fetching pgsql database count: ${err}, ${credentialsId}, ${region}`;
        logger.error(errorMessage);
        throw createError(errorMessage);
    }
}

async function getPgSqlDataMountedVolume(credentialsId: string, region: string, node1InstanceId: string) {
    logger.info('Fetching pg sql data volume mount point', { credentialsId, region, node1InstanceId });
    const commands = [
        // eslint-disable-next-line quotes
        "findmnt -n -o SOURCE $(sudo systemctl cat postgresql | grep Environment=PGDATA | awk -F= '/Environment=PGDATA=/ {print $3}')"
    ];
    let response;
    try {
        response = await executeBashSsmCommand(credentialsId, region, commands, node1InstanceId);
        const mountedVolume = response?.split(':')[1]?.substring(1)?.trim();
        return mountedVolume;
    } catch (err) {
        const errorMessage = `Error fetching pgsql data volume mount point:,
            ${err},
            ${credentialsId},
            ${region},
            ${node1InstanceId}`;
        logger.error(errorMessage);
        throw createError(errorMessage);
    }
}

function getPgSqlResourceId(node1InstanceId: string, node2InstanceId?: string) {
    logger.info('Get MS SQL resource ID:', { node1InstanceId, node2InstanceId });
    return node2InstanceId ? generateHash(node1InstanceId + node2InstanceId) : generateHash(node1InstanceId);
}

async function getPgSqlStorageSavingsVolumeData(
    accountId: string,
    credentialsId: string,
    region: string,
    node1InstanceId: string,
    fsxNId: string
) {
    logger.info('Fetching storage savings volume data', { accountId, credentialsId, region, node1InstanceId, fsxNId });
    let response;
    try {
        const endpoint =
            'storage/volumes?fields=efficiency.space_savings.total,efficiency.space_savings.total_percent,space.size,space.used';
        const commands = getPgSqlStorageSavings(fsxNId, region, endpoint);
        response = await executeBashSsmCommand(credentialsId, region, [commands], node1InstanceId);
        const {
            records: [volSavingsData]
        } = JSON.parse(response!) || {};
        const {
            efficiency: { space_savings: spaceSavings },
            space
        } = volSavingsData;
        const instanceStorageSavingsInfo = {
            fsxn: {
                spaceSavings: spaceSavings.total,
                spaceSavingsPercentage: spaceSavings.total_percent,
                size: space.size,
                used: space.used,
                protocol: [STORAGE_PROTOCOLS.NFS]
            }
        };
        logger.debug('Instance Storage Savings Data:', instanceStorageSavingsInfo);
        return instanceStorageSavingsInfo;
    } catch (err) {
        const errorMessage = `Error fetching storage savings volume data:,
            ${err},
            ${credentialsId},
            ${region}`;
        logger.error(errorMessage);
    }
}

async function getPgSqlDatabaseInstancesSummary(
    accountId: string,
    credentialsId: string,
    activeNodeInstanceId: string,
    region: string,
    databaseInstances: DatabaseInstance[],
    fields?: string,
    resourceDetails?: ResourceDetails,
    standbyNodeInstanceId?: string
) {
    logger.info('Fetching summary of PGSQL database instance', {
        accountId,
        credentialsId,
        activeNodeInstanceId,
        region,
        databaseInstances,
        fields,
        resourceDetails,
        standbyNodeInstanceId
    });

    let fieldsValues: Array<string> = [];

    if (fields) {
        fieldsValues = fields?.toLowerCase()?.replace(/\s+/g, '')?.split(',');
    }

    const getStorageSavings = fieldsValues?.includes(DatabaseHostsQueryFields.STORAGE.toLocaleLowerCase());
    const getDbCount = fieldsValues?.includes(DatabaseHostsQueryFields.DB_COUNT.toLocaleLowerCase());

    let storageData: any;
    let databasesCount: any;
    const errormessages: { [index: string]: string } = {};
    try {
        [storageData, databasesCount] = await Promise.all(
            [
                ...(getStorageSavings
                    ? [
                          Promise.all(
                              databaseInstances.map(dbInstance =>
                                  getPgSqlStorageSavingsVolumeData(
                                      accountId,
                                      credentialsId,
                                      region,
                                      activeNodeInstanceId,
                                      dbInstance.fsxn_ids
                                  )
                              )
                          )
                      ]
                    : [Promise.resolve()]), // Fetch storage savings data
                ...(getDbCount
                    ? [getPgSqlDatabaseCount(accountId, credentialsId, region, activeNodeInstanceId)]
                    : [Promise.resolve()])
            ].map((p, index) =>
                p.catch(error => {
                    if (DATABASE_INSTANCE_INDEX_MAPPING[index]) {
                        errormessages[DATABASE_INSTANCE_INDEX_MAPPING[index]] = JSON.stringify(error);
                    }
                    logger.error(`Error while fetching data: ${error}.`);
                })
            )
        );
    } catch (error) {
        logger.error(`Error while fetching PGSQL database instance summary ${accountId}, ${error}`);
        throw createError(
            HttpErrorCodes.INTERNAL_SERVER_ERROR,
            `Error while fetching PGSQL database instance summary ${accountId}, ${error}`
        );
    }

    return databaseInstances.map((databaseInstance: DatabaseInstance, index) => {
        const { database_instance_id: databaseInstanceId } = databaseInstance;

        const databaseInstanceDetails: DatabaseHostInstanceSummaryResponseType = {
            databaseInstanceId,
            databaseInstanceName: 'postgresql',
            status: '',
            databaseCount: 0
        };

        databaseInstanceDetails.status = ServerState.UP;

        const [instanceDbCount] = databasesCount?.[index] ?? [];
        if (getDbCount && instanceDbCount) {
            databaseInstanceDetails.databaseCount = instanceDbCount || 0;
        }

        databaseInstanceDetails.storage = storageData?.[index];

        if (!isEmpty(errormessages)) {
            databaseInstanceDetails.errors = errormessages;
        }

        return databaseInstanceDetails;
    });
}

async function getPgSqlDatabaseInstancesDetails(
    credentialsId: string,
    region: string,
    instancesManaged: DatabaseInstance[],
    resourceId: string,
    instanceDetails?: PgSqlInstanceDetails[] | undefined
) {
    logger.info('Getting pgsql database Instances details for resource', {
        credentialsId,
        region,
        instancesManaged,
        resourceId,
        instanceDetails
    });

    const managedInstancesName = instancesManaged.map((item: DatabaseInstance) => ({
        instanceName: item.database_instance_name,
        isDefault: item.is_default,
        instanceState: ServerState.DOWN,
        isManaged: true,
        databaseInstanceId: item.database_instance_id
    }));

    const existingInstanceIDs = new Set(instanceDetails?.map(({ databaseInstanceId }) => databaseInstanceId));
    const updatedInstanceDetails = [
        ...(instanceDetails ?? []),
        ...managedInstancesName.filter(({ databaseInstanceId }) => !existingInstanceIDs.has(databaseInstanceId))
    ];
    return updatedInstanceDetails;
}

export {
    getPgSqlResourceId,
    getPgSqlInstanceInfo,
    getPgSqlStorageSavingsVolumeData,
    getPgSqlDataMountedVolume,
    getPgSqlDatabaseCount,
    getPgSqlDatabaseInstancesSummary,
    getPgSqlDatabaseInstancesDetails
};
