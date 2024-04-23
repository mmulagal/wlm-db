import createError from 'http-errors';
import { compact } from 'lodash-es';
import { getHostAndSqlServerInfo } from '../discover-operations';
import { HttpErrorCodes } from '../../utils/consts';
import getLogger from '../../utils/logger';
import getStorageSavings from '../../lib/cloud-manager/marketing';
import { StorageSavingsResponseType } from '../../routes/types/storage-savings.types';

const logger = getLogger();

export default async function performStorageSavingsCalculations(
    accountId: string,
    credentialsId: string,
    region: string,
    instanceId: string
): Promise<StorageSavingsResponseType> {
    logger.info('Performing storage savings calculations ', { accountId, credentialsId, region, instanceId });

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

    const { ebs, fsx } = await getStorageSavings(accountId, credentialsId, region, ebsVolumeIds);
    return {
        ebs,
        fsx
    };
}
