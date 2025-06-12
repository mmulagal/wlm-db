import { DsTypography } from '@netapp/design-system';
import { ReactComponent as DatabaseManagement } from '../../../assets/Database management.svg';
import { ReactComponent as DatabaseOperation } from '../../../assets/Database optimization.svg';
import styles from './InventoryCards.module.scss';
import { GENERAL } from '../../../utils/appConstants';

const InventoryCards = () => (
    <div className={styles['inventory-cards']}>
        <div className={styles['inventory-card']}>
            <DatabaseManagement />
            <div className={styles.contentArea}>
                <DsTypography variant="Semibold_16">{GENERAL.DATABASE_MANAGEMENT}</DsTypography>
                <div className={styles.textSection}>
                    <DsTypography variant="Regular_14">{GENERAL.INVENTORY_CARD_TEXT1}</DsTypography>
                    <DsTypography variant="Regular_14">{GENERAL.INVENTORY_CARD_TEXT2}</DsTypography>
                </div>
            </div>
        </div>
        <div className={styles['inventory-card']}>
            <DatabaseOperation />
            <div className={styles.contentArea}>
                <DsTypography variant="Semibold_16">{GENERAL.DATABASE_OPTIMIZATION}</DsTypography>
                <DsTypography variant="Regular_14">{GENERAL.INVENTORY_CARD_TEXT3}</DsTypography>
            </div>
        </div>
    </div>
);

export default InventoryCards;
