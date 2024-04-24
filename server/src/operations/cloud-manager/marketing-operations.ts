import createError from 'http-errors';
import { compact } from 'lodash-es';
import { getHostAndSqlServerInfo } from '../discover-operations';
import { HttpErrorCodes } from '../../utils/consts';
import getLogger from '../../utils/logger';
import getStorageSavings from '../../lib/cloud-manager/marketing';
import { StorageSavingsRequestBodyType, StorageSavingsResponseType } from '../../routes/types/storage-savings.types';
import { camelizeKeys } from '../../utils/utils';

const logger = getLogger();

export default async function performStorageSavingsCalculations(
    accountId: string,
    credentialsId: string,
    region: string,
    instanceId: string,
    params?: StorageSavingsRequestBodyType // not using ATM, dependant on https://jira.ngage.netapp.com/browse/GROGU-2375
): Promise<StorageSavingsResponseType> {
    logger.info('Performing storage savings calculations ', { accountId, credentialsId, region, instanceId, params });

    const {
        items: [ec2HostDetails]
    } = await getHostAndSqlServerInfo(accountId, credentialsId, region, undefined, undefined, [instanceId]);

    const sqlServerInstances = ec2HostDetails?.sqlServerInstances;
    const ebsVolumeIds = compact(
        sqlServerInstances
            ?.filter(({ storage }) => storage?.find(sqlStorage => sqlStorage.type === 'EBS'))
            .map(({ storage }) => storage?.find(sqlStorage => sqlStorage.type === 'EBS')?.id)
    );

    if (!ebsVolumeIds.length) {
        throw createError(HttpErrorCodes.NOT_FOUND, `No EBS volumes found for the provided instance: ${instanceId}`);
    }

    const {
        ebs,
        fsx,
        fsx_calculation: fsxCalculationData
    } = await getStorageSavings(accountId, credentialsId, region, ebsVolumeIds);
    const fsxCalculation = camelizeKeys(fsxCalculationData);

    return {
        ebs,
        fsx,
        fsxCalculation
    };
}
