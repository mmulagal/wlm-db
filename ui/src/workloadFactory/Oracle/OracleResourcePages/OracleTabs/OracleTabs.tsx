import { useDispatch } from 'react-redux';
import { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { DsTypography, Popover } from '@netapp/design-system';
import styles from './OracleTabs.module.scss';
import { useAppSelector } from '../../../../store/storeHooks';
import { WELL_ARCHITECTED_TABS, ORACLE_DATABASES_COMPONENTS, ERROR_ANALYZER_STATUS } from '../../../../utils/consts';
import { setSelectedOracleInnerPageTab } from '../../../../store/workloadFactory/oracleSlice';
import TooltipComponent from '../../../../common/TooltipComponent/TooltipComponent';
import {
    resolveWellArchitectTabRestriction,
    resolveRegisteredInstanceMissingFsxLink,
    uniqueHostRow
} from '../../../InventoryV2/InventoryUtilsV2';
import { resetEiData, setLogAnalyzerState } from '../../../../store/workloadFactory/agenticAISlice';

const OracleTabs = () => {
    const dispatch = useDispatch();
    const { t } = useTranslation();
    const [selectedTab, setSelectedTab] = useState<string>();
    const { selectedOracleInnerPageTab } = useAppSelector(state => state.oracleSlice);
    const { selectedResourceId, selectedDatabaseInstanceName } = useAppSelector(state => state.workloadFactoryResource);
    const { inventoryTableData } = useAppSelector(state => state.inventoryV2);
    const { isGovAccount } = useAppSelector(state => state.auth);
    const { regionMapping } = useAppSelector(state => state.headers);
    const {
        selectedGwInstanceRegionId,
        selectedGwInstanceCredId,
        selectedDatabaseInstance,
        selectedResourceId: waSelectedResourceId,
        isWad,
        isUnregistered,
        hostManageReadiness,
        fsxLinkExists
    } = useAppSelector(state => state.getWellOptimize);
    const { allLogAnalysisData } = useAppSelector(state => state.inventoryV2);

    const { isSingleTenant, hasWadPdbData, restrictTabs, restrictPdbTab, registeredMissingFsxLink } = useMemo(() => {
        const gateInput = {
            isWad,
            isUnregistered,
            hostManageReadinessFromStore: hostManageReadiness,
            fsxLinkExistsFromStore: fsxLinkExists,
            inventoryTableData,
            resourceId: selectedResourceId,
            credId: selectedGwInstanceCredId,
            regionId: selectedGwInstanceRegionId,
            instanceId: selectedDatabaseInstance,
            instanceName: selectedDatabaseInstanceName
        };
        let isSingleTenantResult = false;
        let hasWadPdbDataResult = false;
        if (selectedResourceId && selectedDatabaseInstanceName && inventoryTableData) {
            const hostData = Object.values(inventoryTableData).find(host => host?.resourceId === selectedResourceId);
            const instanceData = hostData?.sqlServerInstances?.find(
                instance =>
                    instance?.databaseInstanceName?.toLowerCase() === selectedDatabaseInstanceName?.toLowerCase()
            );
            isSingleTenantResult = instanceData?.instanceType === ORACLE_DATABASES_COMPONENTS.SINGLE_TENANT;
            hasWadPdbDataResult =
                !!instanceData?.isWad &&
                Array.isArray(instanceData?.databases) &&
                instanceData.databases.some(db => db?.type === ORACLE_DATABASES_COMPONENTS.PDB);
        }
        const pdbGate = resolveWellArchitectTabRestriction({ ...gateInput, isWad: false });
        return {
            isSingleTenant: isSingleTenantResult,
            hasWadPdbData: hasWadPdbDataResult,
            restrictTabs: resolveWellArchitectTabRestriction(gateInput),
            restrictPdbTab: (isWad && !hasWadPdbDataResult) || pdbGate,
            registeredMissingFsxLink: resolveRegisteredInstanceMissingFsxLink(gateInput)
        };
    }, [
        isWad,
        isUnregistered,
        hostManageReadiness,
        fsxLinkExists,
        inventoryTableData,
        selectedResourceId,
        selectedGwInstanceCredId,
        selectedGwInstanceRegionId,
        selectedDatabaseInstance,
        selectedDatabaseInstanceName
    ]);

    // WAD tooltip message for disabled tabs (Oracle specific)
    const wadDisabledMessage = t('databases.wad.tab-disabled-message-oracle');
    // Unregistered tooltip message for disabled tabs (Oracle specific)
    const unregisteredDisabledMessage = t('databases.wad.unregistered-tab-disabled-message-oracle');
    const registeredMissingFsxLinkMessage = t('databases.wad.registered-missing-fs-link-disabled-message');
    const restrictedTabMessage = registeredMissingFsxLink
        ? registeredMissingFsxLinkMessage
        : isWad
        ? wadDisabledMessage
        : unregisteredDisabledMessage;

    useEffect(() => {
        setSelectedTab(selectedOracleInnerPageTab);
    }, [selectedOracleInnerPageTab]);

    const handleClick = (value: string) => {
        if (value === WELL_ARCHITECTED_TABS.PDB && isSingleTenant) {
            return;
        }
        setSelectedTab(value);
        dispatch(setSelectedOracleInnerPageTab(value));
    };

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

    const updateLogAnalyzerCheck = () => {
        const key = uniqueHostRow(waSelectedResourceId, selectedGwInstanceCredId, selectedGwInstanceRegionId);
        const logAnalyzerRow: any = allLogAnalysisData?.find(
            (perLa: any) =>
                uniqueHostRow(perLa?.databaseHostId, perLa?.credentialId || '', perLa?.regionId || '') === key &&
                perLa?.databaseInstanceId === selectedDatabaseInstance
        );
        dispatch(setLogAnalyzerState(logAnalyzerRow?.status || ERROR_ANALYZER_STATUS.NOT_ACTIVE));
    };

    return (
        <div className={styles['oracle-tabs']}>
            {/* Overview Tab - disabled for WAD, unregistered, or missing extensive run permission */}
            {restrictTabs ? (
                <TooltipComponent placement="bottom" title={restrictedTabMessage} width={300}>
                    <div className={`${styles.headers} ${styles.headerWidthFirst}`}>
                        <DsTypography variant="Semibold_14" className={styles.headerDisabled}>
                            {t('databases.oracle-inner-page.overview')}
                        </DsTypography>
                    </div>
                </TooltipComponent>
            ) : (
                <div
                    className={
                        selectedTab === WELL_ARCHITECTED_TABS.OVERVIEW
                            ? `${styles.headers} ${styles.headerWidthFirst} ${styles.active}`
                            : `${styles.headers} ${styles.headerWidthFirst}`
                    }
                >
                    <DsTypography
                        variant="Semibold_14"
                        className={
                            selectedTab === WELL_ARCHITECTED_TABS.OVERVIEW
                                ? `${styles.headerPart1} ${styles.activeText}`
                                : `${styles.headerPart1}`
                        }
                        onClick={() => handleClick(WELL_ARCHITECTED_TABS.OVERVIEW)}
                        data-testid="wlm-db-oracle-overview-tab"
                    >
                        {t('databases.oracle-inner-page.overview')}
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
                    data-testid="wlm-db-oracle-well-architected-status-tab"
                    className={
                        selectedTab === WELL_ARCHITECTED_TABS.WELL_ARCHITECTED_STATUS
                            ? `${styles.headerPart1} ${styles.activeText}`
                            : `${styles.headerPart1}`
                    }
                    onClick={() => handleClick(WELL_ARCHITECTED_TABS.WELL_ARCHITECTED_STATUS)}
                >
                    {t('databases.general.well_architected_status')}
                </DsTypography>
            </div>

            {/* Error Investigation Tab - disabled for WAD, unregistered, missing extensive run permission, GovCloud, or when Bedrock not supported */}
            {(restrictTabs || isGovAccount || !isBedrockSupportedForRegion) && (
                <TooltipComponent
                    placement="bottom"
                    title={
                        isGovAccount
                            ? t('databases.general.not-supported-in-govcloud')
                            : restrictTabs
                            ? restrictedTabMessage
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
            {!restrictTabs && !isGovAccount && isBedrockSupportedForRegion && (
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
                        data-testid="wlm-db-oracle-error-investigation-tab"
                    >
                        {t('databases.log-analyzer.error-investigation')}
                    </DsTypography>
                    <DsTypography variant="Semibold_13" className={styles.tag}>
                        {t('databases.log-analyzer.ai-tag')}
                    </DsTypography>
                </div>
            )}

            {/* PDB Tab - disabled for WAD without PDB data, unregistered, missing extensive run permission, or Single Tenant */}
            {restrictPdbTab ? (
                <TooltipComponent
                    placement="bottom"
                    title={isWad && !hasWadPdbData ? wadDisabledMessage : restrictedTabMessage}
                    width={300}
                >
                    <div className={`${styles.headers} ${styles.headerWidthThird}`}>
                        <DsTypography variant="Semibold_14" className={styles.headerDisabled}>
                            {t('databases.oracle-inner-page.pdb')}
                        </DsTypography>
                    </div>
                </TooltipComponent>
            ) : (
                <div
                    className={
                        selectedTab === WELL_ARCHITECTED_TABS.PDB && !isSingleTenant
                            ? `${styles.headers} ${styles.headerWidthThird} ${styles.active}`
                            : `${styles.headers} ${styles.headerWidthThird} ${isSingleTenant ? styles.disabled : ''}`
                    }
                >
                    {isSingleTenant ? (
                        <Popover
                            trigger="hover"
                            container={
                                <DsTypography variant="Semibold_14" className={styles.headerPart1}>
                                    {t('databases.oracle-inner-page.pdb')}
                                </DsTypography>
                            }
                        >
                            {t('databases.oracle-inner-page.single-tenant-tooltip')}
                        </Popover>
                    ) : (
                        <DsTypography
                            variant="Semibold_14"
                            className={
                                selectedTab === WELL_ARCHITECTED_TABS.PDB
                                    ? `${styles.headerPart1} ${styles.activeText}`
                                    : `${styles.headerPart1}`
                            }
                            onClick={() => handleClick(WELL_ARCHITECTED_TABS.PDB)}
                            data-testid="wlm-db-oracle-pdb-tab"
                        >
                            {t('databases.oracle-inner-page.pdb')}
                        </DsTypography>
                    )}
                </div>
            )}
        </div>
    );
};

export default OracleTabs;
