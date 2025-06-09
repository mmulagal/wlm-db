import { DsButton, DsTypography } from '@netapp/design-system';
import styles from './BulkActionContainer.module.scss';

type BulkActionContainerProps = {
    action1: string;
    action2?: string;
    onClick: any;
};

const BulkCloneContainer = ({ action1, action2, onClick }: BulkActionContainerProps) => (
    <div className={styles.bulkContainer}>
        <DsTypography variant="Semibold_14">Bulk actions:</DsTypography>
        <DsButton type="text" onClick={() => onClick(action1)}>
            {action1}
        </DsButton>
        {action2 && (
            <DsButton type="text" style={{ marginLeft: '24px' }} onClick={() => onClick(action2)}>
                {action2}
            </DsButton>
        )}
    </div>
);

export default BulkCloneContainer;
