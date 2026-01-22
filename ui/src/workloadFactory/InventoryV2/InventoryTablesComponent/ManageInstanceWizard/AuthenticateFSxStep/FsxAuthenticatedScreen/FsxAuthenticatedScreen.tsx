import { Popover, DsTypography } from '@netapp/design-system';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as InfoIcon } from '@netapp/icons/ic_info_tooltip.svg';
import { ReactComponent as SingleAuth } from '../../../../../../assets/SingleAuth.svg';
import styles from './FsxAuthenticatedScreen.module.scss';
import CommonStyles from '../../../../../../utils/CommonStyles.module.scss';
import { useAppSelector } from '../../../../../../store/storeHooks';
import { getAllFsxFromStorage, getAllFsxFromBulkStorage } from '../AuthenticateFsxUtils';
import { ACTION_TYPE } from '../../../../../../utils/consts';

const FsxAuthenticatedScreen = () => {
    const { t } = useTranslation();
    const { manageSingleInstanceData, wizardOperationType, selectedMultiDetectInstances } = useAppSelector(
        state => state.inventoryV2
    );

    const isBulkMode = wizardOperationType === ACTION_TYPE.BULK;

    const fsxList = useMemo(() => {
        if (isBulkMode) {
            return getAllFsxFromBulkStorage(selectedMultiDetectInstances);
        }
        return getAllFsxFromStorage(manageSingleInstanceData?.storage);
    }, [isBulkMode, manageSingleInstanceData?.storage, selectedMultiDetectInstances]);

    const fsxCount = fsxList.length;

    const tooltipContent = (
        <div className={CommonStyles.tooltipContent}>
            {fsxList.map((fsx: { fsxId: string; fsxName: string }, index: number) => (
                <div
                    key={fsx.fsxId}
                    className={`${CommonStyles.tooltipRow} ${
                        index !== fsxList.length - 1 ? CommonStyles.tooltipRowWithBorder : ''
                    }`}
                >
                    <DsTypography variant="Semibold_14">{fsx.fsxName}</DsTypography>
                </div>
            ))}
        </div>
    );

    return (
        <div className={styles['fsx-authenticated-screen']}>
            <SingleAuth />
            <div className={styles.textContainer}>
                <DsTypography variant="Semibold_14">
                    {t('databases.register-flow.fsx-authenticated-message')}
                </DsTypography>
                <div className={styles.fsxInfo}>
                    <Popover
                        popoverClass={CommonStyles.scrollablePopover}
                        trigger="hover"
                        placement="bottom"
                        delayHide={200}
                        interactive
                        isAppendedToBody
                        container={<InfoIcon className={CommonStyles.infoIcon} />}
                    >
                        {tooltipContent}
                    </Popover>
                    <DsTypography variant="Regular_14">
                        {fsxCount} {t('databases.register-flow.fsx-for-ontap-count')}
                    </DsTypography>
                </div>
            </div>
        </div>
    );
};

export default FsxAuthenticatedScreen;
