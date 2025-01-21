import { DsFlashingDotsLoader, DsTypography } from '@netapp/design-system';
import styles from './RenderTables.module.scss';
import { GENERAL } from '../../../../utils/appConstants';
import { INVENTORY_STATUS } from '../../../../utils/consts';

const FirstColumnComponent = ({ rowData }: any) => {
    return (
        <div className={styles.renderTable}>
            <DsTypography variant="Semibold_14">{rowData?.serverInstanceName || GENERAL.NOT_AVAILABLE}</DsTypography>
            {rowData?.loadingStatus && <DsFlashingDotsLoader />}
            {!rowData?.loadingStatus && (
                <div className={styles.statusContainer}>
                    {(rowData?.status === INVENTORY_STATUS.RUNNING ||
                        rowData?.status === INVENTORY_STATUS.CASE_SENSITIVE_UP) && (
                        <div className={`${styles.statusIcon} ${styles['circle']} ${styles['online']}`}></div>
                    )}
                    {(rowData?.status === INVENTORY_STATUS.STOPPED ||
                        rowData?.status === INVENTORY_STATUS.CASE_SENSITIVE_DOWN) && (
                        <div className={`${styles.statusIcon} ${styles['circle']} ${styles['offline']}`}></div>
                    )}
                    {rowData?.status === INVENTORY_STATUS.UNKNOWN && (
                        <div className={`${styles.statusIcon} ${styles['circle']} ${styles['unknown']}`}></div>
                    )}
                    <DsTypography variant="Regular_13">
                        {rowData?.status === INVENTORY_STATUS.RUNNING ||
                        rowData?.status === INVENTORY_STATUS.CASE_SENSITIVE_UP
                            ? INVENTORY_STATUS.ONLINE
                            : rowData?.status === INVENTORY_STATUS.STOPPED ||
                              rowData?.status === INVENTORY_STATUS.CASE_SENSITIVE_DOWN
                            ? INVENTORY_STATUS.OFFLINE
                            : rowData?.status}
                        {!rowData?.status && rowData?.loading && <DsFlashingDotsLoader />}
                        {!rowData?.status && !rowData?.loading && 'Unknown'}
                    </DsTypography>
                </div>
            )}
        </div>
    );
};

export default FirstColumnComponent;
