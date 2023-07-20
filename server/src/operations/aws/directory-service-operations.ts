import { describeDirectories } from '../../lib/aws/directory-service';

import getLogger from '../../utils/logger';
const logger = getLogger();

export interface AdsInterface {
    directoryId?: string;
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
    }
}

export async function getAdsList(credentialsId: string, region: string, vpcId: string) {
    logger.info('List Active Directories in a region for a given VPC', { credentialsId, region, vpcId });
    const { DirectoryDescriptions: directoryDesc } = await describeDirectories(credentialsId, region, {}) || [];
    let directories: Array<AdsInterface> = [];
    if (directoryDesc?.length) {
        directories = directoryDesc?.filter(
            (perDs)=> perDs.VpcSettings?.VpcId === vpcId).map((perDs) => 
            ({
                directoryId: perDs.DirectoryId, dnsIpAddress: perDs.DnsIpAddrs, 
                launchTime: perDs.LaunchTime, domainName: perDs.Name, 
                shortName: perDs.ShortName, ssoEnabled: perDs.SsoEnabled, 
                status: perDs.Stage, type: perDs.Type, 
                vpcSettings: 
                {
                    vpcId: perDs.VpcSettings?.VpcId, 
                    availabilityZones: perDs.VpcSettings?.AvailabilityZones, 
                    subnetIds: perDs.VpcSettings?.SubnetIds
                }
            }))
    }
    return { directories: directories };
}
