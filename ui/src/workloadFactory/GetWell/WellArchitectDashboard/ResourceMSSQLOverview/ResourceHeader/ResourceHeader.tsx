import { FlashingDotsLoader, Typography } from '@netapp/design-system';
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
        <div className={styles.dbHostTile}>
            <div className={styles.dbHostSection}>
                <DescriptionIcon />
                <div className={styles.secondLevel}>
                    {resourceLoading ? (
                        <FlashingDotsLoader className={styles.loaderHeight} />
                    ) : (
                        <Typography
                            variant="Semibold_14"
                            className={styles.textManage}
                            title={selectedHostname + ' \\ ' + selectedDatabaseInstanceName}
                        >
                            {selectedHostname + ' \\ ' + selectedDatabaseInstanceName}
                        </Typography>
                    )}

                    <Typography variant="Regular_14">{GENERAL.INSTANCE_NAME}</Typography>
                </div>
            </div>

            <div className={styles.dbHostSeparator} />

            <div className={styles.statusSection}>
                {resourceLoading ? (
                    <FlashingDotsLoader className={styles.loaderHeight} />
                ) : (
                    <div className={styles.firstSection}>
                        {resourceDetails.status === 'Up' ? <Success /> : <Failure />}
                        <Typography variant="Semibold_14" className={styles.textManage} title={resourceDetails.status}>
                            {resourceDetails.status}
                        </Typography>
                    </div>
                )}
                <Typography variant="Regular_14">{GENERAL.STATUS}</Typography>
            </div>

            <div className={styles.dbHostSeparator} />

            <div className={styles.commonSection}>
                <div className={styles.commonSectionLevel}>
                    {resourceLoading ? (
                        <FlashingDotsLoader className={styles.loaderHeight} />
                    ) : (
                        <Typography
                            variant="Semibold_14"
                            className={styles.textManage}
                            title={resourceDetails?.topology?.serverInstallationMode}
                        >
                            {resourceDetails?.topology?.serverInstallationMode}
                        </Typography>
                    )}
                </div>

                <Typography variant="Regular_14">{GENERAL.RESOURCE_DEPLOYMENT_MODEL}</Typography>
            </div>

            <div className={styles.dbHostSeparator} />

            <div className={styles.commonSection}>
                <div className={styles.commonSectionLevel}>
                    {resourceLoading ? (
                        <FlashingDotsLoader className={styles.loaderHeight} />
                    ) : (
                        <Typography variant="Semibold_14" className={styles.textManage}>
                            {resourceDetails.databaseCount}
                        </Typography>
                    )}
                </div>
                <Typography variant="Regular_14">{GENERAL.NO_OF_DBS}</Typography>
            </div>
        </div>
    );
};

export default ResourceHeader;
