import { DsAccordion, DsButton, DsTypography, Popover, useDialog } from '@netapp/design-system';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import styles from './RecommendedAccordion.module.scss';
import { generateHostMsSqlInstanceData } from './RecommendedAccordionUtils';
import {
    ExploreSaveConfiguration,
    MSSQLServerInstance,
    MSSQLServerInstanceForOnPremise,
    calculatedFSXData,
    setRecommendedConfig
} from '../savingsUtil';
import { Grid, GridItem } from '../../../../ui-components/Layout/Grid';
import { Text } from '../../../../ui-components/Typography';
import {
    FROM_DIALOG,
    MAX_SAVED_CONFIG,
    SAVINGS_CALC_MODE,
    WLF_TABS,
    WLF_TO_FORM_NAVIGATE
} from '../../../../utils/consts';
import DialogComponent from '../../../../common/Dialog/DialogComponent';
import { SELECT_CONFIG } from '../../../../utils/appConstants';
import SaveConfigSavings from './SaveCongfigSavings/SaveCongfigSavings';
import { useAppSelector } from '../../../../store/storeHooks';
import { setSaveConfigName } from '../../../../store/workloadFactory/exploreSavingsSlice';
import { useGetConfigListQuery, useSaveConfigDataMutation } from '../../../../utils/apiService';
import { LoadRecommendedConfig } from '../../../../components/CreateMsSql/Configuration/LoadConfiguration';
import { setIsLoadConfig, setIsLoading, setIsRecommendedInstance } from '../../../../store/mssql/msSqlActionSlice';
// Oracle-specific utility imports
import {
    generateOracleInstanceData,
    OracleServerInstance
} from '../../OracleTCO/OracleSavingsCalculator/OracleAccordion/OracleAccordionUtils';

const TableLayout = ({ data, type }: any) => (
    <Grid className={styles['fsx-table-column']} style={{ marginBottom: 3 }}>
        <GridItem lg="4">
            <Text>{data.label}</Text>
        </GridItem>
        <GridItem lg="3">
            <Text bold style={{ fontWeight: '505' }}>
                {data.value}
            </Text>
        </GridItem>
        <GridItem lg="5">
            <Text>{data.text}</Text>
            {data?.text2 && <Text style={{ padding: '0', marginTop: '-15px' }}>{data?.text2}</Text>}
        </GridItem>
    </Grid>
);

