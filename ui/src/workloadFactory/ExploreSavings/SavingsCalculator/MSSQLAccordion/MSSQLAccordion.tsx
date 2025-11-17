import { DsAccordion, DsButton, DsTypography, Popover, useDialog } from '@netapp/design-system';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import styles from './MSSQLAccordion.module.scss';
import { generateHostMsSqlInstanceData } from './MSSQLAccordionUtils';
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
import { GENERAL, SELECT_CONFIG } from '../../../../utils/appConstants';
import SaveConfigSavings from './SaveCongfigSavings/SaveCongfigSavings';
import { useAppSelector } from '../../../../store/storeHooks';
import { setSaveConfigName } from '../../../../store/workloadFactory/exploreSavingsSlice';
import { useGetConfigListQuery, useSaveConfigDataMutation } from '../../../../utils/apiService';
import { LoadRecommendedConfig } from '../../../../components/CreateMsSql/Configuration/LoadConfiguration';
import { setIsLoadConfig, setIsLoading, setIsRecommendedInstance } from '../../../../store/mssql/msSqlActionSlice';

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

const MSSQLAccordion = ({ printState, disableState, isMutliFsx }: any) => {
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
    const { selectedRowsForExploreSavingsEBSBulk } = useAppSelector(state => state.exploreSavingsBulk);
    const { regionsData } = useAppSelector(state => state.headers.getRegions);
    const { setDialog, closeDialog } = useDialog();
    const navigate = useNavigate();
    const [fsxData, setFsxData] = useState({});
    const [msSqlInstance, setMsSqlInstance] = useState({});
    const [storageType, setStorageType] = useState('');

    const [bulkModeState, setBulkModeState] = useState({ isBulkMode: false, shouldRenderMultipleHosts: false });

    // To get configDatalist
    const [configData, setConfigData] = useState<any>([]);

    const { data: configDataList, isFetching: configLoading, refetch: configRefetch } = useGetConfigListQuery({});

    useEffect(() => {
        setConfigData(configDataList || []);
    }, [configDataList]);

    // useEffect to manage shouldRenderMultipleHosts so that on Add hosts and remove hosts the Save Configuration and create template button visibility can be handled
    useEffect(() => {
        const shouldRender =
            savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS &&
            selectedRowsForExploreSavingsEBSBulk &&
            selectedRowsForExploreSavingsEBSBulk.length > 1;
        const isBulk =
            savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS && selectedRowsForExploreSavingsEBSBulk.length > 0;
        setBulkModeState({ isBulkMode: isBulk, shouldRenderMultipleHosts: shouldRender });
    }, [savingsCalculatorFrom, selectedRowsForExploreSavingsEBSBulk]);

    useEffect(() => {
        if (
            savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_FSXW ||
            savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_FSXW
        ) {
            setStorageType(GENERAL.FSX_FOR_WINDOWS);
        } else {
            setStorageType(GENERAL.EBS);
        }
    }, [savingsCalculatorFrom]);

    useEffect(() => {
        let selectedRegion = '';
        if (
            savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS ||
            savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_FSXW
        ) {
            const matchingRegionEntry =
                regionsData && regionsData?.regions?.find(entry => entry.regionCode === selectedExRegionId);
            selectedRegion = `${matchingRegionEntry?.regionName} | ${matchingRegionEntry?.regionCode}`;
        } else if (savingsCalculatorFrom === SAVINGS_CALC_MODE.ONPREM) {
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
    }, [storageSavingsResponse]);

    useEffect(() => {
        let instanceType = '';
        if (savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS && storageSavingsResponse) {
            // Handle AUTO_EBS array format
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
        if (savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS && storageSavingsResponse) {
            // Handle AUTO_EBS array format
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
        if (savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS && storageSavingsResponse) {
            // Handle AUTO_EBS array format
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
            if (savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS && storageSavingsResponse) {
                // Handle AUTO_EBS array format
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
            mssqlInstanceData = {
                serverInstallationMode: selectedHostDetails?.recommendedInstance?.serverInstallationMode,
                actualServerInstallationMode: selectedHostDetails?.serverInstallationMode,
                serverEdition,
                serverVersion: selectedHostDetails?.recommendedInstance?.serverVersion,
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
                    selectedManualDeploymentModel?.value === GENERAL.AOAG
                        ? GENERAL.FAILOVER_CLUSTER_INSTANCES
                        : selectedManualDeploymentModel?.value
            };
        }
        setMsSqlInstance(mssqlInstanceData);
    }, [selectedHostDetails, storageSavingsResponse, selectedManualDeploymentModel, selectedOnPremHostDetails]);

    const handleSaveConfiguration = (dialogFrom: any) => {
        setDialog(
            <DialogComponent
                header={GENERAL.ES_SAVE_CONFIG}
                content={<SaveConfigSavings description={GENERAL.ES_SAVE_CONFIG_DESC} />}
                primaryButton={GENERAL.SAVE}
                secondaryButton={GENERAL.CANCEL}
                callback={() =>
                    ExploreSaveConfiguration(
                        dispatch,
                        saveConfigData,
                        closeDialog,
                        msSqlInstance,
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
        if (selectedExploreSavingsTab === WLF_TABS.MSSQL_ON_PREMISES) {
            return `${styles.mssqlAccordion} ${styles.mssqlAccordionOnPremises}`;
        }
        return `${styles.mssqlAccordion}`;
    };

    const saveIsDisabled = () => {
        if (savingsCalculatorFrom === SAVINGS_CALC_MODE.ONPREM && isMutliFsx) {
            return GENERAL.ONPREM_CREATE_TEMPLATE_DISABLE;
        }
        if (configData?.length >= MAX_SAVED_CONFIG) {
            return SELECT_CONFIG.MAX_CONFIG_LIMIT;
        }
        return '';
    };

    return (
        <div className={setCSS()} id="recommended-accordion">
            <DsAccordion
                id="1"
                title={GENERAL.RECOMMENDED_ES_TITLE}
                variant="Default"
                value=""
                isDisabled={
                    storageSavingsLoading ||
                    selectedHostDetails?.loading ||
                    disableState ||
                    viewCalculationsLoading ||
                    isMutliFsx ||
                    !storageSavingsResponse
                }
                disabledReason={isMutliFsx ? GENERAL.ES_MULTI_FSX_DISABLE_MSG : ''}
                isExpanded={printState}
                headerActions={[
                    isMutliFsx ? (
                        <Popover
                            popoverClass={styles.popover}
                            children={GENERAL.ES_SAVE_ERROR}
                            trigger="hover"
                            container={
                                <div id="es-save-config">
                                    <DsButton type="text" isDisabled>
                                        {GENERAL.ES_SAVE_CONFIG}
                                    </DsButton>
                                </div>
                            }
                        />
                    ) : (
                        !printState &&
                        !bulkModeState.shouldRenderMultipleHosts && (
                            <div id="es-save-config">
                                {saveIsDisabled() ? (
                                    <Popover
                                        popoverClass={styles.popover}
                                        children={saveIsDisabled()}
                                        trigger="hover"
                                        container={
                                            <div id="es-save-config">
                                                <DsButton type="text" isDisabled>
                                                    {GENERAL.ES_SAVE_CONFIG}
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
                                        {GENERAL.ES_SAVE_CONFIG}
                                    </DsButton>
                                )}
                            </div>
                        )
                    ),

                    !printState && !bulkModeState.shouldRenderMultipleHosts && (
                        <div id="es-create" className={`${styles.buttonContainer} ${styles.headerActionsContainer}`}>
                            {savingsCalculatorFrom === SAVINGS_CALC_MODE.ONPREM && isMutliFsx ? (
                                <Popover
                                    popoverClass={styles.popover}
                                    children={GENERAL.ONPREM_CREATE_TEMPLATE_DISABLE}
                                    trigger="hover"
                                    container={
                                        <div id="es-create-template">
                                            <DsButton type="button" isDisabled>
                                                {GENERAL.CREATE_TEMPLATE}
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
                                    {GENERAL.CREATE_TEMPLATE}
                                </DsButton>
                            )}
                        </div>
                    )
                ]}
                children={
                    isMutliFsx ? (
                        <div className={styles.accordionContentWrapper}>
                            <DsTypography variant="Semibold_14" className={styles.instanceTypography}>
                                {GENERAL.MS_SQL_TWO_INSTANCES}
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
                                {GENERAL.FSX_FOR_ONTAP} 1
                            </DsTypography>
                            {calculatedFSXData(fsxData, storageType).map(
                                (data: { label: string; text: string; value: string }, index: number) => (
                                    <TableLayout data={data} key={index} type={WLF_TABS.MSSQL_ON_PREMISES} />
                                )
                            )}

                            <DsTypography variant="Semibold_14" className={styles.fsxTypography}>
                                {GENERAL.FSX_FOR_ONTAP} 2
                            </DsTypography>
                            {calculatedFSXData(fsxData, storageType).map(
                                (data: { label: string; text: string; value: string }, index: number) => (
                                    <TableLayout data={data} key={index} type={WLF_TABS.MSSQL_ON_PREMISES} />
                                )
                            )}
                        </div>
                    ) : (
                        <div className={styles.accordionContentWrapperSingle}>
                            {bulkModeState.isBulkMode ? (
                                // Render multiple hosts for AUTO_EBS mode
                                <>
                                    {selectedRowsForExploreSavingsEBSBulk.map((host: any, hostIndex: number) => {
                                        const hostName = host.ec2InstanceName || host.name;
                                        const hostMsSqlData = generateHostMsSqlInstanceData(
                                            hostName,
                                            savingsCalculatorFrom,
                                            storageSavingsResponse,
                                            msSqlInstance
                                        );
                                        return (
                                            <div key={host.id || `host-${hostIndex}`}>
                                                <DsTypography
                                                    variant="Semibold_14"
                                                    className={styles.setFont}
                                                    style={{
                                                        marginBottom: '6px',
                                                        marginTop: hostIndex > 0 ? '32px' : '0px'
                                                    }}
                                                >
                                                    {`${GENERAL.MS_SQL_SINGLE_INSTANCES} - ${
                                                        host.name || host.hostname || `Host ${hostIndex + 1}`
                                                    }`}
                                                </DsTypography>

                                                {selectedExploreSavingsTab !== WLF_TABS.MSSQL_ON_PREMISES &&
                                                    MSSQLServerInstance(hostMsSqlData, storageType).map(
                                                        (
                                                            data: { label: string; text: string; value: string },
                                                            index: number
                                                        ) => (
                                                            <TableLayout
                                                                data={data}
                                                                key={`${host.id}-regular-${index}`}
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
                                        {GENERAL.MS_SQL_SINGLE_INSTANCES}
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
                                {GENERAL.FSX_FOR_ONTAP}
                            </DsTypography>
                            {calculatedFSXData(fsxData, storageType, selectedExploreSavingsTab).map(
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

export default MSSQLAccordion;
