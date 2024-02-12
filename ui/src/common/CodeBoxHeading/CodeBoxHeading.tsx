import { Typography } from '@netapp/design-system';
import { ReactComponent as VectorIcon } from '../../assets/vector-icon.svg';
import styles from './CodeBoxHeading.module.scss';
import { CODE_VIEWER } from '../../utils/appConstants';

const CodeBoxHeading = () => {
    return (
        <div className={styles.topBar}>
            <div className={styles.title}>
                <VectorIcon />
                <Typography variant="Regular_16" className={styles.colorAutomation}>
                    {CODE_VIEWER.CODEBOX}
                </Typography>
            </div>
        </div>
    );
};

export default CodeBoxHeading;
