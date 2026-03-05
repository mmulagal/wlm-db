import { TFunction } from 'i18next';
import { DATABASE_DEPLOYMENT_MODE } from '../../../../../utils/consts';

/**
 * Generates Oracle instance data for the accordion display.
 * When hostName is provided, looks up compute/license arrays by resourceName (bulk mode).
 * When hostName is omitted, uses the first compute entry (single mode).
 */
export const generateOracleInstanceData = (
    storageSavingsResponse: any,
    selectedOnPremHostDetails: any,
    hostName?: string
) => {
    if (!storageSavingsResponse) return {};

    const computeArray = Array.isArray(storageSavingsResponse?.compute)
        ? storageSavingsResponse.compute
        : [storageSavingsResponse?.compute].filter(Boolean);

    const hostCompute = hostName ? computeArray.find((item: any) => item.resourceName === hostName) : computeArray[0];

    let instanceType = '';
    if (hostCompute?.recommended?.instanceType) {
        [instanceType] = hostCompute.recommended.instanceType.split(',');
    }

    let oracleEdition = '';
    if (selectedOnPremHostDetails?.oracleEdition) {
        oracleEdition = selectedOnPremHostDetails.oracleEdition;
    } else if (
        Array.isArray(selectedOnPremHostDetails?.oracleDatabases) &&
        selectedOnPremHostDetails.oracleDatabases.length > 0
    ) {
        oracleEdition = selectedOnPremHostDetails.oracleDatabases[0].oracleEdition || '';
    }

    const deploymentModel = DATABASE_DEPLOYMENT_MODE.STANDALONE;

    return { instanceType, oracleEdition, deploymentModel };
};

/**
 * Generates Oracle server instance configuration display data
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
