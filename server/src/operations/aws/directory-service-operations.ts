import { DirectoryType } from '@aws-sdk/client-directory-service';
import { describeDirectories } from '../../lib/aws/directory-service';
import getLogger from '../../utils/logger';

const logger = getLogger();

interface AdsInterface {
    id?: string;
    dnsIpAddress?: Array<string>;
    launchTime?: number;
    domainName?: string;
    shortName?: string;
    ssoEnabled?: boolean;
    status?: string;
    type?: string;
    vpcSettings?: {
        vpcId?: string;
        subnetIds?: Array<string>;
        availabilityZones?: Array<string>;
        securityGroupId?: string;
    };
}

async function getAdsList(credentialsId: string, region: string) {
    logger.info('List Active Directories in a region', { credentialsId, region });

    let directories: Array<AdsInterface> = [];

    const { DirectoryDescriptions: directoryDesc } = (await describeDirectories(credentialsId, region, {})) || {};

    if (directoryDesc?.length) {
        directories = directoryDesc
            .filter(perDs => perDs.Type !== DirectoryType.SIMPLE_AD)
            .map(perDs => ({
                id: perDs.DirectoryId,
                dnsIpAddress: perDs.DnsIpAddrs,
                launchTime: perDs.LaunchTime?.getTime(),
                domainName: perDs.Name,
                shortName: perDs.ShortName,
                ssoEnabled: perDs.SsoEnabled,
                status: perDs.Stage,
                type: perDs.Type,
                vpcSettings: {
                    vpcId: perDs.VpcSettings?.VpcId,
                    availabilityZones: perDs.VpcSettings?.AvailabilityZones,
                    subnetIds: perDs.VpcSettings?.SubnetIds,
                    securityGroupId: perDs.VpcSettings?.SecurityGroupId
                }
            }));
    }
    logger.debug('Active Directories list', directories);

    return { directories };
}

export { getAdsList };
