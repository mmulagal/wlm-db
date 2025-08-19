import { DsFlashingDotsLoader, DsTypography } from '@netapp/design-system';
import { useTranslation } from 'react-i18next';
import { ReactComponent as DescriptionIcon } from '../../../../../assets/Description Icons.svg';
import { ReactComponent as Success } from '../../../../../assets/success.svg';
import { ReactComponent as Failure } from '../../../../../assets/error-icon.svg';
import styles from './ResourceHeader.module.scss';

import { GENERAL } from '../../../../../utils/appConstants';
import { DBType, INVENTORY_STATUS } from '../../../../../utils/consts';

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
                        <DsTypography
                            variant="Semibold_14"
                            className={styles.titleText}
                            title={resourceDetails?.topology?.serverInstallationMode}
                        >
                            {resourceLoading ? (
                                <DsFlashingDotsLoader />
                            ) : (
                                resourceDetails?.topology?.serverInstallationMode
                            )}
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
                            title={resourceDetails?.topology?.serverInstallationMode}
                        >
                            {resourceLoading ? (
                                <DsFlashingDotsLoader />
                            ) : (
                                resourceDetails?.topology?.serverInstallationMode
                            )}
                        </DsTypography>

                        <DsTypography
                            variant="Regular_14"
                            className={styles.label}
                            title={GENERAL.RESOURCE_DEPLOYMENT_MODEL}
                        >
                            {t('databases.oracle-inner-page.tenancy')}
                        </DsTypography>
                    </div>

                    {/* section 3 */}
                    <div className={`${styles.column}`}>
                        <DsTypography
                            variant="Semibold_14"
                            className={styles.titleText}
                            title={resourceDetails?.topology?.serverInstallationMode}
                        >
                            {resourceLoading ? (
                                <DsFlashingDotsLoader />
                            ) : (
                                resourceDetails?.topology?.serverInstallationMode
                            )}
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
                    <div className={`${styles.column}`} style={{ borderRight: 'none' }}>
                        <DsTypography variant="Semibold_14" className={styles.titleText}>
                            {resourceLoading ? <DsFlashingDotsLoader /> : resourceDetails.databaseCount}
                        </DsTypography>

                        <DsTypography variant="Regular_14" className={styles.label} title={GENERAL.NO_OF_DBS}>
                            {t('databases.oracle-inner-page.number-of-pdbs')}
                        </DsTypography>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ResourceHeader;
