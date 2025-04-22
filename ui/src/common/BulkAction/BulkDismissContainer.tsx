import { DsButton, DsTypography } from '@netapp/design-system';
import styles from './BulkActionContainer.module.scss';
import SeparatorComponent from '../SeparatorComponent/SeparatorComponent';
import { CONFIG_STATES } from '../../utils/consts';

type BulkActionContainerProps = {
    onClick: any;
    rowData: any;
};

const BulkDismissContainer = ({ onClick, rowData }: BulkActionContainerProps) => {
    const buttonContainer = () => {
        const checkForOnlyPostponed =
            rowData.length > 0 && rowData.every((item: any) => item === CONFIG_STATES.POSTPONED);
        const checkForOnlyActive = rowData.length > 0 && rowData.every((item: any) => item === CONFIG_STATES.ACTIVE);
        const checkForOnlyDismissed =
            rowData.length > 0 && rowData.every((item: any) => item === CONFIG_STATES.DISMISSED);

        const hasDismissedAndPostponed =
            rowData.length > 0 &&
            rowData.some((item: any) => item === CONFIG_STATES.POSTPONED) &&
            rowData.some((item: any) => item === CONFIG_STATES.DISMISSED);

        const hasDismissedAndActive =
            rowData.length > 0 &&
            rowData.some((item: any) => item === CONFIG_STATES.ACTIVE) &&
            rowData.some((item: any) => item === CONFIG_STATES.DISMISSED);

        const hasActiveAndPostponed =
            rowData.length > 0 &&
            rowData.some((item: any) => item === CONFIG_STATES.ACTIVE) &&
            rowData.some((item: any) => item === CONFIG_STATES.POSTPONED);

        const hasActiveAndDismissAndPostponed =
            rowData.length > 0 &&
            rowData.some((item: any) => item === CONFIG_STATES.ACTIVE) &&
            rowData.some((item: any) => item === CONFIG_STATES.POSTPONED) &&
            rowData.some((item: any) => item === CONFIG_STATES.DISMISSED);

        if (hasActiveAndDismissAndPostponed) {
            return (
                <div className={styles.bulkButtonContainer}>
                    <DsTypography variant="Regular_14" className={styles.actionText}>
                        {'No common action available'}
                    </DsTypography>
                </div>
            );
        } else if (checkForOnlyPostponed) {
            return (
                <div className={styles.bulkButtonContainer}>
                    <DsButton type="text" onClick={() => onClick('activate')}>
                        {'Activate'}
                    </DsButton>
                    <SeparatorComponent variant="vertical" height="16px" />
                    <DsButton type="text" onClick={() => onClick('dismiss')}>
                        {'Dismiss'}
                    </DsButton>
                </div>
            );
        } else if (checkForOnlyActive) {
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
        } else if (checkForOnlyDismissed) {
            return (
                <div className={styles.bulkButtonContainer}>
                    <DsButton type="text" onClick={() => onClick('activate')}>
                        {'Activate'}
                    </DsButton>
                    <SeparatorComponent variant="vertical" height="16px" />
                    <DsButton type="text" onClick={() => onClick('postponed')}>
                        {'Postponed for 30 days'}
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
        } else if (hasActiveAndPostponed) {
            return (
                <div className={styles.bulkButtonContainer}>
                    <DsButton type="text" onClick={() => onClick('dismiss')}>
                        {'Dismiss'}
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
