import { DsAccordion, DsButton, DsTypography, Popover, useDialog } from '@netapp/design-system';
import styles from './MSSQLAccordion.module.scss';
import { MSSQLServerInstance, calculatedFSXData } from '../savingsUtil';
import { Grid, GridItem } from '../../../../ui-components/Layout/Grid';
import { useNavigate } from 'react-router-dom';
import { Text } from '../../../../ui-components/Typography';
import { FROM_DIALOG, WLF_TO_FORM_NAVIGATE } from '../../../../utils/consts';
import DialogComponent from '../../../../common/Dialog/DialogComponent';
import { GENERAL } from '../../../../utils/appConstants';
import SaveConfigSavings from './SaveCongfigSavings/SaveCongfigSavings';
import { useAppSelector } from '../../../../store/storeHooks';

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

const MSSQLAccordion = () => {
    const isMutliFsx = false;
    const { loading } = useAppSelector(state => state.exploreSavings);
    const { setDialog, closeDialog } = useDialog();
    const navigate = useNavigate();
    const fsxData = {
        regionName: 'US East (Ohio) | us-east-2',
        deploymentType: 'Single',
        totalStorageCapacity: '100 TiB',
        precentageSSD: '20',
        savings: '65',
        useCase: 'Online archive',
        effectiveCapacity: 35,
        capacityPoolTier: 28,
        ssdTierReqCapacity: 7,
        ssdIop: '60,000',
        throughputCapacity: '1,024',
        numberOfVolumes: 20,
        throughput: 10,
        monthlySnapshotCapacity: '900'
    };

    const msSqlInstance = {
        deploymentMode: 'Failover cluster instance(FCI)',
        edition: 'SQL Server Standard Edition',
        serverType: 'SQL Server 2019',
        instance: ' m5.xlarge'
    };

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
                callback={() => console.log('saved')}
                closeCallback={() => {
                    // dispatch(setSaveConfigName(''));
                }}
                dialogFrom={dialogFrom}
                customClass={styles.setWidth}
            />
        );
    };
    return (
        <div className={styles.mssqlAccordion}>
            <DsAccordion
                id="1"
                title="Microsoft SQL Server on FSx for ONTAP"
                variant="Default"
                value=""
                isDisabled={loading}
                headerActions={[
                    isMutliFsx ? (
                        <Popover
                            popoverClass={styles['popover']}
                            children={'This configuration can not be save'}
                            trigger="hover"
                            container={
                                <DsButton type="text" isDisabled={true}>
                                    Save configuration
                                </DsButton>
                            }
                        />
                    ) : (
                        <DsButton
                            type="text"
                            isDisabled={loading}
                            onClick={() => handleSaveConfiguration(FROM_DIALOG.SAVE_CONFIG)}
                        >
                            Save configuration
                        </DsButton>
                    ),
                    ,
                    <div style={{ height: '32px' }} className={styles.buttonContainer}>
                        <DsButton
                            type="button"
                            isDisabled={isMutliFsx || loading}
                            onClick={() => navigate(WLF_TO_FORM_NAVIGATE)}
                        >
                            Create
                        </DsButton>
                    </div>
                ]}
                children={
                    isMutliFsx ? (
                        <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '2351px' }}>
                            <DsTypography variant="Semibold_14" style={{ marginBottom: '6px' }}>
                                Microsoft SQL Server EC2 instance - 2 instances
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
                                Microsoft SQL Server EC2 instance
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
