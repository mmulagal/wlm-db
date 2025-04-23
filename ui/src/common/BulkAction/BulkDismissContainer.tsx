import { DsButton, DsTypography } from '@netapp/design-system';
import styles from './BulkActionContainer.module.scss';
import SeparatorComponent from '../SeparatorComponent/SeparatorComponent';
import { CONFIG_STATES, CONFIG_STATE_ACTIONS } from '../../utils/consts';

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

        const hasSomeDismissed = rowData.length > 0 && rowData.some((item: any) => item === CONFIG_STATES.DISMISSED);

        const hasSomeActive = rowData.length > 0 && rowData.some((item: any) => item === CONFIG_STATES.ACTIVE);

        const hasSomePostponed = rowData.length > 0 && rowData.some((item: any) => item === CONFIG_STATES.POSTPONED);

        return (
            <div className={styles.bulkButtonContainer}>
                <DsButton
                    type="text"
                    onClick={() => onClick(CONFIG_STATE_ACTIONS.ACTIVE, hasSomeActive)}
                    isDisabled={checkForOnlyActive}
                >
                    {'Reactivate'}
                </DsButton>
                <SeparatorComponent variant="vertical" height="16px" />
                <DsButton
                    type="text"
                    onClick={() => onClick(CONFIG_STATE_ACTIONS.POSTPONED, hasSomePostponed)}
                    isDisabled={checkForOnlyPostponed}
                >
                    {'Postponed for 30 days'}
                </DsButton>
                <SeparatorComponent variant="vertical" height="16px" />
                <DsButton
                    type="text"
                    onClick={() => onClick(CONFIG_STATE_ACTIONS.DISMISS, hasSomeDismissed)}
                    isDisabled={checkForOnlyDismissed}
                >
                    {'Dismiss'}
                </DsButton>
            </div>
        );
    };
    return (
        <div className={styles.bulkContainer}>
            <DsTypography variant="Semibold_14">Bulk actions:</DsTypography>
            {buttonContainer()}
        </div>
    );
};

export default BulkDismissContainer;
