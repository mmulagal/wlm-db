import { describeDirectories } from '../../lib/aws/directory-service';
import createError from 'http-errors';
import getLogger from '../../utils/logger';
const logger = getLogger();

interface AdsInterface {
    id?: string;
    dnsIpAddress?: Array<string>;
    launchTime?: Date;
    domainName?: string;
    shortName?: string;
    ssoEnabled?: boolean;
    status?: string;
    type?: string;
    vpcSettings?: {
        vpcId?: string;
        subnetIds?: Array<string>;
        availabilityZones?: Array<string>;
    };
}

async function getAdsList(credentialsId: string, region: string) {
    logger.info('List Active Directories in a region', { credentialsId, region });

    let directories: Array<AdsInterface> = [];

    try {
        const { DirectoryDescriptions: directoryDesc } = (await describeDirectories(credentialsId, region, {})) || {};

        if (directoryDesc?.length) {
            directories = directoryDesc.map(perDs => ({
                id: perDs.DirectoryId,
                dnsIpAddress: perDs.DnsIpAddrs,
                launchTime: perDs.LaunchTime,
                domainName: perDs.Name,
                shortName: perDs.ShortName,
                ssoEnabled: perDs.SsoEnabled,
                status: perDs.Stage,
                type: perDs.Type,
                vpcSettings: {
                    vpcId: perDs.VpcSettings?.VpcId,
                    availabilityZones: perDs.VpcSettings?.AvailabilityZones,
                    subnetIds: perDs.VpcSettings?.SubnetIds
                }
            }));
        }
    } catch (error: any) {
        logger.error('Failed to get the AWS Active Directories list ', error.message);
        throw createError(error.statusCode || error.code || 500, error.message);
    }

    logger.debug('Active Directories list', directories);
    return { directories: directories };
}

export { getAdsList };
