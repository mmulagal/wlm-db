import { DsTypography } from '@netapp/design-system';
import { ReactComponent as DatabaseManagement } from '../../../assets/Database management.svg';
import { ReactComponent as DatabaseOperation } from '../../../assets/Database optimization.svg';
import styles from './InventoryCards.module.scss';

const InventoryCards = () => {
    return (
        <div className={styles['inventory-cards']}>
            <div className={styles['inventory-card']}>
                <DatabaseManagement />
                <div className={styles.contentArea}>
                    <DsTypography variant="Semibold_16">Database management</DsTypography>
                    <DsTypography variant="Regular_14">
                        Manage database resources and perform day-to-day operations with FSx for ONTAP. You can check
                        the status of hosts, instances, and databases, deploy new resources, and stay on top of resource
                        usage, data protection, and performance. Plus, get optimization recommendations to make sure
                        your database resources are well-architected.
                    </DsTypography>
                </div>
            </div>
            <div className={styles['inventory-card']}>
                <DatabaseOperation />
                <div className={styles.contentArea}>
                    <DsTypography variant="Semibold_16">Database optimization</DsTypography>
                    <DsTypography variant="Regular_14">
                        Automatically assess and mitigate issues in database infrastructure to keep your databases
                        running smoothly and cost-effectively. Continuously scan deployments to get insights and
                        recommendations to make sure everything aligns with vendor and industry best practices.
                    </DsTypography>
                </div>
            </div>
        </div>
    );
};

export default InventoryCards;
