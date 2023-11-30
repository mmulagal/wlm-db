import { FlashingDotsLoader, Typography } from '@netapp/design-system';
import { ReactComponent as Diagram1 } from '../../../../assets/Diagram1.svg';
import { ReactComponent as Diagram2 } from '../../../../assets/Diagram2.svg';
import { ReactComponent as Diagram4 } from '../../../../assets/Diagram4.svg';
import styles from './Diagram.module.scss';

const Diagram = () => {
    const loading: boolean = false;
    return (
        <div className={loading ? `${styles.diagram} ${styles.hideDiagram}` : `${styles.diagram}`}>
            <div className={styles.headSection}>
                <Typography variant="Regular_16" className={styles.title}>
                    Diagram
                </Typography>
                {loading && <FlashingDotsLoader />}
            </div>

            {!loading && (
                <div className={styles.centerContainer}>
                    <Diagram4 />
                </div>
            )}
        </div>
    );
};

export default Diagram;
