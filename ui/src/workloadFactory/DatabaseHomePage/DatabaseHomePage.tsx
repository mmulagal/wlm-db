import { Typography } from '@netapp/design-system';
import { GENERAL } from '../../utils/appConstants';
import DatabaseActions from './DatabaseActions/DatabaseActions';
import DatabaseAWSIntegration from './DatabaseAWSIntegration/DatabaseAWSIntegration';
import styles from './DatabaseHomePage.module.scss';

const DatabaseHomePage = () => {
    return (
        <div className={styles.databaseHome}>
            <Typography variant="Regular_24" className={styles.heading}>
                {GENERAL.DATABASES}
            </Typography>
            <div className={styles.secondLevelContainer}>
                <DatabaseActions />
                <DatabaseAWSIntegration />
            </div>
            <div className={styles.thirdLevelContainer}></div>
        </div>
    );
};

export default DatabaseHomePage;
