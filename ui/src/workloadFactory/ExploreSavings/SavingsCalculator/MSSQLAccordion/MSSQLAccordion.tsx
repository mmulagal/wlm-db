import { DsAccordion, DsButton, DsTypography, Popover, useDialog } from '@netapp/design-system';
import styles from './MSSQLAccordion.module.scss';
import { ExploreSaveConfiguration, MSSQLServerInstance, calculatedFSXData, setRecommendedConfig } from '../savingsUtil';
import { Grid, GridItem } from '../../../../ui-components/Layout/Grid';
import { useNavigate } from 'react-router-dom';
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
import { useEffect, useState } from 'react';
import { setSaveConfigName } from '../../../../store/workloadFactory/exploreSavingsSlice';
import { useDispatch } from 'react-redux';
import { useGetConfigListQuery, useSaveConfigDataMutation } from '../../../../utils/apiService';
import { LoadRecommendedConfig } from '../../../../components/CreateMsSql/Configuration/LoadConfiguration';
import { setIsLoadConfig, setIsLoading, setIsRecommendedInstance } from '../../../../store/mssql/msSqlActionSlice';

const TableLayout = ({ data }: any) => {
    return (
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
            </GridItem>
        </Grid>
    );
};

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
        selectedOnPremRegion
    } = useAppSelector(state => state.exploreSavings);
    const headerSelectedRegion = useAppSelector(state => state.headers.headerSelectedRegion);
    const { setDialog, closeDialog } = useDialog();
    const navigate = useNavigate();
    const [fsxData, setFsxData] = useState({});
    const [msSqlInstance, setMsSqlInstance] = useState({});
    const [storageType, setStorageType] = useState('');
    //To get configDatalist
    const [configData, setConfigData] = useState<any>([]);

    const { data: configDataList, isFetching: configLoading, refetch: configRefetch } = useGetConfigListQuery({});

    useEffect(() => {
        setConfigData(configDataList || []);
    }, [configDataList]);

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
            selectedRegion = headerSelectedRegion?.data?.regionName + ' | ' + headerSelectedRegion?.data?.regionCode;
        } else if (savingsCalculatorFrom === SAVINGS_CALC_MODE.ONPREM) {
            selectedRegion = selectedOnPremRegion?.data?.regionName + ' | ' + selectedOnPremRegion?.data?.regionCode;
        } else {
            selectedRegion = selectedManualRegion?.data?.regionName + ' | ' + selectedManualRegion?.data?.regionCode;
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
        if (storageSavingsResponse?.compute?.recommended?.instanceType) {
            instanceType = storageSavingsResponse?.compute?.recommended?.instanceType.split(',')[0];
        }
        let serverEdition = '';
        if (storageSavingsResponse?.license?.recommended?.sqlServerEdition) {
            serverEdition = storageSavingsResponse?.license?.recommended?.sqlServerEdition.split(',')[0];
        }
        let windowsServer = '';
        if (storageSavingsResponse?.compute?.recommended?.windowsOsVersion) {
            windowsServer = storageSavingsResponse?.compute?.recommended?.windowsOsVersion.split(',')[0];
        }

        let mssqlInstanceData = {};
        if (selectedExploreSavingsTab === WLF_TABS.MSSQL_ON_PREMISES) {
            mssqlInstanceData = {
                serverInstallationMode: selectedOnPremHostDetails?.recommendedInstance?.serverInstallationMode,
                serverEdition: serverEdition,
                serverVersion: selectedOnPremHostDetails?.recommendedInstance?.serverVersion,
                instanceType: instanceType,
                windowsServer: windowsServer
            };
        } else {
            mssqlInstanceData = {
                serverInstallationMode: selectedHostDetails?.recommendedInstance?.serverInstallationMode,
                serverEdition: serverEdition,
                serverVersion: selectedHostDetails?.recommendedInstance?.serverVersion,
                instanceType: instanceType,
                windowsServer: windowsServer
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
        }, 5);
    };

    const setCSS = () => {
        if (selectedExploreSavingsTab === WLF_TABS.MSSQL_ON_PREMISES) {
            return `${styles.mssqlAccordion} ${styles.mssqlAccordionOnPremises}`;
        } else {
            return `${styles.mssqlAccordion}`;
        }
    };

    const saveIsDisabled = () => {
        if (savingsCalculatorFrom === SAVINGS_CALC_MODE.ONPREM) {
            return GENERAL.ONPREM_CREATE_TEMPLATE_DISABLE;
        } else if (configData?.length >= MAX_SAVED_CONFIG) {
            return SELECT_CONFIG.MAX_CONFIG_LIMIT;
        } else {
            return '';
        }
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
                            popoverClass={styles['popover']}
                            children={GENERAL.ES_SAVE_ERROR}
                            trigger="hover"
                            container={
                                <div id="es-save-config">
                                    <DsButton type="text" isDisabled={true}>
                                        {GENERAL.ES_SAVE_CONFIG}
                                    </DsButton>
                                </div>
                            }
                        />
                    ) : (
                        !printState && (
                            <div id="es-save-config">
                                {saveIsDisabled() ? (
                                    <Popover
                                        popoverClass={styles['popover']}
                                        children={saveIsDisabled()}
                                        trigger="hover"
                                        container={
                                            <div id="es-save-config">
                                                <DsButton type="text" isDisabled={true}>
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
                                            configLoading
                                        }
                                        onClick={() => handleSaveConfiguration(FROM_DIALOG.SAVE_CONFIG)}
                                    >
                                        {GENERAL.ES_SAVE_CONFIG}
                                    </DsButton>
                                )}
                            </div>
                        )
                    ),

                    !printState && (
                        <div style={{ height: '32px' }} id="es-create" className={styles.buttonContainer}>
                            {savingsCalculatorFrom === SAVINGS_CALC_MODE.ONPREM ? (
                                <Popover
                                    popoverClass={styles['popover']}
                                    children={GENERAL.ONPREM_CREATE_TEMPLATE_DISABLE}
                                    trigger="hover"
                                    container={
                                        <div id="es-create-template">
                                            <DsButton type="button" isDisabled={true}>
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
                                        !storageSavingsResponse
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
                        <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '2351px' }}>
                            <DsTypography
                                variant="Semibold_14"
                                style={{ marginBottom: '6px', fontWeight: '505 !important' }}
                            >
                                {GENERAL.MS_SQL_TWO_INSTANCES}
                            </DsTypography>

                            {MSSQLServerInstance(msSqlInstance, storageType).map(
                                (data: { label: string; text: string; value: string }, index: number) => (
                                    <TableLayout data={data} key={index} />
                                )
                            )}
                            <DsTypography variant="Semibold_14" style={{ marginTop: '32px', marginBottom: '6px' }}>
                                {GENERAL.FSX_FOR_ONTAP} 1
                            </DsTypography>
                            {calculatedFSXData(fsxData, storageType).map(
                                (data: { label: string; text: string; value: string }, index: number) => (
                                    <TableLayout data={data} key={index} />
                                )
                            )}

                            <DsTypography variant="Semibold_14" style={{ marginTop: '32px', marginBottom: '6px' }}>
                                {GENERAL.FSX_FOR_ONTAP} 2
                            </DsTypography>
                            {calculatedFSXData(fsxData, storageType).map(
                                (data: { label: string; text: string; value: string }, index: number) => (
                                    <TableLayout data={data} key={index} />
                                )
                            )}
                        </div>
                    ) : (
                        <div
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                maxHeight: '2000px',
                                overflow: 'hidden'
                            }}
                        >
                            <DsTypography
                                variant="Semibold_14"
                                style={{ marginBottom: '6px' }}
                                className={styles.setFont}
                            >
                                {GENERAL.MS_SQL_SINGLE_INSTANCES}
                            </DsTypography>

                            {MSSQLServerInstance(msSqlInstance, storageType).map(
                                (data: { label: string; text: string; value: string }, index: number) => (
                                    <TableLayout data={data} key={index} />
                                )
                            )}
                            <DsTypography
                                variant="Semibold_14"
                                style={{ marginTop: '32px', marginBottom: '6px' }}
                                className={styles.setFont}
                            >
                                {GENERAL.FSX_FOR_ONTAP}
                            </DsTypography>
                            {calculatedFSXData(fsxData, storageType).map(
                                (data: { label: string; text: string; value: string }, index: number) => (
                                    <TableLayout data={data} key={index} />
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
