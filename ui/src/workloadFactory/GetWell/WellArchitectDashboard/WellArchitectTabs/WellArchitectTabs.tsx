import { useDispatch } from 'react-redux';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DsTypography } from '@netapp/design-system';
import styles from './WellArchitectTabs.module.scss';
import { useAppSelector } from '../../../../store/storeHooks';
import { setSelectedWellArchitectTab } from '../../../../store/workloadFactory/getWellOptimizeSlice';
import { GENERAL } from '../../../../utils/appConstants';
import { WELL_ARCHITECTED_TABS } from '../../../../utils/consts';
import TooltipComponent from '../../../../common/TooltipComponent/TooltipComponent';

const WellArchitectTabs = () => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const [selectedTab, setSelectedTab] = useState<any>();
    const { selectedWellArchitectTab } = useAppSelector(state => state.getWellOptimize);
    const { regionMapping } = useAppSelector(state => state.headers);
    const { selectedGwInstanceRegionId } = useAppSelector(state => state.getWellOptimize);

    const isBedrockSupportedForRegion = useMemo(() => {
        let isBedRockAvailable = true;
        if (
            'bedrockAvailable' in regionMapping?.[selectedGwInstanceRegionId] &&
            !regionMapping?.[selectedGwInstanceRegionId]?.bedrockAvailable
        ) {
            isBedRockAvailable = false;
        }
        return isBedRockAvailable;
    }, [regionMapping, selectedGwInstanceRegionId]);

    useEffect(() => {
        setSelectedTab(selectedWellArchitectTab);
    }, [selectedWellArchitectTab]);

    const handleClick = (value: string) => {
        setSelectedTab(value);
        dispatch(setSelectedWellArchitectTab(value));
    };
    return (
        <div className={styles['well-architect-tabs']}>
            <div
                className={
                    selectedTab === 'Overview'
                        ? `${styles.headers} ${styles.headerWidthFirst} ${styles.active}`
                        : `${styles.headers} ${styles.headerWidthFirst}`
                }
            >
                <DsTypography
                    variant="Semibold_14"
                    className={
                        selectedTab === 'Overview'
                            ? `${styles.headerPart1} ${styles.activeText}`
                            : `${styles.headerPart1}`
                    }
                    onClick={() => handleClick('Overview')}
                >
                    {GENERAL.OVERVIEW}
                </DsTypography>
            </div>
            <div
                className={
                    selectedTab === 'Well-architected status'
                        ? `${styles.headers} ${styles.headerWidthSecond} ${styles.active}`
                        : `${styles.headers} ${styles.headerWidthSecond}`
                }
            >
                <DsTypography
                    variant="Semibold_14"
                    className={
                        selectedTab === 'Well-architected status'
                            ? `${styles.headerPart1} ${styles.activeText}`
                            : `${styles.headerPart1}`
                    }
                    onClick={() => handleClick('Well-architected status')}
                >
                    {GENERAL.WELL_ARCHITECTED_STATUS}
                </DsTypography>
            </div>

            {!isBedrockSupportedForRegion && (
                <TooltipComponent
                    placement="bottom"
                    title={t('databases.log-analyzer.bedrock-in-region-not-supported')}
                    width={300}
                >
                    <div className={`${styles.headers} ${styles.headerWidthSecond}`}>
                        <DsTypography variant="Semibold_14" className={styles.headerDisabled}>
                            {t('databases.log-analyzer.error-investigation')}
                        </DsTypography>
                        <DsTypography variant="Semibold_13" className={`${styles.tag} ${styles.tagDisable}`}>
                            {t('databases.log-analyzer.ai-tag')}
                        </DsTypography>
                    </div>
                </TooltipComponent>
            )}
            {isBedrockSupportedForRegion && (
                <div
                    className={
                        selectedTab === WELL_ARCHITECTED_TABS.ERROR_INVESTIGATION
                            ? `${styles.headers} ${styles.headerWidthSecond} ${styles.active}`
                            : `${styles.headers} ${styles.headerWidthSecond}`
                    }
                >
                    <DsTypography
                        variant="Semibold_14"
                        className={
                            selectedTab === 'Error investigation'
                                ? `${styles.headerPart1} ${styles.activeText}`
                                : `${styles.headerPart1}`
                        }
                        onClick={() => handleClick('Error investigation')}
                    >
                        {t('databases.log-analyzer.error-investigation')}
                    </DsTypography>
                    <DsTypography variant="Semibold_13" className={styles.tag}>
                        {t('databases.log-analyzer.ai-tag')}
                    </DsTypography>
                </div>
            )}

            <div
                className={
                    selectedTab === 'Databases'
                        ? `${styles.headers} ${styles.headerWidthThird} ${styles.active}`
                        : `${styles.headers} ${styles.headerWidthThird}`
                }
            >
                <DsTypography
                    variant="Semibold_14"
                    className={
                        selectedTab === 'Databases'
                            ? `${styles.headerPart1} ${styles.activeText}`
                            : `${styles.headerPart1}`
                    }
                    onClick={() => handleClick('Databases')}
                >
                    {GENERAL.DATABASES}
                </DsTypography>
            </div>

            <div
                className={
                    selectedTab === 'Sandboxes'
                        ? `${styles.headers} ${styles.headerWidthThird} ${styles.active}`
                        : `${styles.headers} ${styles.headerWidthThird}`
                }
            >
                <DsTypography
                    variant="Semibold_14"
                    className={
                        selectedTab === 'Sandboxes'
                            ? `${styles.headerPart1} ${styles.activeText}`
                            : `${styles.headerPart1}`
                    }
                    onClick={() => handleClick('Sandboxes')}
                >
                    {GENERAL.SANDBOXES}
                </DsTypography>
            </div>
        </div>
    );
};

export default WellArchitectTabs;
