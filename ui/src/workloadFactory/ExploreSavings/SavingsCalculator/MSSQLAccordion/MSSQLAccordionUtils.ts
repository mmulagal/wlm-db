import { DATABASE_DEPLOYMENT_MODE, SAVINGS_CALC_MODE, SQL_DEPLOYMENT_MODE } from '../../../../utils/consts';

export const generateHostMsSqlInstanceData = (
    hostName: string,
    savingsCalculatorFrom: string | null,
    storageSavingsResponse: any,
    msSqlInstance: any,
    selectedHostDetails?: any
) => {
    if (savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS && storageSavingsResponse) {
        const computeArray = Array.isArray(storageSavingsResponse?.compute)
            ? storageSavingsResponse.compute
            : [storageSavingsResponse?.compute].filter(Boolean);
        const licenseArray = Array.isArray(storageSavingsResponse?.license)
            ? storageSavingsResponse.license
            : [storageSavingsResponse?.license].filter(Boolean);

        // Find compute and license data by matching hostname
        const hostCompute = computeArray.find((item: any) => item.hostname === hostName);
        const hostLicense = licenseArray.find((item: any) => item.hostname === hostName);

        let instanceType = '';
        if (hostCompute?.recommended?.instanceType) {
            instanceType = hostCompute.recommended.instanceType.split(',')[0];
        } else if (selectedHostDetails?.ec2Details?.[0]?.instanceType) {
            // Fallback to instance API data if storage savings not available yet
            instanceType = selectedHostDetails.ec2Details[0].instanceType;
        }

        let serverEdition = '';
        if (hostLicense?.recommended?.sqlServerEdition) {
            serverEdition = hostLicense.recommended.sqlServerEdition.split(',')[0];
        } else if (selectedHostDetails?.sqlServerInstances?.[0]?.databaseServer?.serverEdition) {
            serverEdition = selectedHostDetails.sqlServerInstances[0].databaseServer.serverEdition;
        }

        let serverVersion = '';
        if (hostCompute?.recommended?.windowsOsVersion) {
            serverVersion = hostCompute.recommended.windowsOsVersion;
        } else if (selectedHostDetails?.sqlServerInstances?.[0]?.databaseServer?.serverVersion) {
            serverVersion = selectedHostDetails.sqlServerInstances[0].databaseServer.serverVersion;
        }

        let serverInstallationMode = '';
        if (hostCompute?.deploymentType) {
            serverInstallationMode =
                hostCompute.deploymentType === DATABASE_DEPLOYMENT_MODE.AOAG ||
                hostCompute.deploymentType.toLowerCase() === SQL_DEPLOYMENT_MODE.AOAG
                    ? DATABASE_DEPLOYMENT_MODE.FAILOVER_CLUSTER_INSTANCES
                    : hostCompute.deploymentType;
        } else if (selectedHostDetails?.serverInstallationMode) {
            // Fallback to instance API data
            serverInstallationMode = selectedHostDetails.serverInstallationMode;
        }

        let actualServerInstallationMode = '';
        if (hostCompute?.deploymentType) {
            actualServerInstallationMode =
                hostCompute.deploymentType === DATABASE_DEPLOYMENT_MODE.AOAG ||
                hostCompute.deploymentType.toLowerCase() === SQL_DEPLOYMENT_MODE.AOAG
                    ? DATABASE_DEPLOYMENT_MODE.AOAG
                    : hostCompute.deploymentType;
        } else if (selectedHostDetails?.serverInstallationMode) {
            actualServerInstallationMode = selectedHostDetails.serverInstallationMode;
        }

        return {
            instanceType,
            serverEdition,
            serverVersion,
            serverInstallationMode: serverInstallationMode || DATABASE_DEPLOYMENT_MODE.STANDALONE,
            actualServerInstallationMode
        };
    }

    if (savingsCalculatorFrom === SAVINGS_CALC_MODE.ONPREM && storageSavingsResponse) {
        const computeArray = Array.isArray(storageSavingsResponse?.compute)
            ? storageSavingsResponse.compute
            : [storageSavingsResponse?.compute].filter(Boolean);
        const licenseArray = Array.isArray(storageSavingsResponse?.license)
            ? storageSavingsResponse.license
            : [storageSavingsResponse?.license].filter(Boolean);

        // Find compute and license data by matching resourceName (ONPREM API returns resourceName)
        const hostCompute = computeArray.find((item: any) => item.resourceName === hostName);
        const hostLicense = licenseArray.find((item: any) => item.resourceName === hostName);

        // If no match found, fall back to msSqlInstance (which contains data for single host or first host)
        if (!hostCompute && !hostLicense) {
            return msSqlInstance;
        }

        let instanceType = '';
        if (hostCompute?.recommended?.instanceType) {
            instanceType = hostCompute.recommended.instanceType.split(',')[0];
        }

        let serverEdition = '';
        if (hostLicense?.recommended?.sqlServerEdition) {
            serverEdition = hostLicense.recommended.sqlServerEdition.split(',')[0];
        }

        let windowsServer = '';
        if (hostCompute?.recommended?.windowsOsVersion) {
            windowsServer = hostCompute.recommended.windowsOsVersion.split(',')[0];
        }

        let serverInstallationMode = '';
        if (hostCompute?.deploymentType) {
            serverInstallationMode =
                hostCompute.deploymentType === DATABASE_DEPLOYMENT_MODE.AOAG ||
                hostCompute.deploymentType.toLowerCase() === SQL_DEPLOYMENT_MODE.AOAG ||
                hostCompute.deploymentType === SQL_DEPLOYMENT_MODE.FAILOVER_CLUSTER_VALUE_CAPS ||
                hostCompute.deploymentType.toLowerCase() === SQL_DEPLOYMENT_MODE.FAILOVER_CLUSTER_VALUE
                    ? DATABASE_DEPLOYMENT_MODE.FAILOVER_CLUSTER_INSTANCES
                    : hostCompute.deploymentType;
        }

        // For OnPrem, get serverVersion from selectedHostDetails if available
        let serverVersion = '';
        if (selectedHostDetails?.recommendedInstance?.serverVersion) {
            serverVersion = selectedHostDetails.recommendedInstance.serverVersion;
        } else if (hostCompute?.recommended?.serverVersion) {
            // Try to get from API response if available
            serverVersion = hostCompute.recommended.serverVersion;
        }

        const editionUpgradeCheck =
            hostLicense?.existing?.sqlServerEdition?.includes('Enterprise') &&
            hostLicense?.recommended?.sqlServerEdition?.includes('Standard');

        return {
            serverInstallationMode: serverInstallationMode || DATABASE_DEPLOYMENT_MODE.STANDALONE,
            serverEdition,
            serverVersion,
            instanceType,
            windowsServer,
            editionUpgradeCheck
        };
    }

    return msSqlInstance;
};
