import { DsFlashingDotsLoader, DsTypography } from '@netapp/design-system';
import { useTranslation } from 'react-i18next';
import { ReactComponent as DescriptionIcon } from '../../../../../assets/Description Icons.svg';
import { ReactComponent as Success } from '../../../../../assets/success.svg';
import { ReactComponent as Failure } from '../../../../../assets/error-icon.svg';
import styles from './ResourceHeader.module.scss';
import { GENERAL } from '../../../../../utils/appConstants';
import { DBType, INVENTORY_STATUS, TENANCY, WELL_ARCHITECTED_TABS } from '../../../../../utils/consts';
import { getDiscoveredHostDeploymentV2 } from '../../../../InventoryV2/InventoryUtilsV2';

type ResourceHeaderProps = {
    selectedHostname: string;
    selectedDatabaseInstanceName: string;
    resourceLoading: boolean;
    resourceDetails: any;
    resourceHeaderType: string;
};

const ResourceHeader = ({
    resourceLoading,
    resourceDetails,
    selectedHostname,
    selectedDatabaseInstanceName,
    resourceHeaderType
}: ResourceHeaderProps) => {
    const { t } = useTranslation();
    const mapResourceDetailsStatus = (status: string) => {
        if (status === INVENTORY_STATUS.CASE_SENSITIVE_UP) {
            return INVENTORY_STATUS.ONLINE;
        }
        if (status === INVENTORY_STATUS.CASE_SENSITIVE_DOWN) {
            return INVENTORY_STATUS.OFFLINE;
        }
        return status;
    };

    const formatTenancyValue = (tenancy: string) => {
        if (!tenancy) return tenancy;

        const lowerCaseTenancy = tenancy.toLowerCase();
        if (lowerCaseTenancy.includes('single')) {
            return t('databases.oracle-inner-page.single-tenant');
        }
        if (lowerCaseTenancy.includes('multi')) {
            return t('databases.oracle-inner-page.multi-tenant');
        }
        return tenancy;
    };

    const deploymentType = getDiscoveredHostDeploymentV2(resourceDetails, t);

    const oracleDeploymentType = resourceDetails?.isDataGuardDeployed
        ? [resourceDetails?.topology?.serverInstallationMode, 'Data Guard'].filter(Boolean).join(' + ')
        : resourceDetails?.topology?.serverInstallationMode;

    return (
        <div className={styles.cardHeader}>
            {resourceHeaderType === DBType.MSSQL && (
                <div className={styles.cardContent}>
                    {/* image */}
                    <div className={`${styles.column} ${styles.columnImage}`}>
                        <DescriptionIcon />
                    </div>

                    <div className={`${styles.column} ${styles.columnWidth}`}>
                        {resourceLoading ? (
                            <DsFlashingDotsLoader />
                        ) : (
                            <DsTypography
                                variant="Semibold_14"
                                className={styles.titleText}
                                style={{ paddingRight: '8px' }}
                                title={`${selectedHostname} \\ ${selectedDatabaseInstanceName}`}
                            >
                                {`${selectedHostname} \\ ${selectedDatabaseInstanceName}`}
                            </DsTypography>
                        )}
                        <DsTypography variant="Regular_14" className={styles.label} title={GENERAL.INSTANCE_NAME}>
                            {GENERAL.INSTANCE_NAME}
                        </DsTypography>
                    </div>

                    {/* section 2 */}
                    <div className={`${styles.column}`}>
                        <DsTypography variant="Semibold_14" className={styles.titleText}>
                            {resourceLoading ? (
                                <DsFlashingDotsLoader />
                            ) : (
                                <>
                                    <span className={styles.svgSection}>
                                        {resourceDetails.status === 'Up' ? <Success /> : <Failure />}
                                    </span>
                                    <span className={styles.valueSection} title={resourceDetails.status}>
                                        {mapResourceDetailsStatus(resourceDetails.status)}
                                    </span>
                                </>
                            )}
                        </DsTypography>

                        <DsTypography variant="Regular_14" className={styles.label}>
                            {GENERAL.STATUS}
                        </DsTypography>
                    </div>

                    {/* section 3 */}
                    <div className={`${styles.column}`}>
                        <DsTypography variant="Semibold_14" className={styles.titleText} title={deploymentType}>
                            {resourceLoading ? <DsFlashingDotsLoader /> : deploymentType}
                        </DsTypography>

                        <DsTypography
                            variant="Regular_14"
                            className={styles.label}
                            title={GENERAL.RESOURCE_DEPLOYMENT_MODEL}
                        >
                            {GENERAL.RESOURCE_DEPLOYMENT_MODEL}
                        </DsTypography>
                    </div>

                    {/* section 4 */}
                    <div className={`${styles.column}`} style={{ borderRight: 'none' }}>
                        <DsTypography variant="Semibold_14" className={styles.titleText}>
                            {resourceLoading ? <DsFlashingDotsLoader /> : resourceDetails.databaseCount}
                        </DsTypography>

                        <DsTypography variant="Regular_14" className={styles.label} title={GENERAL.NO_OF_DBS}>
                            {GENERAL.NO_OF_DBS}
                        </DsTypography>
                    </div>
                </div>
            )}
            {resourceHeaderType === DBType.ORACLE && (
                <div className={styles.cardContent}>
                    {/* image */}
                    <div className={`${styles.column} ${styles.columnImage}`}>
                        <DescriptionIcon />
                    </div>

                    <div className={`${styles.column} ${styles.columnWidth}`}>
                        {resourceLoading ? (
                            <DsFlashingDotsLoader />
                        ) : (
                            <DsTypography
                                variant="Semibold_14"
                                className={styles.titleText}
                                style={{ paddingRight: '8px' }}
                                title={`${selectedHostname} \\ ${selectedDatabaseInstanceName}`}
                            >
                                {`${selectedHostname} \\ ${selectedDatabaseInstanceName}`}
                            </DsTypography>
                        )}
                        <DsTypography variant="Regular_14" className={styles.label} title={GENERAL.INSTANCE_NAME}>
                            {t('databases.oracle-inner-page.database-name')}
                        </DsTypography>
                    </div>

                    {/* section 2 */}
                    <div className={`${styles.column}`}>
                        <DsTypography variant="Semibold_14" className={styles.titleText}>
                            {resourceLoading ? (
                                <DsFlashingDotsLoader />
                            ) : (
                                <>
                                    <span className={styles.svgSection}>
                                        {resourceDetails.status === 'Up' ? <Success /> : <Failure />}
                                    </span>
                                    <span className={styles.valueSection} title={resourceDetails.status}>
                                        {mapResourceDetailsStatus(resourceDetails.status)}
                                    </span>
                                </>
                            )}
                        </DsTypography>

                        <DsTypography variant="Regular_14" className={styles.label}>
                            {GENERAL.STATUS}
                        </DsTypography>
                    </div>

                    <div className={`${styles.column}`}>
                        <DsTypography
                            variant="Semibold_14"
                            className={styles.titleText}
                            title={formatTenancyValue(resourceDetails?.tenancy)}
                        >
                            {resourceLoading ? <DsFlashingDotsLoader /> : formatTenancyValue(resourceDetails?.tenancy)}
                        </DsTypography>

                        <DsTypography variant="Regular_14" className={styles.label}>
                            {t('databases.oracle-inner-page.tenancy')}
                        </DsTypography>
                    </div>

                    {/* section 3 */}
                    <div className={`${styles.column}`}>
                        <DsTypography variant="Semibold_14" className={styles.titleText} title={oracleDeploymentType}>
                            {resourceLoading ? <DsFlashingDotsLoader /> : oracleDeploymentType}
                        </DsTypography>

                        <DsTypography
                            variant="Regular_14"
                            className={styles.label}
                            title={GENERAL.RESOURCE_DEPLOYMENT_MODEL}
                        >
                            {t('databases.oracle-inner-page.deployment-type')}
                        </DsTypography>
                    </div>

                    {/* section 4 */}
                    {resourceDetails?.tenancy !== TENANCY.SINGLE_TENANT && (
                        <div className={`${styles.column}`} style={{ borderRight: 'none' }}>
                            <DsTypography variant="Semibold_14" className={styles.titleText}>
                                {resourceLoading ? (
                                    <DsFlashingDotsLoader />
                                ) : (
                                    resourceDetails?.databases?.filter(
                                        (db: any) => db.type === WELL_ARCHITECTED_TABS.PDB
                                    )?.length || 0
                                )}
                            </DsTypography>

                            <DsTypography
                                variant="Regular_14"
                                className={styles.label}
                                title={t('databases.oracle-inner-page.number-of-pdbs')}
                            >
                                {t('databases.oracle-inner-page.number-of-pdbs')}
                            </DsTypography>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ResourceHeader;
