import {
    Table,
    useTable,
    Typography,
    TableTopBar,
    useDialog,
    Popover,
    Button,
    TooltipInfo
} from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import styles from './UndetectedHosts.module.scss';
import DialogComponent from '../../../common/Dialog/DialogComponent';
import { GENERAL } from '../../../utils/appConstants';
import UndetectedHostDialogContent from './UndetectedHostDialogContent/UndetectedHostDialogContent';
import UndetectedSecondDialog from './UndetectedSecondDialog/UndetectedSecondDialog';
import { useAppSelector } from '../../../store/storeHooks';
import { ReactComponent as Success } from '../../../assets/success.svg';
import { ReactComponent as ErrorIcon } from '../../../assets/error-icon.svg';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import { FSX_DEPLOYMENT_MODE, SSM_TROUBLESHOOTING_LINK } from '../../../utils/consts';
import { useResourceCredentialsMutation } from '../../../utils/apiService';

const UndetectedHosts = () => {
    const { setDialog, closeDialog } = useDialog();
    const unIdentifiableHosts = useAppSelector(state => state.inventory.unIdentifiableHosts);
    const isDiscoverInProgress = useAppSelector(state => state.inventory.discoveredHosts.discoverHostLoading);
    const { headerSelectedCred, headerSelectedRegion } = useAppSelector(state => state.headers);
    const [resourceCred] = useResourceCredentialsMutation();

    const handleFirstDialog = async (instanceId: string) => {
        try {
            const result: any = await resourceCred({
                credentialId: headerSelectedCred?.data?.credentialsId,
                regionId: headerSelectedRegion?.label2,
                instanceId: instanceId
            });
            if (result && !result?.error) {
                setTimeout(() => {
                    setDialog(
                        <DialogComponent
                            header={
                                <div className={styles.headerDialog}>
                                    <Typography variant="Regular_20">Detect host</Typography>
                                    <Typography variant="Semibold_14">Step 2 out of 2</Typography>
                                </div>
                            }
                            content={<UndetectedSecondDialog />}
                            primaryButton="Done"
                            callback={() => {}}
                        />
                    );
                }, 10);
            }
        } catch (error) {
            console.log("Error");
        }
        
    };

    const handleManageDetect = (rowData: any) => {
        setDialog(
            <DialogComponent
                header={
                    <div className={styles.headerDialog}>
                        <Typography variant="Regular_20">Detect host</Typography>
                        <Typography variant="Semibold_14">Step 1 / 2</Typography>
                    </div>
                }
                content={<UndetectedHostDialogContent />}
                primaryButton="Detect"
                secondaryButton={GENERAL.CANCEL}
                callback={() => handleFirstDialog(rowData?.instanceID)}
                closeCallback={() => {
                    closeDialog();
                }}
            />
        );
    };
    const lastColDetails = () => {
        return {
            id: '7',
            Header: '',
            accessor: '',
            width: '240px',
            renderCell: (cellData: any, rowData: any) => {
                return (
                    <>
                    {rowData?.ssm === 'connected' && 
                        <div
                            className={styles.detectManage}
                            onClick={() => {
                                handleManageDetect(rowData)
                            }}
                        >
                            <Typography variant="Regular_14" className={styles.textStyle}>
                                Detect host
                            </Typography>
                        </div>
                    }
                    </>
                    
                );
            }
        };
    };

    const notAvailable = () => {
        return (
            <Typography variant="Regular_13" className={styles.colText}>
                {GENERAL.NOT_AVAILABLE}
            </Typography>
        );
    };

    const UnidentifiedHostsColDefs: ColumnProps[] = [
        {
            Header: 'Database host name',
            accessor: 'name',
            id: '1',
            isSortable: true,
            width: '240px'
        },
        {
            Header: 'Instance name',
            accessor: 'instance',
            id: '2',
            isSortable: true,
            width: '240px'
        },
        {
            Header: 'Instance ID',
            accessor: 'instanceID',
            id: '3',
            width: '240px',
            isSortable: true
        },
        {
            id: '4',
            Header: GENERAL.DB_HOST_VPC,
            accessor: 'vpc',
            isSortable: true,
            width: '212px',
            renderCell: (cellData: any) => {
                return (
                    <>
                        {cellData?.name && (
                            <div className={styles.colText}>
                                <TooltipInfo onVisibleChange={function noRefCheck() {}}>
                                    {cellData?.cidrBlock}
                                </TooltipInfo>
                                <Typography variant="Regular_14">{cellData?.name}</Typography>
                            </div>
                        )}
                        {!cellData?.name && notAvailable()}
                    </>
                );
            }
        },
        {
            id: '5',
            Header: GENERAL.DB_HOST_AVAILABILITY,
            accessor: 'sqlServerInstances',
            isSortable: true,
            width: '209px',
            filterOptions: [
                { label: GENERAL.SINGLE_AZ, value: FSX_DEPLOYMENT_MODE.SINGLE_AZ_1 },
                { label: GENERAL.MULTI_AZ, value: FSX_DEPLOYMENT_MODE.MULTI_AZ_1 }
            ],
            renderCell: (cellData: any) => {
                const azList = cellData?.[0]?.deploymentTypes?.[0]?.zones
                    ? cellData?.[0]?.deploymentTypes?.[0]?.zones.join(',')
                    : '';
                const deploymentType = cellData?.[0]?.deploymentTypes?.[0]?.type;
                return (
                    <>
                        {deploymentType && (
                            <div className={styles.colText}>
                                <TooltipInfo onVisibleChange={function noRefCheck() {}}>{azList}</TooltipInfo>
                                <Typography variant="Regular_14">
                                    {deploymentType === FSX_DEPLOYMENT_MODE.SINGLE_AZ_1
                                        ? GENERAL.SINGLE_AZ
                                        : deploymentType === FSX_DEPLOYMENT_MODE.MULTI_AZ_1
                                        ? GENERAL.MULTI_AZ
                                        : ''}
                                </Typography>
                            </div>
                        )}
                        {!deploymentType && notAvailable()}
                    </>
                );
            }
        },
        {
            Header: 'SSM connectivity',
            accessor: 'ssm',
            id: '6',
            width: '226px',
            filterOptions: 'auto',
            renderCell: (cellData: any) => {
                return (
                    <div className={styles.statusCol}>
                        <div>
                            {cellData === 'connected' && <Success />}
                            {cellData !== 'connected' && (
                                <Popover
                                    popoverClass={CommonStyles['popover']}
                                    children={
                                        <div>
                                            <Typography variant="Regular_14">
                                                {GENERAL.SSM_NO_CONNECTION_MSG}
                                            </Typography>
                                            <Button
                                                variant="link"
                                                onClick={() =>
                                                    window.open(SSM_TROUBLESHOOTING_LINK, '_blank', 'noopener')
                                                }
                                            >
                                                {GENERAL.SSM_NO_CONNECTION_LINK}
                                            </Button>
                                        </div>
                                    }
                                    trigger="hover"
                                    container={<ErrorIcon className={styles.statusIcon} />}
                                    delayHide={200}
                                    interactive={true}
                                />
                            )}
                        </div>
                        <div>{cellData === 'connected' ? 'Online' : 'Connection lost'}</div>
                    </div>
                );
            }
        },
        lastColDetails()
    ];

    const formatUnIdentifiableData = (data: any) => {
        return data.map((item: any) => {
            return {
                name: item?.sqlServerInstances?.[0]?.sqlServerName || 'N/A',
                instance: item?.ec2InstanceName,
                instanceID: item?.ec2InstanceId,
                vpc: item?.vpc,
                ssm: item?.ssmState,
                sqlServerInstances: item?.sqlServerInstances
            };
        });
    };

    const tableProps = useTable({
        isSorting: false,
        selectionType: 'none',
        columns: UnidentifiedHostsColDefs,
        rows: formatUnIdentifiableData(unIdentifiableHosts) || [],
        pageSize: 10,
        isHorizontalScroll: true,
        isLazyLoading: isDiscoverInProgress
    });
    return (
        <div className={styles.undetectedHosts}>
            <div className={styles.table}>
                <TableTopBar
                    //@ts-ignore
                    tableProps={tableProps}
                    pluralTitle="Unidentifiable hosts"
                    singularTitle="Unidentifiable host"
                />
                <Table
                    //@ts-ignore
                    tableProps={tableProps}
                    isDoubleRow={true}
                />
            </div>
        </div>
    );
};

export default UndetectedHosts;
