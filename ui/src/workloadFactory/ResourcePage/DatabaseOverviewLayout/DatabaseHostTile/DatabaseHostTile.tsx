import { FlashingDotsLoader, Typography } from '@netapp/design-system';
import { ReactComponent as DescriptionIcon } from '../../../../assets/Description Icons.svg';
import { ReactComponent as Success } from '../../../../assets/success.svg';
import { ReactComponent as Failure } from '../../../../assets/error-icon.svg';
import styles from './DatabaseHostTile.module.scss';
import { useAppSelector } from '../../../../store/storeHooks';
import { GENERAL } from '../../../../utils/appConstants';

const DatabaseHostTile = () => {
    const { resourceLoading, resourceDetails } = useAppSelector(state => state.workloadFactoryResource);
    return (
        <div className={styles.dbHostTile}>
            <div className={styles.dbHostSection}>
                <DescriptionIcon />
                <div className={styles.secondLevel}>
                    {resourceLoading ? (
                        <FlashingDotsLoader className={styles.loaderHeight} />
                    ) : (
                        <Typography variant="Semibold_14">{resourceDetails.name}</Typography>
                    )}

                    <Typography variant="Regular_14">{GENERAL.HOST_NAME}</Typography>
                </div>
            </div>

            <div className={styles.dbHostSeparator} />

            <div className={styles.statusSection}>
                {resourceLoading ? (
                    <FlashingDotsLoader className={styles.loaderHeight} />
                ) : (
                    <div className={styles.firstSection}>
                        {resourceDetails.status === 'Up' ? <Success /> : <Failure />}
                        <Typography variant="Semibold_14">{resourceDetails.status}</Typography>
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
                        <Typography variant="Semibold_14">{resourceDetails.databaseCount}</Typography>
                    )}
                </div>
                <Typography variant="Regular_14">{GENERAL.NO_OF_DBS}</Typography>
            </div>

            <div className={styles.dbHostSeparator} />

            <div className={styles.commonSection}>
                <div className={styles.commonSectionLevel}>
                    {resourceLoading ? (
                        <FlashingDotsLoader className={styles.loaderHeight} />
                    ) : (
                        <Typography variant="Semibold_14">{resourceDetails?.databaseServer?.serverVersion}</Typography>
                    )}
                </div>

                <Typography variant="Regular_14">{GENERAL.SQL_VERSION}</Typography>
            </div>

            <div className={styles.dbHostSeparator} />

            <div className={styles.commonSection}>
                <div className={styles.commonSectionLevel}>
                    {resourceLoading ? (
                        <FlashingDotsLoader className={styles.loaderHeight} />
                    ) : (
                        <Typography variant="Semibold_14">{resourceDetails?.topology?.serverInstallationMode}</Typography>
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
                        <Typography variant="Semibold_14">{resourceDetails?.databaseServer?.serverEdition}</Typography>
                    )}
                </div>

                <Typography variant="Regular_14">{GENERAL.RESOURCE_EDITION}</Typography>
            </div>
        </div>
    );
};

export default DatabaseHostTile;
