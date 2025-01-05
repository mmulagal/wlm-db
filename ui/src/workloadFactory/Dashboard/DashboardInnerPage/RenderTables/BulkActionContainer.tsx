import { DsButton, DsTypography } from '@netapp/design-system';
import styles from './BulkActionContainer.module.scss';

type BulkActionContainerProps = {
    onClick: () => void;
};

const BulkActionContainer = ({ onClick }: BulkActionContainerProps) => {
    return (
        <div className={styles.bulkContainer}>
            <DsTypography variant="Semibold_14">Bulk actions:</DsTypography>
            <DsButton type="text" onClick={onClick}>
                Optimize
            </DsButton>
        </div>
    );
};

export default BulkActionContainer;
