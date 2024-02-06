import { FlashingDotsLoader, Typography } from '@netapp/design-system';
import { ReactComponent as Diagram2 } from '../../../../assets/Diagram2.svg';
import { ReactComponent as Diagram4 } from '../../../../assets/Diagram4.svg';
import styles from './Diagram.module.scss';
import { useAppSelector } from '../../../../store/storeHooks';
import { GENERAL } from '../../../../utils/appConstants';

const Diagram = () => {
    const { resourceLoading, resourceDetails } = useAppSelector(state => state.workloadFactoryResource);
    return (
        <div
            className={
                resourceLoading || resourceDetails?.topology?.serverInstallationMode === ''
                    ? `${styles.diagram} ${styles.hideDiagram}`
                    : `${styles.diagram}`
            }
        >
            <div className={styles.headSection}>
                <Typography variant="Regular_16" className={styles.title}>
                    {GENERAL.TOPOLOGY}
                </Typography>
                {resourceLoading && <FlashingDotsLoader />}
                {!resourceLoading && resourceDetails?.topology?.serverInstallationMode === '' && (
                    <Typography variant="Regular_16" className={styles.disabledColor}>
                        {GENERAL.NOT_AVAILABLE}
                    </Typography>
                )}
            </div>

            {!resourceLoading && (
                <div className={styles.centerContainer}>
                    {resourceDetails?.topology?.serverInstallationMode?.toLowerCase() === 'fci' && <Diagram2 />}
                    {resourceDetails?.topology?.serverInstallationMode?.toLowerCase() === 'standalone' && <Diagram4 />}
                </div>
            )}
        </div>
    );
};

export default Diagram;
