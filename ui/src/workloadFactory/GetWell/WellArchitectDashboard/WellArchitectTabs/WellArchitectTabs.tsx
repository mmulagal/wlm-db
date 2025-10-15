import { useDispatch } from 'react-redux';
import { DsTypography } from '@tlveng/wlm-ds';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './WellArchitectTabs.module.scss';
import { useAppSelector } from '../../../../store/storeHooks';
import { setSelectedWellArchitectTab } from '../../../../store/workloadFactory/getWellOptimizeSlice';
import { GENERAL } from '../../../../utils/appConstants';
import { ERROR_ANALYZER_STATUS, WELL_ARCHITECTED_TABS } from '../../../../utils/consts';
import TooltipComponent from '../../../../common/TooltipComponent/TooltipComponent';
import { resetEiData, setLogAnalyzerState } from '../../../../store/workloadFactory/agenticAISlice';
import { uniqueHostRow } from '../../../InventoryV2/InventoryUtilsV2';

const WellArchitectTabs = () => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const [selectedTab, setSelectedTab] = useState<any>();
    const { selectedWellArchitectTab } = useAppSelector(state => state.getWellOptimize);
    const { regionMapping } = useAppSelector(state => state.headers);
    const { selectedGwInstanceRegionId, selectedGwInstanceCredId, selectedResourceId, selectedDatabaseInstance } =
        useAppSelector(state => state.getWellOptimize);
    const { allLogAnalysisData } = useAppSelector(state => state.inventoryV2);

    const isBedrockSupportedForRegion = useMemo(() => {
        let isBedRockAvailable = true;
        if (
            regionMapping &&
            selectedGwInstanceRegionId &&
            regionMapping.hasOwnProperty(selectedGwInstanceRegionId) &&
            regionMapping[selectedGwInstanceRegionId]?.hasOwnProperty('bedrockAvailable') &&
            !regionMapping[selectedGwInstanceRegionId]?.bedrockAvailable
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

    const updateLogAnalyzerCheck = () => {
        dispatch(resetEiData({}));
        const key = uniqueHostRow(selectedResourceId, selectedGwInstanceCredId, selectedGwInstanceRegionId);
        const logAnalyzerRow: any = allLogAnalysisData?.find(
            (perLa: any) =>
                uniqueHostRow(perLa?.databaseHostId, perLa?.credentialId || '', perLa?.regionId || '') === key &&
                perLa?.databaseInstanceId === selectedDatabaseInstance
        );
        dispatch(setLogAnalyzerState(logAnalyzerRow?.status || ERROR_ANALYZER_STATUS.NOT_ACTIVE));
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
                    data-testid="wlm-db-mssql-overview-tab"
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
                    data-testid="wlm-db-mssql-well-architected-status-tab"
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
                        onClick={() => {
                            updateLogAnalyzerCheck();
                            handleClick('Error investigation');
                        }}
                        data-testid="wlm-db-mssql-error-investigation-tab"
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
                    data-testid="wlm-db-mssql-databases-tab"
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
                    data-testid="wlm-db-mssql-sandboxes-tab"
                >
                    {GENERAL.SANDBOXES}
                </DsTypography>
            </div>
        </div>
    );
};

export default WellArchitectTabs;
