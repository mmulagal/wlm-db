import { TFunction } from 'i18next';

/**
 * Generates Oracle instance data for the accordion display
 */
export const generateOracleInstanceData = (storageSavingsResponse: any, selectedOnPremHostDetails: any) => {
    const computeArray = Array.isArray(storageSavingsResponse?.compute)
        ? storageSavingsResponse.compute
        : [storageSavingsResponse?.compute].filter(Boolean);

    const [firstCompute] = computeArray;

    let instanceType = '';
    if (firstCompute?.recommended?.instanceType) {
        [instanceType] = firstCompute.recommended.instanceType.split(',');
    }

    const oracleEdition = selectedOnPremHostDetails?.oracleEdition || '';

    // Deployment model from the on-prem host details
    const deploymentModel = selectedOnPremHostDetails?.deploymentModel || '';

    return {
        instanceType,
        oracleEdition,
        deploymentModel
    };
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
