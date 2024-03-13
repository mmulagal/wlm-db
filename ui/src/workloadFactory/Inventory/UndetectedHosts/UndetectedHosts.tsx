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
import { DETECT_HOST_VAR, FROM_DIALOG, FSX_DEPLOYMENT_MODE, SSM_TROUBLESHOOTING_LINK } from '../../../utils/consts';
import { useRegisterResourceCredentialsMutation } from '../../../utils/apiService';
import { setIsDetectHostError, setIsDetectHostLoading } from '../../../store/mssql/msSqlActionSlice';
import { useDispatch } from 'react-redux';
import { setDetectManagePassword, setDetectManageUserName, setDetectONTAPPassword, setDetectONTAPUserName } from '../../../store/workloadFactory/inventorySlice';
import { createDetectHostPayload } from '../../../utils/utilityFunctions';

const UndetectedHosts = () => {
    const dispatch = useDispatch();
    
    const { setDialog, closeDialog } = useDialog();
    const unIdentifiableHosts = useAppSelector(state => state.inventory.unIdentifiableHosts);
    const isDiscoverInProgress = useAppSelector(state => state.inventory.discoveredHosts.discoverHostLoading);
    const { headerSelectedCred, headerSelectedRegion } = useAppSelector(state => state.headers);

    const [registerResourceCred] = useRegisterResourceCredentialsMutation();

    const handleRegisterResourceCred = async (rowData: any, fsxId: string) => {
        dispatch(setIsDetectHostLoading(true));
        
        try {
            const result: any = await registerResourceCred({
                credentialId: headerSelectedCred?.data?.credentialsId,
                regionId: headerSelectedRegion?.label2,
                instanceId: rowData?.instanceId,
                payload: createDetectHostPayload(rowData?.instanceID, fsxId)
            });
            if (result && !result?.error) {
                dispatch(setIsDetectHostLoading(false));
                setTimeout(() => {
                    setDialog(
                        <DialogComponent
                            header={
                                <div className={styles.headerDialog}>
                                    <Typography variant="Regular_20">{GENERAL.DETECT_HOST}</Typography>
                                    <Typography variant="Semibold_14">{GENERAL.DETECT_HOST_STEPS[1]}</Typography>
                                </div>
                            }
                            content={<UndetectedSecondDialog data={rowData} />}
                            primaryButton={GENERAL.DONE}
                            callback={() => {}}
                        />
                    );
                }, 1);
                resetDialogValues();
            } else {
                dispatch(setIsDetectHostError(GENERAL.FAILED_TO_DETECT_HOST));
                dispatch(setIsDetectHostLoading(false));
            }
        } catch (error) {
            dispatch(setIsDetectHostLoading(false));
        }
    };

    const resetDialogValues = () => {
        dispatch(setIsDetectHostError(''));
        dispatch(setDetectManageUserName(''));
        dispatch(setDetectManagePassword(''));
        dispatch(setDetectONTAPUserName(''));
        dispatch(setDetectONTAPPassword(''));
    };

    const handleManageDetect = (rowData: any) => {
        dispatch(setIsDetectHostError(''));
        let fsxId = '';
        if (rowData?.sqlServerInstances?.[0]?.storage) {
            rowData?.sqlServerInstances?.[0]?.storage.map((storageObj: any) => {
                if (storageObj.type === DETECT_HOST_VAR.FSXN) {
                    fsxId = storageObj.id;
                }
            });
        };
        
        setDialog(
            <DialogComponent
                header={
                    <div className={styles.headerDialog}>
                        <Typography variant="Regular_20">{GENERAL.DETECT_HOST}</Typography>
                        <Typography variant="Semibold_14">{GENERAL.DETECT_HOST_STEPS[0]}</Typography>
                    </div>
                }
                content={<UndetectedHostDialogContent rowData={rowData} fsxId={fsxId} />}
                primaryButton={GENERAL.DETECT}
                secondaryButton={GENERAL.CANCEL}
                callback={() => handleRegisterResourceCred(rowData, fsxId)}
                closeCallback={() => {
                    closeDialog();
                    resetDialogValues();
                }}
                dialogFrom={FROM_DIALOG.DETECT_HOST}
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
                    {rowData?.ssm === DETECT_HOST_VAR.SSM_CONNECTED && 
                        <div
                            className={styles.detectManage}
                            onClick={() => {
                                handleManageDetect(rowData)
                            }}
                        >
                            <Typography variant="Regular_14" className={styles.textStyle}>
                                {GENERAL.DETECT_HOST}
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
            Header: GENERAL.DATABASE_HOST_NAME,
            accessor: 'name',
            id: '1',
            isSortable: true,
            width: '240px'
        },
        {
            Header: GENERAL.DB_HOST_INSTANCE_NAME,
            accessor: 'instance',
            id: '2',
            isSortable: true,
            width: '240px'
        },
        {
            Header: GENERAL.DB_HOST_INSTANCE_ID,
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
            Header: GENERAL.SSM_CONNECTIVITY,
            accessor: 'ssm',
            id: '6',
            width: '226px',
            filterOptions: 'auto',
            renderCell: (cellData: any) => {
                return (
                    <div className={styles.statusCol}>
                        <div>
                            {cellData === DETECT_HOST_VAR.SSM_CONNECTED && <Success />}
                            {cellData !== DETECT_HOST_VAR.SSM_CONNECTED && (
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
                        <div>{cellData === DETECT_HOST_VAR.SSM_CONNECTED ? GENERAL.SSM_ONLINE : GENERAL.SSM_CONNECTION_LOST}</div>
                    </div>
                );
            }
        },
        lastColDetails()
    ];

    const formatUnIdentifiableData = (data: any) => {
        return data.map((item: any) => {
            return {
                name: item?.sqlServerInstances?.[0]?.sqlServerName || GENERAL.NOT_AVAILABLE,
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
                    pluralTitle={GENERAL.UNIDENTIFIABLE_HOSTS}
                    singularTitle={GENERAL.UNIDENTIFIABLE_HOST}
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
