import { DsButton, DsTypography } from '@netapp/design-system';
import styles from './BulkActionContainer.module.scss';
import SeparatorComponent from '../SeparatorComponent/SeparatorComponent';

type BulkActionContainerProps = {
    onClick: any;
    rowData: any;
};

const BulkDismissContainer = ({ onClick, rowData }: BulkActionContainerProps) => {
    const buttonContainer = () => {
        const checkForOnlyPostponed = rowData.length > 0 && rowData.every((item: any) => item.includes('Postponed'));
        const hasDismissed = rowData.length > 0 && rowData.includes('Dismissed');
        const hasPostponed = rowData.length > 0 && rowData.some((item: any) => item.includes('Postponed'));
        const hasDismissedAndPostponed = hasDismissed && hasPostponed;
        const isOnlyActiveOrDismissed =
            rowData.length > 0 && rowData.every((item: any) => item === 'Active' || item === 'Dismissed');
        const hasActive = rowData.length > 0 && rowData.includes('Active');
        const hasDismissedAndActive = isOnlyActiveOrDismissed && hasActive && hasDismissed;

        if (checkForOnlyPostponed) {
            return (
                <div className={styles.bulkButtonContainer}>
                    <DsButton type="text" onClick={() => onClick('postponed')}>
                        {'Postponed for 30 days'}
                    </DsButton>
                    <SeparatorComponent variant="vertical" height="16px" />
                    <DsButton type="text" onClick={() => onClick('dismiss')}>
                        {'Dismiss'}
                    </DsButton>
                </div>
            );
        } else if (hasDismissedAndPostponed) {
            return (
                <div className={styles.bulkButtonContainer}>
                    <DsButton type="text" onClick={() => onClick('activate')}>
                        {'Activate'}
                    </DsButton>
                </div>
            );
        } else if (hasDismissedAndActive) {
            return (
                <div className={styles.bulkButtonContainer}>
                    <DsButton type="text" onClick={() => onClick('postponed')}>
                        {'Postponed for 30 days'}
                    </DsButton>
                </div>
            );
        }
    };
    return (
        <div className={styles.bulkContainer}>
            <DsTypography variant="Semibold_14">Bulk actions:</DsTypography>
            {buttonContainer()}
        </div>
    );
};

export default BulkDismissContainer;
