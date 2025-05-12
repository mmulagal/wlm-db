import { DsFlashingDotsLoader, DsTypography } from '@netapp/design-system';
import { ReactComponent as DescriptionIcon } from '../../../../../assets/Description Icons.svg';
import { ReactComponent as Success } from '../../../../../assets/success.svg';
import { ReactComponent as Failure } from '../../../../../assets/error-icon.svg';
import styles from './ResourceHeader.module.scss';
import { useAppSelector } from '../../../../../store/storeHooks';
import { GENERAL } from '../../../../../utils/appConstants';

const ResourceHeader = () => {
    const { resourceLoading, resourceDetails, selectedHostname, selectedDatabaseInstanceName } = useAppSelector(
        state => state.workloadFactoryResource
    );

    return (
        <>
            <div className={styles.cardHeader}>
                <div className={styles.cardContent}>
                    {/* image*/}
                    <div className={`${styles.column} ${styles.columnImage}`}>
                        <DescriptionIcon />
                    </div>

                    <div className={`${styles.column}`}>
                        {resourceLoading ? (
                            <DsFlashingDotsLoader />
                        ) : (
                            <DsTypography
                                variant="Semibold_14"
                                className={styles.titleText}
                                title={selectedHostname + ' \\ ' + selectedDatabaseInstanceName}
                            >
                                {selectedHostname + ' \\ ' + selectedDatabaseInstanceName}
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
                                        {resourceDetails.status}
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
            </div>
        </>
    );
};

export default ResourceHeader;
