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
        </div>
    );
};

export default Sidebar;
