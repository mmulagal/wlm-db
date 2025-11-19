import { DATABASE_DEPLOYMENT_MODE, SAVINGS_CALC_MODE, SQL_DEPLOYMENT_MODE } from '../../../../utils/consts';

export const generateHostMsSqlInstanceData = (
    hostName: string,
    savingsCalculatorFrom: string | null,
    storageSavingsResponse: any,
    msSqlInstance: any
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
        }

        let serverEdition = '';
        if (hostLicense?.recommended?.sqlServerEdition) {
            serverEdition = hostLicense.recommended.sqlServerEdition.split(',')[0];
        }

        let serverVersion = '';
        if (hostCompute?.recommended?.windowsOsVersion) {
            serverVersion = hostCompute.recommended.windowsOsVersion;
        }

        let serverInstallationMode = '';
        if (hostCompute?.deploymentType) {
            serverInstallationMode =
                hostCompute.deploymentType === DATABASE_DEPLOYMENT_MODE.AOAG ||
                hostCompute.deploymentType.toLowerCase() === SQL_DEPLOYMENT_MODE.AOAG
                    ? DATABASE_DEPLOYMENT_MODE.FAILOVER_CLUSTER_INSTANCES
                    : hostCompute.deploymentType;
        }

        let actualServerInstallationMode = '';
        if (hostCompute?.deploymentType) {
            actualServerInstallationMode =
                hostCompute.deploymentType === DATABASE_DEPLOYMENT_MODE.AOAG ||
                hostCompute.deploymentType.toLowerCase() === SQL_DEPLOYMENT_MODE.AOAG
                    ? DATABASE_DEPLOYMENT_MODE.AOAG
                    : hostCompute.deploymentType;
        }

        return {
            instanceType,
            serverEdition,
            serverVersion,
            serverInstallationMode: serverInstallationMode || DATABASE_DEPLOYMENT_MODE.STANDALONE,
            actualServerInstallationMode
        };
    }
    return msSqlInstance;
};
