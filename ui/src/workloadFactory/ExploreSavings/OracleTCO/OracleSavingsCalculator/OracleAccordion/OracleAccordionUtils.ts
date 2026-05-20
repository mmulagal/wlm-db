import { TFunction } from 'i18next';
import { DATABASE_DEPLOYMENT_MODE } from '../../../../../utils/consts';

/**
 * Generates Oracle instance data for the accordion display.
 * For bulk mode: looks up compute by hostname (Oracle EBS uses host.name which equals ec2HostName) or resourceName (Oracle On-Prem).
 * For single host: uses the first compute entry.
 */
export const generateOracleInstanceData = (
    storageSavingsResponse: any,
    selectedHostDetails: any,
    hostName?: string,
    manualEditionValue?: string
) => {
    if (!storageSavingsResponse) return {};

    const computeArray = Array.isArray(storageSavingsResponse?.compute)
        ? storageSavingsResponse.compute
        : [storageSavingsResponse?.compute].filter(Boolean);

    // For bulk mode (when hostName is provided), match by hostname (EBS) or resourceName (On-Prem)
    // For single host mode, use first entry
    const hostCompute = hostName
        ? computeArray.find((item: any) => item.hostname === hostName || item.resourceName === hostName)
        : computeArray[0];

    let instanceType = '';
    if (hostCompute?.recommended?.instanceType) {
        [instanceType] = hostCompute.recommended.instanceType.split(',');
    }

    let oracleEdition = '';
    // First check if oracleEdition exists directly on selectedHostDetails (Oracle EBS bulk mode — enriched by OracleEbsSavingsCalculatorApi)
    if (selectedHostDetails?.oracleEdition) {
        oracleEdition = selectedHostDetails.oracleEdition;
    }
    // Fallback: pick from databaseInstancesSummary (resource-details API response)
    else if (Array.isArray(selectedHostDetails?.databaseInstancesSummary)) {
        oracleEdition = selectedHostDetails.databaseInstancesSummary[0]?.databaseServer?.serverEdition || '';
    }
    // Check oracleDatabases array (Oracle on-prem mode)
    else if (Array.isArray(selectedHostDetails?.oracleDatabases) && selectedHostDetails.oracleDatabases.length > 0) {
        oracleEdition = selectedHostDetails.oracleDatabases[0].oracleEdition || '';
    }
    // Fallback: use the edition value passed in from the caller (Oracle manual EBS form selection)
    else if (manualEditionValue) {
        oracleEdition = manualEditionValue;
    }

    const deploymentModel = DATABASE_DEPLOYMENT_MODE.STANDALONE;

    return { instanceType, oracleEdition, deploymentModel };
};

/**
 * Generates Oracle server instance configuration display data for EBS mode
 */
export const OracleServerInstance = (oracleInstance: any, t: TFunction) => [
    {
        label: t('databases.explore-savings.oracle-deployment-mode-label'),
        value: oracleInstance?.deploymentModel || t('databases.general.not-available'),
        text: t('databases.explore-savings.oracle-deployment-mode-text')
    },
    {
        label: t('databases.explore-savings.oracle-edition-label'),
        value: oracleInstance?.oracleEdition || t('databases.general.not-available'),
        text: t('databases.explore-savings.oracle-edition-text')
    },
    {
        label: t('databases.explore-savings.oracle-instance-type-label'),
        value: oracleInstance?.instanceType || t('databases.general.not-available'),
        text: t('databases.explore-savings.oracle-instance-type-text')
    }
];

/**
 * Generates Oracle server instance configuration display data for On-Premise mode
 */
export const OracleServerInstanceForOnPremise = (oracleInstance: any, t: TFunction) => [
    {
        label: t('databases.explore-savings.oracle-deployment-mode-label'),
        value: oracleInstance?.deploymentModel || t('databases.general.not-available'),
        text: t('databases.explore-savings.oracle-deployment-mode-text-onprem')
    },
    {
        label: t('databases.explore-savings.oracle-edition-label'),
        value: oracleInstance?.oracleEdition || t('databases.general.not-available'),
        text: t('databases.explore-savings.oracle-edition-text-onprem')
    },
    {
        label: t('databases.explore-savings.oracle-instance-type-label'),
        value: oracleInstance?.instanceType || t('databases.general.not-available'),
        text: t('databases.explore-savings.oracle-instance-type-text-onprem')
    }
];
