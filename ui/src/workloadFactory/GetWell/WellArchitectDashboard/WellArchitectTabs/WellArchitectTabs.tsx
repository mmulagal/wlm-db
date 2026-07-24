import { useDispatch } from 'react-redux';
import { DsTypography } from '@tlveng/wlm-ds';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './WellArchitectTabs.module.scss';
import { useAppSelector } from '../../../../store/storeHooks';
import { setSelectedWellArchitectTab } from '../../../../store/workloadFactory/getWellOptimizeSlice';
import { ERROR_ANALYZER_STATUS, WELL_ARCHITECTED_TABS } from '../../../../utils/consts';
import TooltipComponent from '../../../../common/TooltipComponent/TooltipComponent';
import { setLogAnalyzerState } from '../../../../store/workloadFactory/agenticAISlice';
import { uniqueHostRow } from '../../../InventoryV2/InventoryUtilsV2';

const WellArchitectTabs = () => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const [selectedTab, setSelectedTab] = useState<any>();
    const { selectedWellArchitectTab, isWad, isUnregistered } = useAppSelector(state => state.getWellOptimize);
    const { isGovAccount } = useAppSelector(state => state.auth);
    const { regionMapping } = useAppSelector(state => state.headers);
    const { selectedGwInstanceRegionId, selectedGwInstanceCredId, selectedResourceId, selectedDatabaseInstance } =
        useAppSelector(state => state.getWellOptimize);
    const { allLogAnalysisData } = useAppSelector(state => state.inventoryV2);

    // WAD tooltip message for disabled tabs
    const wadDisabledMessage = t('databases.wad.tab-disabled-message');
    // Unregistered tooltip message for disabled tabs
    const unregisteredDisabledMessage = t('databases.wad.unregistered-tab-disabled-message');

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
            {/* Overview Tab - disabled for WAD or unregistered instances */}
            {isWad || isUnregistered ? (
                <TooltipComponent
                    placement="bottom"
                    title={isUnregistered ? unregisteredDisabledMessage : wadDisabledMessage}
                    width={300}
                >
                    <div className={`${styles.headers} ${styles.headerWidthFirst}`}>
                        <DsTypography variant="Semibold_14" className={styles.headerDisabled}>
                            {t('databases.general.overview')}
                        </DsTypography>
                    </div>
                </TooltipComponent>
            ) : (
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
                        {t('databases.general.overview')}
                    </DsTypography>
                </div>
            )}
            <div
                className={
                    selectedTab === WELL_ARCHITECTED_TABS.WELL_ARCHITECTED_STATUS
                        ? `${styles.headers} ${styles.headerWidthSecond} ${styles.active}`
                        : `${styles.headers} ${styles.headerWidthSecond}`
                }
            >
                <DsTypography
                    variant="Semibold_14"
                    className={
                        selectedTab === WELL_ARCHITECTED_TABS.WELL_ARCHITECTED_STATUS
                            ? `${styles.headerPart1} ${styles.activeText}`
                            : `${styles.headerPart1}`
                    }
                    onClick={() => handleClick(WELL_ARCHITECTED_TABS.WELL_ARCHITECTED_STATUS)}
                    data-testid="wlm-db-mssql-well-architected-status-tab"
                >
                    {t('databases.general.well-architected-status')}
                </DsTypography>
            </div>

            {/* Error Investigation Tab - disabled for WAD, unregistered, GovCloud, or when Bedrock not supported */}
            {(isWad || isUnregistered || isGovAccount || !isBedrockSupportedForRegion) && (
                <TooltipComponent
                    placement="bottom"
                    title={
                        isGovAccount
                            ? t('databases.general.not-supported-in-govcloud')
                            : isUnregistered
                            ? unregisteredDisabledMessage
                            : isWad
                            ? wadDisabledMessage
                            : t('databases.log-analyzer.bedrock-in-region-not-supported')
                    }
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
            {!isWad && !isUnregistered && !isGovAccount && isBedrockSupportedForRegion && (
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
                            selectedTab === WELL_ARCHITECTED_TABS.ERROR_INVESTIGATION
                                ? `${styles.headerPart1} ${styles.activeText}`
                                : `${styles.headerPart1}`
                        }
                        onClick={() => {
                            updateLogAnalyzerCheck();
                            handleClick(WELL_ARCHITECTED_TABS.ERROR_INVESTIGATION);
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

            {/* Databases Tab - enabled for WAD (MSSQL) using the offline-assessment databases API */}
            <div
                className={
                    selectedTab === WELL_ARCHITECTED_TABS.DATABASES
                        ? `${styles.headers} ${styles.headerWidthThird} ${styles.active}`
                        : `${styles.headers} ${styles.headerWidthThird}`
                }
            >
                <DsTypography
                    variant="Semibold_14"
                    className={
                        selectedTab === WELL_ARCHITECTED_TABS.DATABASES
                            ? `${styles.headerPart1} ${styles.activeText}`
                            : `${styles.headerPart1}`
                    }
                    onClick={() => handleClick(WELL_ARCHITECTED_TABS.DATABASES)}
                    data-testid="wlm-db-mssql-databases-tab"
                >
                    {t('databases.general.databases')}
                </DsTypography>
            </div>

            {/* Sandboxes Tab - disabled for WAD or unregistered instances */}
            {isWad || isUnregistered ? (
                <TooltipComponent
                    placement="bottom"
                    title={isUnregistered ? unregisteredDisabledMessage : wadDisabledMessage}
                    width={300}
                >
                    <div className={`${styles.headers} ${styles.headerWidthThird}`}>
                        <DsTypography variant="Semibold_14" className={styles.headerDisabled}>
                            {t('databases.general.sandboxes')}
                        </DsTypography>
                    </div>
                </TooltipComponent>
            ) : (
                <div
                    className={
                        selectedTab === WELL_ARCHITECTED_TABS.SANDBOXES
                            ? `${styles.headers} ${styles.headerWidthThird} ${styles.active}`
                            : `${styles.headers} ${styles.headerWidthThird}`
                    }
                >
                    <DsTypography
                        variant="Semibold_14"
                        className={
                            selectedTab === WELL_ARCHITECTED_TABS.SANDBOXES
                                ? `${styles.headerPart1} ${styles.activeText}`
                                : `${styles.headerPart1}`
                        }
                        onClick={() => handleClick(WELL_ARCHITECTED_TABS.SANDBOXES)}
                        data-testid="wlm-db-mssql-sandboxes-tab"
                    >
                        {t('databases.general.sandboxes')}
                    </DsTypography>
                </div>
            )}
        </div>
    );
};

export default WellArchitectTabs;
