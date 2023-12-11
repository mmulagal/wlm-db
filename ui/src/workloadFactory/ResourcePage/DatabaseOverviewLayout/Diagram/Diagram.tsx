import { FlashingDotsLoader, Typography } from '@netapp/design-system';
import { ReactComponent as Diagram2 } from '../../../../assets/Diagram2.svg';
import { ReactComponent as Diagram4 } from '../../../../assets/Diagram4.svg';
import styles from './Diagram.module.scss';
import { useAppSelector } from '../../../../store/storeHooks';

const Diagram = () => {
    const { resourceLoading, resourceDetails } = useAppSelector(state => state.workloadFactoryResource);
    return (
        <div className={resourceLoading ? `${styles.diagram} ${styles.hideDiagram}` : `${styles.diagram}`}>
            <div className={styles.headSection}>
                <Typography variant="Regular_16" className={styles.title}>
                    Diagram
                </Typography>
                {resourceLoading && <FlashingDotsLoader />}
            </div>

            {!resourceLoading && (
                <div className={styles.centerContainer}>
                    {resourceDetails?.topology?.serverInstallationMode === 'FCI' && <Diagram2 />}
                    {resourceDetails?.topology?.serverInstallationMode === 'STANDALONE' && <Diagram4 />}
                </div>
            )}
        </div>
    );
};

export default Diagram;
