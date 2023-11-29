import { Typography } from '@netapp/design-system';
import styles from './InformationSection.module.scss';
import { GENERAL } from '../../../utils/appConstants';

const InformationSection = () => {
    return (
        <div className={styles.informationSection}>
            <div className={styles.headSection}>
                <Typography variant="Regular_16" className={styles.title}>
                    {GENERAL.DB_OVERVIEW_INFO}
                </Typography>
            </div>
        </div>
    );
};

export default InformationSection;
