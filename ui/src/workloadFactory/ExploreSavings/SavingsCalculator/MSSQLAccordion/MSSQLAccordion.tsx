import { DsAccordion, DsButton, DsTypography, Popover, useDialog } from '@netapp/design-system';
import styles from './MSSQLAccordion.module.scss';
import { ExploreSaveConfiguration, MSSQLServerInstance, calculatedFSXData, setRecommendedConfig } from '../savingsUtil';
import { Grid, GridItem } from '../../../../ui-components/Layout/Grid';
import { useNavigate } from 'react-router-dom';
import { Text } from '../../../../ui-components/Typography';
import { FROM_DIALOG, WLF_TO_FORM_NAVIGATE } from '../../../../utils/consts';
import DialogComponent from '../../../../common/Dialog/DialogComponent';
import { GENERAL } from '../../../../utils/appConstants';
import SaveConfigSavings from './SaveCongfigSavings/SaveCongfigSavings';
import { useAppSelector } from '../../../../store/storeHooks';
import { useEffect, useState } from 'react';
import { setSaveConfigName } from '../../../../store/workloadFactory/exploreSavingsSlice';
import { useDispatch } from 'react-redux';
import { useSaveConfigDataMutation } from '../../../../utils/apiService';
import { LoadRecommendedConfig } from '../../../../components/CreateMsSql/Configuration/LoadConfiguration';
import { setIsLoadConfig, setIsLoading } from '../../../../store/mssql/msSqlActionSlice';

const TableLayout = ({ data }: any) => {
    return (
        <Grid className={styles['fsx-table-column']} style={{ marginBottom: 3 }}>
            <GridItem lg="4">
                <Text>{data.label}</Text>
            </GridItem>
            <GridItem lg="3">
                <Text bold>{data.value}</Text>
            </GridItem>
            <GridItem lg="5">
                <Text>{data.text}</Text>
            </GridItem>
        </Grid>
    );
};

const MSSQLAccordion = ({ printState }: any) => {
    const isMutliFsx = false;
    const dispatch = useDispatch();
    const [saveConfigData] = useSaveConfigDataMutation();
    const { storageSavingsLoading, storageSavingsResponse, selectedHostDetails } = useAppSelector(
        state => state.exploreSavings
    );
    const { setDialog, closeDialog } = useDialog();
    const navigate = useNavigate();
    const [fsxData, setFsxData] = useState({});
    const [msSqlInstance, setMsSqlInstance] = useState({});

    useEffect(() => {
        setFsxData(storageSavingsResponse?.fsxCalculation);
        // setMsSqlInstance(storageSavingsResponse?.mssqlInstance);
    }, [storageSavingsResponse]);

    useEffect(() => {
        const instanceTypelist = selectedHostDetails?.topology?.ec2Details?.map((inst: any) => inst?.instanceType);
        let mssqlInstanceData = {
            serverInstallationMode: selectedHostDetails?.recommendedInstance?.serverInstallationMode,
            serverEdition: selectedHostDetails?.recommendedInstance?.serverEdition,
            serverVersion: selectedHostDetails?.recommendedInstance?.serverVersion,
            instanceType: selectedHostDetails?.recommendedInstance?.instanceType
        };
        setMsSqlInstance(mssqlInstanceData);
    }, [selectedHostDetails]);

    const handleSaveConfiguration = (dialogFrom: any) => {
        setDialog(
            <DialogComponent
                header={'Save configuration'}
                content={
                    <SaveConfigSavings
                        description={
                            'You can save this Microsoft SQL Server on AWS Ec2 and FSx for ONTAP file system configuration and load the configuration later for a future deployment.'
                        }
                    />
                }
                primaryButton={GENERAL.SAVE}
                secondaryButton={GENERAL.CANCEL}
                callback={() => ExploreSaveConfiguration(dispatch, saveConfigData, closeDialog, msSqlInstance, fsxData)}
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
        setTimeout(() => {
            const data = setRecommendedConfig(msSqlInstance, fsxData);
            LoadRecommendedConfig(dispatch, data);
        }, 10);
    };

    return (
        <div className={styles.mssqlAccordion}>
            <DsAccordion
                id="1"
                title="Microsoft SQL Server on FSx for ONTAP"
                variant="Default"
                value=""
                isDisabled={storageSavingsLoading || selectedHostDetails?.loading}
                isExpanded={printState}
                headerActions={[
                    isMutliFsx ? (
                        <Popover
                            popoverClass={styles['popover']}
                            children={GENERAL.ES_SAVE_ERROR}
                            trigger="hover"
                            container={
                                <DsButton type="text" isDisabled={true}>
                                    {GENERAL.ES_SAVE_CONFIG}
                                </DsButton>
                            }
                        />
                    ) : (
                        <DsButton
                            type="text"
                            isDisabled={storageSavingsLoading || selectedHostDetails?.loading}
                            onClick={() => handleSaveConfiguration(FROM_DIALOG.SAVE_CONFIG)}
                        >
                            {GENERAL.ES_SAVE_CONFIG}
                        </DsButton>
                    ),
                    ,
                    <div style={{ height: '32px' }} className={styles.buttonContainer}>
                        <DsButton
                            type="button"
                            isDisabled={isMutliFsx || storageSavingsLoading || selectedHostDetails?.loading}
                            onClick={() => handleCreateClick()}
                        >
                            Create
                        </DsButton>
                    </div>
                ]}
                children={
                    isMutliFsx ? (
                        <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '2351px' }}>
                            <DsTypography variant="Semibold_14" style={{ marginBottom: '6px' }}>
                                {GENERAL.MS_SQL_TWO_INSTANCES}
                            </DsTypography>

                            {MSSQLServerInstance(msSqlInstance).map(
                                (data: { label: string; text: string; value: string }, index: number) => (
                                    <TableLayout data={data} key={index} />
                                )
                            )}
                            <DsTypography variant="Semibold_14" style={{ marginTop: '32px', marginBottom: '6px' }}>
                                FsxN 1
                            </DsTypography>
                            {calculatedFSXData(fsxData).map(
                                (data: { label: string; text: string; value: string }, index: number) => (
                                    <TableLayout data={data} key={index} />
                                )
                            )}

                            <DsTypography variant="Semibold_14" style={{ marginTop: '32px', marginBottom: '6px' }}>
                                FsxN 2
                            </DsTypography>
                            {calculatedFSXData(fsxData).map(
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
                            <DsTypography variant="Semibold_14" style={{ marginBottom: '6px' }}>
                                {GENERAL.MS_SQL_SINGLE_INSTANCES}
                            </DsTypography>

                            {MSSQLServerInstance(msSqlInstance).map(
                                (data: { label: string; text: string; value: string }, index: number) => (
                                    <TableLayout data={data} key={index} />
                                )
                            )}
                            <DsTypography variant="Semibold_14" style={{ marginTop: '32px', marginBottom: '6px' }}>
                                FsxN
                            </DsTypography>
                            {calculatedFSXData(fsxData).map(
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
