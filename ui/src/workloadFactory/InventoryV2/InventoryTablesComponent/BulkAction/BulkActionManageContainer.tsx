import { DsButton, DsTypography } from '@netapp/design-system';
import styles from './BulkActionManageContainer.module.scss';

type BulkActionContainerProps = {
    onClick: () => void;
};

const BulkActionManageContainer = ({ onClick }: BulkActionContainerProps) => {
    return (
        <div className={styles.bulkContainer}>
            <DsTypography variant="Semibold_14">Bulk actions:</DsTypography>
            <DsButton type="text" onClick={onClick}>
                Manage
            </DsButton>
        </div>
    );
};

export default BulkActionManageContainer;