const RecommendedAccordion = ({ printState, disableState, isMutliFsx, width }: any) => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const [saveConfigData] = useSaveConfigDataMutation();
    const {
        storageSavingsLoading,
        storageSavingsResponse,
        selectedHostDetails,
        selectedOnPremHostDetails,
        viewCalculationsLoading,
        selectedManualDeploymentModel,
        savingsCalculatorFrom,
        selectedManualRegion,
        selectedExploreSavingsTab,
        selectedOnPremRegion,
        selectedExRegionId
    } = useAppSelector(state => state.exploreSavings);
    const {
        selectedRowsForExploreSavingsEBSBulk,
        selectedRowsForExploreSavingsOnPremBulk,
        selectedRowsForExploreSavingsOracleOnPremBulk,
        selectedRowsForExploreSavingsOracleEbsBulk
    } = useAppSelector(state => state.exploreSavingsBulk);
    const { regionsData } = useAppSelector(state => state.headers.getRegions);
    const { setDialog, closeDialog } = useDialog();
    const navigate = useNavigate();
    const [fsxData, setFsxData] = useState({});
    const [msSqlInstance, setMsSqlInstance] = useState({});
    const [storageType, setStorageType] = useState('');
    // Oracle-specific state
    const [oracleInstance, setOracleInstance] = useState<any>({});

    // Helper to check if in Oracle modes
    const isOracleOnPrem = savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_ONPREM;
    const isOracleEbs = savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_AUTO_EBS;

    const [bulkModeState, setBulkModeState] = useState({ isBulkMode: false, shouldRenderMultipleHosts: false });

    // To get configDatalist
    const [configData, setConfigData] = useState<any>([]);

    const { data: configDataList, isFetching: configLoading, refetch: configRefetch } = useGetConfigListQuery({});

    useEffect(() => {
        setConfigData(configDataList || []);
    }, [configDataList]);

    // Helper function to get the active selected rows based on current mode
    const getActiveSelectedRows = () => {
        if (savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS) {
            return selectedRowsForExploreSavingsEBSBulk || [];
        }
        if (savingsCalculatorFrom === SAVINGS_CALC_MODE.ONPREM) {
            return selectedRowsForExploreSavingsOnPremBulk || [];
        }
        if (savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_ONPREM) {
            return selectedRowsForExploreSavingsOracleOnPremBulk || [];
        }
        if (savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_AUTO_EBS) {
            return selectedRowsForExploreSavingsOracleEbsBulk || [];
        }
        return [];
    };

    // useEffect to manage shouldRenderMultipleHosts so that on Add hosts and remove hosts the Save Configuration and create template button visibility can be handled
    useEffect(() => {
        // Check for EBS bulk mode
        const isEBSBulk =
            savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS &&
            selectedRowsForExploreSavingsEBSBulk &&
            selectedRowsForExploreSavingsEBSBulk.length > 1;

        // Check for On-Prem bulk mode
        const isOnPremBulk =
            savingsCalculatorFrom === SAVINGS_CALC_MODE.ONPREM &&
            selectedRowsForExploreSavingsOnPremBulk &&
            selectedRowsForExploreSavingsOnPremBulk.length > 1;

        // Check for Oracle On-Prem bulk mode (>= 1 to handle single host consistently)
        const isOracleOnPremBulk =
            savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_ONPREM &&
            selectedRowsForExploreSavingsOracleOnPremBulk &&
            selectedRowsForExploreSavingsOracleOnPremBulk.length >= 1;

        // Check for Oracle EBS bulk mode (>= 1 to handle single host consistently)
        const isOracleEbsBulk =
            savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_AUTO_EBS &&
            selectedRowsForExploreSavingsOracleEbsBulk &&
            selectedRowsForExploreSavingsOracleEbsBulk.length >= 1;

        const shouldRender = isEBSBulk || isOnPremBulk || isOracleOnPremBulk || isOracleEbsBulk;

        const isBulk =
            (savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS && selectedRowsForExploreSavingsEBSBulk.length > 0) ||
            (savingsCalculatorFrom === SAVINGS_CALC_MODE.ONPREM &&
                selectedRowsForExploreSavingsOnPremBulk &&
                selectedRowsForExploreSavingsOnPremBulk.length > 0) ||
            (savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_ONPREM &&
                selectedRowsForExploreSavingsOracleOnPremBulk &&
                selectedRowsForExploreSavingsOracleOnPremBulk.length > 0) ||
            (savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_AUTO_EBS &&
                selectedRowsForExploreSavingsOracleEbsBulk &&
                selectedRowsForExploreSavingsOracleEbsBulk.length > 0);

        setBulkModeState({ isBulkMode: isBulk, shouldRenderMultipleHosts: shouldRender });
    }, [
        savingsCalculatorFrom,
        selectedRowsForExploreSavingsEBSBulk,
        selectedRowsForExploreSavingsOnPremBulk,
        selectedRowsForExploreSavingsOracleOnPremBulk,
        selectedRowsForExploreSavingsOracleEbsBulk
    ]);

    useEffect(() => {
        if (
            savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_FSXW ||
            savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_FSXW
        ) {
            setStorageType(t('databases.explore-savings.fsx-for-windows'));
        } else {
            setStorageType(t('databases.explore-savings.ebs'));
        }
    }, [savingsCalculatorFrom]);

    useEffect(() => {
        let selectedRegion = '';
        if (
            savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS ||
            savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_FSXW ||
            savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_AUTO_EBS
        ) {
            const matchingRegionEntry =
                regionsData && regionsData?.regions?.find(entry => entry.regionCode === selectedExRegionId);
            selectedRegion = `${matchingRegionEntry?.regionName} | ${matchingRegionEntry?.regionCode}`;
        } else if (savingsCalculatorFrom === SAVINGS_CALC_MODE.ONPREM || isOracleOnPrem) {
            selectedRegion = `${selectedOnPremRegion?.data?.regionName} | ${selectedOnPremRegion?.data?.regionCode}`;
        } else {
            selectedRegion = `${selectedManualRegion?.data?.regionName} | ${selectedManualRegion?.data?.regionCode}`;
        }
        if (storageSavingsResponse?.single) {
            setFsxData({
                ...storageSavingsResponse?.single?.fsxCalculation,
                regionName: selectedRegion,
                fsxBreakdown: storageSavingsResponse?.single?.fsxBreakdown
            });
        } else {
            setFsxData({
                ...storageSavingsResponse?.multi?.fsxCalculation,
                regionName: selectedRegion,
                fsxBreakdown: storageSavingsResponse?.multi?.fsxBreakdown
            });
        }
        // setMsSqlInstance(storageSavingsResponse?.mssqlInstance);
    }, [storageSavingsResponse, isOracleOnPrem, selectedOnPremRegion]);

    // Oracle instance data generation
    useEffect(() => {
        if ((isOracleOnPrem || isOracleEbs) && storageSavingsResponse) {
            const instanceData = generateOracleInstanceData(
                storageSavingsResponse,
                isOracleOnPrem ? selectedOnPremHostDetails : selectedHostDetails
            );
            setOracleInstance(instanceData);
        }
    }, [isOracleOnPrem, isOracleEbs, storageSavingsResponse, selectedOnPremHostDetails, selectedHostDetails]);

    useEffect(() => {
        let instanceType = '';
        if (
            (savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS ||
                savingsCalculatorFrom === SAVINGS_CALC_MODE.ONPREM ||
                savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_AUTO_EBS) &&
            storageSavingsResponse
        ) {
            // Handle AUTO_EBS, ONPREM, and ORACLE_AUTO_EBS array format
            const computeArray = Array.isArray(storageSavingsResponse?.compute)
                ? storageSavingsResponse.compute
                : [storageSavingsResponse?.compute].filter(Boolean);
            if (computeArray[0]?.recommended?.instanceType) {
                instanceType = computeArray[0]?.recommended?.instanceType.split(',')[0];
            }
        } else if (storageSavingsResponse?.compute?.recommended?.instanceType) {
            // Handle single object format for other modes
            instanceType = storageSavingsResponse?.compute?.recommended?.instanceType.split(',')[0];
        }

        let serverEdition = '';
        if (
            (savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS ||
                savingsCalculatorFrom === SAVINGS_CALC_MODE.ONPREM ||
                savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_AUTO_EBS) &&
            storageSavingsResponse
        ) {
            // Handle AUTO_EBS, ONPREM, and ORACLE_AUTO_EBS array format
            const licenseArray = Array.isArray(storageSavingsResponse?.license)
                ? storageSavingsResponse.license
                : [storageSavingsResponse?.license].filter(Boolean);
            if (licenseArray[0]?.recommended?.sqlServerEdition) {
                serverEdition = licenseArray[0]?.recommended?.sqlServerEdition.split(',')[0];
            }
        } else if (storageSavingsResponse?.license?.recommended?.sqlServerEdition) {
            // Handle single object format for other modes
            serverEdition = storageSavingsResponse?.license?.recommended?.sqlServerEdition.split(',')[0];
        }

        let windowsServer = '';
        if (
            (savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS ||
                savingsCalculatorFrom === SAVINGS_CALC_MODE.ONPREM) &&
            storageSavingsResponse
        ) {
            // Handle AUTO_EBS and ONPREM array format
            const computeArray = Array.isArray(storageSavingsResponse?.compute)
                ? storageSavingsResponse.compute
                : [storageSavingsResponse?.compute].filter(Boolean);
            if (computeArray[0]?.recommended?.windowsOsVersion) {
                windowsServer = computeArray[0]?.recommended?.windowsOsVersion.split(',')[0];
            }
        } else if (storageSavingsResponse?.compute?.recommended?.windowsOsVersion) {
            // Handle single object format for other modes
            windowsServer = storageSavingsResponse?.compute?.recommended?.windowsOsVersion.split(',')[0];
        }
        const editionUpgradeCheck = (() => {
            if (
                (savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS ||
                    savingsCalculatorFrom === SAVINGS_CALC_MODE.ONPREM) &&
                storageSavingsResponse
            ) {
                // Handle AUTO_EBS and ONPREM array format
                const licenseArray = Array.isArray(storageSavingsResponse?.license)
                    ? storageSavingsResponse.license
                    : [storageSavingsResponse?.license].filter(Boolean);
                return (
                    licenseArray[0]?.existing?.sqlServerEdition?.includes('Enterprise') &&
                    licenseArray[0]?.recommended?.sqlServerEdition?.includes('Standard')
                );
            }
            // Handle single object format for other modes
            return (
                storageSavingsResponse?.license?.existing?.sqlServerEdition?.includes('Enterprise') &&
                storageSavingsResponse?.license?.recommended?.sqlServerEdition?.includes('Standard')
            );
        })();

        let mssqlInstanceData = {};
        if (selectedExploreSavingsTab === WLF_TABS.MSSQL_ON_PREMISES) {
            mssqlInstanceData = {
                serverInstallationMode: selectedOnPremHostDetails?.recommendedInstance?.serverInstallationMode,
                serverEdition,
                serverVersion: selectedOnPremHostDetails?.recommendedInstance?.serverVersion,
                instanceType,
                windowsServer,
                editionUpgradeCheck
            };
        } else {
            const isFsxw =
                savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_FSXW ||
                savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_FSXW;
            mssqlInstanceData = {
                serverInstallationMode: selectedHostDetails?.recommendedInstance?.serverInstallationMode,
                actualServerInstallationMode: selectedHostDetails?.serverInstallationMode,
                serverEdition,
                serverVersion: isFsxw
                    ? windowsServer || selectedHostDetails?.recommendedInstance?.serverVersion
                    : selectedHostDetails?.recommendedInstance?.serverVersion,
                instanceType,
                windowsServer
            };
        }
        if (
            (savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_EBS ||
                savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_FSXW) &&
            selectedManualDeploymentModel
        ) {
            mssqlInstanceData = {
                ...mssqlInstanceData,
                serverInstallationMode:
                    selectedManualDeploymentModel?.value === t('databases.general.always-on-availability-group')
                        ? t('databases.general.failover-cluster-instances')
                        : selectedManualDeploymentModel?.value
            };
        }
        setMsSqlInstance(mssqlInstanceData);
    }, [selectedHostDetails, storageSavingsResponse, selectedManualDeploymentModel, selectedOnPremHostDetails]);

    const handleSaveConfiguration = (dialogFrom: any) => {
        // Use Oracle instance data when in Oracle mode, otherwise MSSQL instance
        const instanceData = isOracleOnPrem || isOracleEbs ? oracleInstance : msSqlInstance;
        setDialog(
            <DialogComponent
                header={t('databases.explore-savings.save-configuration')}
                content={<SaveConfigSavings description={t('databases.explore-savings.save-configuration-desc')} />}
                primaryButton={t('databases.general.save')}
                secondaryButton={t('databases.general.cancel')}
                callback={() =>
                    ExploreSaveConfiguration(
                        dispatch,
                        saveConfigData,
                        closeDialog,
                        instanceData,
                        fsxData,
                        configRefetch
                    )
                }
                closeCallback={() => {
                    dispatch(setSaveConfigName(''));
                }}
                dialogFrom={dialogFrom}
                customClass={styles.setWidth}
            />
        );
    };

    const handleCreateClick = () => {
        dispatch(setIsLoading(true));
        dispatch(setIsLoadConfig(true));
        navigate(WLF_TO_FORM_NAVIGATE);
        const data = setRecommendedConfig(msSqlInstance, fsxData);
        dispatch(setIsRecommendedInstance(data?.instanceType));
        LoadRecommendedConfig(dispatch, data, false);
        setTimeout(() => {
            dispatch(setIsLoadConfig(false));
        }, 2000);
    };

    const setCSS = () => {
        if (selectedExploreSavingsTab === WLF_TABS.MSSQL_ON_PREMISES || isOracleOnPrem || isOracleEbs) {
            return `${styles.recommendedAccordion} ${styles.recommendedAccordionOnPremises}`;
        }
        return `${styles.recommendedAccordion}`;
    };

    const getAccordionTitle = () => {
        if (isOracleOnPrem || isOracleEbs) {
            return t('databases.explore-savings.oracle-ec2-single-fsx');
        }
        return t('databases.explore-savings.recommended-es-title');
    };

    const getInstanceTitle = () => {
        if (isOracleOnPrem || isOracleEbs) {
            return t('databases.explore-savings.oracle-server-instance');
        }
        return isMutliFsx
            ? t('databases.explore-savings.mssql-two-instances')
            : t('databases.explore-savings.mssql-single-instance');
    };

    const saveIsDisabled = () => {
        if (savingsCalculatorFrom === SAVINGS_CALC_MODE.ONPREM && isMutliFsx) {
            return t('databases.explore-savings.onprem-create-template-disable');
        }
        if (configData?.length >= MAX_SAVED_CONFIG) {
            return SELECT_CONFIG.MAX_CONFIG_LIMIT;
        }
        return '';
    };

    return (
        <div className={setCSS()} id="recommended-accordion" style={width !== undefined ? { width } : undefined}>
            <DsAccordion
                id="1"
                title={getAccordionTitle()}
                variant="Default"
                value=""
                maxExpandHeight={4000}
                isDisabled={
                    storageSavingsLoading ||
                    selectedHostDetails?.loading ||
                    disableState ||
                    viewCalculationsLoading ||
                    (isMutliFsx && !isOracleOnPrem && !isOracleEbs) ||
                    !storageSavingsResponse
                }
                disabledReason={
                    isMutliFsx && !isOracleOnPrem && !isOracleEbs
                        ? t('databases.explore-savings.multi-fsx-disable-msg')
                        : ''
                }
                isExpanded={printState}
                headerActions={[
                    isMutliFsx && !isOracleOnPrem && !isOracleEbs ? (
                        <Popover
                            popoverClass={styles.popover}
                            children={t('databases.explore-savings.save-error')}
                            trigger="hover"
                            container={
                                <div id="es-save-config">
                                    <DsButton type="text" isDisabled>
                                        {t('databases.explore-savings.save-configuration')}
                                    </DsButton>
                                </div>
                            }
                        />
                    ) : (
                        !printState &&
                        !bulkModeState.shouldRenderMultipleHosts &&
                        !isOracleOnPrem &&
                        !isOracleEbs && (
                            <div id="es-save-config">
                                {saveIsDisabled() ? (
                                    <Popover
                                        popoverClass={styles.popover}
                                        children={saveIsDisabled()}
                                        trigger="hover"
                                        container={
                                            <div id="es-save-config">
                                                <DsButton type="text" isDisabled>
                                                    {t('databases.explore-savings.save-configuration')}
                                                </DsButton>
                                            </div>
                                        }
                                    />
                                ) : (
                                    <DsButton
                                        type="text"
                                        isDisabled={
                                            storageSavingsLoading ||
                                            selectedHostDetails?.loading ||
                                            viewCalculationsLoading ||
                                            isMutliFsx ||
                                            disableState ||
                                            !storageSavingsResponse ||
                                            configLoading ||
                                            bulkModeState.shouldRenderMultipleHosts
                                        }
                                        onClick={() => handleSaveConfiguration(FROM_DIALOG.SAVE_CONFIG)}
                                    >
                                        {t('databases.explore-savings.save-configuration')}
                                    </DsButton>
                                )}
                            </div>
                        )
                    ),

                    !printState && !bulkModeState.shouldRenderMultipleHosts && !isOracleOnPrem && !isOracleEbs && (
                        <div id="es-create" className={`${styles.buttonContainer} ${styles.headerActionsContainer}`}>
                            {savingsCalculatorFrom === SAVINGS_CALC_MODE.ONPREM && isMutliFsx ? (
                                <Popover
                                    popoverClass={styles.popover}
                                    children={t('databases.explore-savings.onprem-create-template-disable')}
                                    trigger="hover"
                                    container={
                                        <div id="es-create-template">
                                            <DsButton type="button" isDisabled>
                                                {t('databases.explore-savings.create-template')}
                                            </DsButton>
                                        </div>
                                    }
                                />
                            ) : (
                                <DsButton
                                    type="button"
                                    isDisabled={
                                        isMutliFsx ||
                                        storageSavingsLoading ||
                                        selectedHostDetails?.loading ||
                                        viewCalculationsLoading ||
                                        disableState ||
                                        !storageSavingsResponse ||
                                        bulkModeState.shouldRenderMultipleHosts
                                    }
                                    onClick={() => handleCreateClick()}
                                >
                                    {t('databases.explore-savings.create-template')}
                                </DsButton>
                            )}
                        </div>
                    )
                ]}
                children={
                    isOracleOnPrem || isOracleEbs ? (
                        // Oracle on-prem and EBS content
                        <div className={styles.accordionContentWrapperSingle}>
                            {bulkModeState.isBulkMode ? (
                                <>
                                    {getActiveSelectedRows().map((host: any, hostIndex: number) => {
                                        const hostOracleData = generateOracleInstanceData(
                                            storageSavingsResponse,
                                            host,
                                            isOracleOnPrem ? host.resourceName : host.name
                                        );
                                        return (
                                            <div key={host.resourceId || `oracle-host-${hostIndex}`}>
                                                <DsTypography
                                                    variant="Semibold_14"
                                                    className={styles.instanceTypography}
                                                    style={{ marginTop: hostIndex > 0 ? '32px' : '0px' }}
                                                >
                                                    {`${t('databases.explore-savings.oracle-server-instance')} - ${
                                                        (isOracleOnPrem ? host.resourceName : host.name) ||
                                                        `Host ${hostIndex + 1}`
                                                    }`}
                                                </DsTypography>
                                                {OracleServerInstance(hostOracleData, t).map(
                                                    (
                                                        data: { label: string; text: string; value: string },
                                                        index: number
                                                    ) => (
                                                        <TableLayout
                                                            data={data}
                                                            key={`oracle-bulk-${hostIndex}-${index}`}
                                                        />
                                                    )
                                                )}
                                            </div>
                                        );
                                    })}
                                    <DsTypography variant="Semibold_14" className={styles.fsxTypography}>
                                        {t('databases.general.fsx-for-ontap')} 1
                                    </DsTypography>
                                    {calculatedFSXData(fsxData, { isOracleOnPrem: true }).map(
                                        (data: { label: string; text: string; value: string }, index: number) => (
                                            <TableLayout data={data} key={`oracle-bulk-fsx-${index}`} />
                                        )
                                    )}
                                </>
                            ) : (
                                <>
                                    <DsTypography variant="Semibold_14" className={styles.instanceTypography}>
                                        {getInstanceTitle()}
                                    </DsTypography>
                                    {OracleServerInstance(oracleInstance, t).map(
                                        (data: { label: string; text: string; value: string }, index: number) => (
                                            <TableLayout data={data} key={`oracle-instance-${index}`} />
                                        )
                                    )}

                                    <DsTypography variant="Semibold_14" className={styles.fsxTypography}>
                                        {t('databases.general.fsx-for-ontap')}
                                    </DsTypography>
                                    {calculatedFSXData(fsxData, { isOracleOnPrem: true }).map(
                                        (data: { label: string; text: string; value: string }, index: number) => (
                                            <TableLayout data={data} key={`oracle-fsx-${index}`} />
                                        )
                                    )}
                                </>
                            )}
                        </div>
                    ) : isMutliFsx ? (
                        <div className={styles.accordionContentWrapper}>
                            <DsTypography variant="Semibold_14" className={styles.instanceTypography}>
                                {t('databases.explore-savings.mssql-two-instances')}
                            </DsTypography>

                            {selectedExploreSavingsTab === WLF_TABS.MSSQL_ON_PREMISES &&
                                MSSQLServerInstanceForOnPremise(msSqlInstance, storageType).map(
                                    (data: { label: string; text: string; value: string }, index: number) => (
                                        <TableLayout data={data} key={index} type={WLF_TABS.MSSQL_ON_PREMISES} />
                                    )
                                )}

                            {selectedExploreSavingsTab !== WLF_TABS.MSSQL_ON_PREMISES &&
                                MSSQLServerInstance(msSqlInstance, storageType).map(
                                    (data: { label: string; text: string; value: string }, index: number) => (
                                        <TableLayout data={data} key={index} />
                                    )
                                )}
                            <DsTypography variant="Semibold_14" className={styles.fsxTypography}>
                                {t('databases.general.fsx-for-ontap')} 1
                            </DsTypography>
                            {calculatedFSXData(fsxData, { storageType }).map(
                                (data: { label: string; text: string; value: string }, index: number) => (
                                    <TableLayout data={data} key={index} type={WLF_TABS.MSSQL_ON_PREMISES} />
                                )
                            )}

                            <DsTypography variant="Semibold_14" className={styles.fsxTypography}>
                                {t('databases.general.fsx-for-ontap')} 2
                            </DsTypography>
                            {calculatedFSXData(fsxData, { storageType }).map(
                                (data: { label: string; text: string; value: string }, index: number) => (
                                    <TableLayout data={data} key={index} type={WLF_TABS.MSSQL_ON_PREMISES} />
                                )
                            )}
                        </div>
                    ) : (
                        <div className={styles.accordionContentWrapperSingle}>
                            {bulkModeState.isBulkMode ? (
                                // Render multiple hosts for bulk mode (EBS or On-Prem)
                                <>
                                    {getActiveSelectedRows().map((host: any, hostIndex: number) => {
                                        // Match selectedHostDetails to this specific host
                                        let hostDetails = host;

                                        // For EBS mode, match by ec2InstanceId
                                        if (savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS) {
                                            if (
                                                selectedHostDetails &&
                                                host.ec2InstanceId === selectedHostDetails.ec2InstanceId &&
                                                host.credentialId === selectedHostDetails.credentialId &&
                                                host.regionId === selectedHostDetails.regionId
                                            ) {
                                                hostDetails = selectedHostDetails;
                                            }
                                        }

                                        // For On-Prem mode, use host data directly with enriched structure
                                        if (savingsCalculatorFrom === SAVINGS_CALC_MODE.ONPREM) {
                                            // For OnPrem, the host object already contains the necessary data
                                            // Enrich it with recommendedInstance structure for consistency
                                            hostDetails = {
                                                ...host,
                                                recommendedInstance: {
                                                    serverInstallationMode: host.deploymentModel,
                                                    serverVersion: host.sqlServerInstances?.[0]?.sqlVersion
                                                }
                                            };
                                        }

                                        // name property is used for Auto_EBS and resourceName for OnPrem
                                        const hostMsSqlData = generateHostMsSqlInstanceData(
                                            host.name || host.resourceName,
                                            savingsCalculatorFrom,
                                            storageSavingsResponse,
                                            msSqlInstance,
                                            hostDetails // Pass host-specific details (with instance API data if available)
                                        );
                                        return (
                                            <div key={host.id || host.resourceId || `host-${hostIndex}`}>
                                                <DsTypography
                                                    variant="Semibold_14"
                                                    className={styles.setFont}
                                                    style={{
                                                        marginBottom: '6px',
                                                        marginTop: hostIndex > 0 ? '32px' : '0px'
                                                    }}
                                                >
                                                    {`${t('databases.explore-savings.mssql-single-instance')} - ${
                                                        host.name ||
                                                        host.resourceName ||
                                                        host.hostname ||
                                                        `Host ${hostIndex + 1}`
                                                    }`}
                                                </DsTypography>

                                                {selectedExploreSavingsTab === WLF_TABS.MSSQL_ON_PREMISES &&
                                                    MSSQLServerInstanceForOnPremise(hostMsSqlData, storageType).map(
                                                        (
                                                            data: { label: string; text: string; value: string },
                                                            index: number
                                                        ) => (
                                                            <TableLayout
                                                                data={data}
                                                                key={`${host.id || host.resourceId}-onprem-${index}`}
                                                                type={WLF_TABS.MSSQL_ON_PREMISES}
                                                            />
                                                        )
                                                    )}

                                                {selectedExploreSavingsTab !== WLF_TABS.MSSQL_ON_PREMISES &&
                                                    MSSQLServerInstance(hostMsSqlData, storageType).map(
                                                        (
                                                            data: { label: string; text: string; value: string },
                                                            index: number
                                                        ) => (
                                                            <TableLayout
                                                                data={data}
                                                                key={`${host.id || host.resourceId}-regular-${index}`}
                                                            />
                                                        )
                                                    )}
                                            </div>
                                        );
                                    })}
                                </>
                            ) : (
                                // Render single host (original logic)
                                <>
                                    <DsTypography variant="Semibold_14" className={styles.instanceTypography}>
                                        {t('databases.explore-savings.mssql-single-instance')}
                                    </DsTypography>

                                    {selectedExploreSavingsTab === WLF_TABS.MSSQL_ON_PREMISES &&
                                        MSSQLServerInstanceForOnPremise(msSqlInstance, storageType).map(
                                            (data: { label: string; text: string; value: string }, index: number) => (
                                                <TableLayout
                                                    data={data}
                                                    key={index}
                                                    type={WLF_TABS.MSSQL_ON_PREMISES}
                                                />
                                            )
                                        )}

                                    {selectedExploreSavingsTab !== WLF_TABS.MSSQL_ON_PREMISES &&
                                        MSSQLServerInstance(msSqlInstance, storageType).map(
                                            (data: { label: string; text: string; value: string }, index: number) => (
                                                <TableLayout data={data} key={index} />
                                            )
                                        )}
                                </>
                            )}

                            <DsTypography variant="Semibold_14" className={styles.fsxTypography}>
                                {t('databases.general.fsx-for-ontap')}
                            </DsTypography>
                            {calculatedFSXData(fsxData, { storageType, selectedExploreSavingsTab }).map(
                                (data: { label: string; text: string; value: string }, index: number) => (
                                    <TableLayout data={data} key={index} type={WLF_TABS.MSSQL_ON_PREMISES} />
                                )
                            )}
                        </div>
                    )
                }
            />
        </div>
    );
};

export default RecommendedAccordion;
