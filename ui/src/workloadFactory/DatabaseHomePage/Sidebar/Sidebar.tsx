import { Button, Typography } from '@netapp/design-system';
import { ReactComponent as Favorite } from '../../../assets/favorite service.svg';
import styles from './Sidebar.module.scss';

const Sidebar = ({ isOpen, onClose }: any) => {
    const jsonObject = {
        database_name: 'your_database_name',
        deployment_script: 'your_deployment_script_content',
        environment: 'staging',
        backup_before_deployment: true
    };
    const jsonObj2 = {
        status: 'success',
        message: 'Database deployment successful',
        deployment_id: 'your_deployment_id'
    };
    return (
        <div className={`${styles.sidebar} ${isOpen ? styles.open : ''}`}>
            <div className={styles.topBar}>
                <Typography variant="Regular_16" className={styles.color}>
                    Automations
                </Typography>
                <Typography variant="Regular_16" className={styles.color} onClick={onClose}>
                    {!isOpen ? 'Expand' : 'Collapse'}
                </Typography>
            </div>

            {/* Second level starts here */}
            <div className={styles.secondLevelContainer}>
                <Typography variant="Regular_16" className={styles.color}>
                    Top 5 automations
                </Typography>
                <div className={styles.automationStyle}>
                    <div className={`${styles.tile} ${styles.firstChild}`}>
                        <Favorite />
                        <Typography variant="Regular_14" className={styles.color}>
                            Deployment of SQL DB in region east-us
                        </Typography>
                    </div>

                    <div className={styles.tile}>
                        <Favorite />
                        <Typography variant="Regular_14" className={styles.color}>
                            Migrate Single instance SQL DB from EBS to FSxN for ONTAP
                        </Typography>
                    </div>

                    <div className={styles.tile}>
                        <Favorite />
                        <Typography variant="Regular_14" className={styles.color}>
                            Enable local snapshots protection for SQL DB
                        </Typography>
                    </div>

                    <div className={styles.tile}>
                        <Favorite />
                        <Typography variant="Regular_14" className={styles.color}>
                            Optimize storage and host configuration
                        </Typography>
                    </div>

                    <div className={styles.tile}>
                        <Favorite />
                        <Typography variant="Regular_14" className={styles.color}>
                            Deployment of SQL DB in region east-us
                        </Typography>
                    </div>
                </div>
            </div>
            {/* Second level ends here */}

            {/* Third level starts here */}
            <div className={styles.thirdLevelContainer}>
                <div className={styles.containerBar}>
                    <Typography variant="Semibold_14" className={styles.color}>
                        Deployment of SQL DB in region east-us
                    </Typography>
                </div>
                <div className={styles.jsonBar}>
                    <Typography variant="Regular_14" className={styles.color}>
                        <pre>{JSON.stringify(jsonObject, null, 2)}</pre>
                    </Typography>

                    <Typography variant="Regular_14" className={styles.color} style={{ paddingTop: '8px' }}>
                        <pre>{JSON.stringify(jsonObj2, null, 2)}</pre>
                    </Typography>
                </div>
            </div>
            {/* Third level ends here */}

            <div className={styles.footerContainer}>
                <div />
                <div className={styles.buttonDesign}>
                    <Button onClick={function noRefCheck() {}} variant="primary">
                        Create new script
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default Sidebar;
