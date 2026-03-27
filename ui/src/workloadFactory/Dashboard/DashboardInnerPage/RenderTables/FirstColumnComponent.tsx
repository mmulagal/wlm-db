import { DsFlashingDotsLoader, DsTypography } from '@netapp/design-system';
import styles from './RenderTables.module.scss';
import { GENERAL } from '../../../../utils/appConstants';
import InventoryStatusIndicator from '../../../../common/InventoryStatusIndicator/InventoryStatusIndicator';

const FirstColumnComponent = ({ rowData, showDismissed = false }: any) => (
    <div className={styles.renderTable}>
        <DsTypography variant="Semibold_14" className={showDismissed ? styles.disabled : ''}>
            {rowData?.serverInstanceName || GENERAL.NOT_AVAILABLE}
        </DsTypography>
        {rowData?.loadingStatus && <DsFlashingDotsLoader />}
        {!rowData?.loadingStatus && !rowData?.isWad && (
            <div className={styles.statusContainer}>
                <InventoryStatusIndicator
                    status={rowData?.status}
                    loading={rowData?.loading}
                    typographyClassName={showDismissed ? styles.disabled : ''}
                />
            </div>
        )}
    </div>
);

export default FirstColumnComponent;
