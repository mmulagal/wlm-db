import { DsButton, DsTypography } from '@netapp/design-system';
import styles from './BulkActionContainer.module.scss';

type BulkActionContainerProps = {
    action: string;
    onClick: () => void;
};

const BulkActionContainer = ({ action, onClick }: BulkActionContainerProps) => {
    return (
        <div className={styles.bulkContainer}>
            <DsTypography variant="Semibold_14">Bulk actions:</DsTypography>
            <DsButton type="text" onClick={onClick}>
                {action}
            </DsButton>
        </div>
    );
};

export default BulkActionContainer;
