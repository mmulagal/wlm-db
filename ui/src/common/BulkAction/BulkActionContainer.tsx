import { DsButton, DsTypography } from '@netapp/design-system';
import styles from './BulkActionContainer.module.scss';

type BulkActionContainerProps = {
    action: string;
    onClick: () => void;
};

const BulkActionContainer = ({ action, onClick }: BulkActionContainerProps) => (
    <div className={styles.bulkContainer}>
        <DsTypography variant="Semibold_14">Bulk actions:</DsTypography>
        <DsButton data-testid={`wlm-db-${action}`} type="text" onClick={onClick}>
            {action}
        </DsButton>
    </div>
);

export default BulkActionContainer;
