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
import { SSM_TROUBLESHOOTING_LINK } from '../../../utils/consts';

const UndetectedHosts = () => {
    const { setDialog, closeDialog } = useDialog();
    const unIdentifiableHosts = useAppSelector(state => state.inventory.unIdentifiableHosts);
    const isDiscoverInProgress = useAppSelector(state => state.inventory.discoveredHosts.discoverHostLoading);

    const handleFirstDialog = () => {
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
                callback={handleFirstDialog}
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
                    <div
                        className={styles.detectManage}
                        onClick={() => {
                            //handleManageDetect(rowData)
                        }}
                    >
                        <Typography variant="Regular_14" className={styles.textStyle}>
                            Detect host
                        </Typography>
                    </div>
                );
            }
        };
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
            Header: 'VPC',
            accessor: 'vpc',
            id: '4',
            width: '200px',
            isSortable: true
        },
        {
            Header: 'Availability',
            accessor: 'availability',
            id: '5',
            width: '200px',
            filterOptions: 'auto'
        },
        {
            Header: 'SSM connectivity',
            accessor: 'ssm',
            id: '6',
            width: '246px',
            filterOptions: 'auto',
            renderCell: (cellData: any, rowData: any) => {
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
                name: item?.sqlServerInstances?.[0]?.sqlServerInstance,
                instance: item?.ec2InstanceName,
                instanceID: item?.ec2InstanceId,
                vpc: item?.vpcId,
                ssm: item?.ssmState
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
