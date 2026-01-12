import { TooltipInfo, DsTypography } from '@netapp/design-system';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as SingleAuth } from '../../../../../../assets/SingleAuth.svg';
import styles from './FsxAuthenticatedScreen.module.scss';
import { useAppSelector } from '../../../../../../store/storeHooks';
import { getAllFsxFromStorage } from '../AuthenticateFsxUtils';

const FsxAuthenticatedScreen = () => {
    const { t } = useTranslation();
    const { manageSingleInstanceData } = useAppSelector(state => state.inventoryV2);

    const fsxList = useMemo(
        () => getAllFsxFromStorage(manageSingleInstanceData?.storage),
        [manageSingleInstanceData?.storage]
    );

    const fsxCount = fsxList.length;

    const tooltipContent = (
        <div className={styles.tooltipContent}>
            {fsxList.map((fsx: { fsxId: string; fsxName: string }, index: number) => (
                <div
                    key={fsx.fsxId}
                    className={`${styles.tooltipRow} ${
                        index !== fsxList.length - 1 ? styles.tooltipRowWithBorder : ''
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
                    <TooltipInfo trigger="hover" placement="bottom">
                        {tooltipContent}
                    </TooltipInfo>
                    <DsTypography variant="Regular_14">
                        {fsxCount} {t('databases.register-flow.fsx-for-ontap-count')}
                    </DsTypography>
                </div>
            </div>
        </div>
    );
};

export default FsxAuthenticatedScreen;
