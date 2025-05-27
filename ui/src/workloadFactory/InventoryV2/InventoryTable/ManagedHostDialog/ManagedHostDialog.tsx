import { DsTypography, Table, useTable, TableTopBar } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';

import styles from './ManagedHostDialog.module.scss';
import DotComponent from '../../../../common/DotComponent/DotComponent';
import { useEffect, useRef, useState } from 'react';
import SmallLoader from '../../../../common/SmallLoader/SmallLoader';
import { INVENTORY_STATUS } from '../../../../utils/consts';
import { useAppSelector } from '../../../../store/storeHooks';
import { useDispatch } from 'react-redux';
import { setManageHostSelectedRows } from '../../../../store/workloadFactory/inventoryV2Slice';
import { GENERAL } from '../../../../utils/appConstants';
import { uniqueHostRow } from '../../InventoryUtilsV2';

const ManagedHostDialog = ({ dialogData }: any) => {
    const { inProgressInstances } = useAppSelector(state => state?.inventoryV2);

    const [data, setData] = useState<any>([]);

    const defaultRef: any = useRef();
    const dispatch = useDispatch();

    useEffect(() => {
        const dbInstances = dialogData?.sqlServerInstances;
        let output = dbInstances.map((obj: any) => {
            const isInstanceInProgress = inProgressInstances.has(
                uniqueHostRow(
                    `${dialogData?.ec2InstanceId}_${obj?.databaseInstanceName}`,
                    dialogData?.credentialId,
                    dialogData?.regionId
                )
            );
            if (
                isInstanceInProgress ||
                obj.statusColText === INVENTORY_STATUS.MANAGED ||
                obj.statusColText === INVENTORY_STATUS.UNDETECTED ||
                obj.fileSystemType !== GENERAL.FSX_FOR_ONTAP
            ) {
                let disabledText = '';
                if (obj.statusColText === INVENTORY_STATUS.UNDETECTED) {
                    disabledText = GENERAL.MANAGE_DISABLE_FOR_UNDETECTED;
                }
                if (obj.statusColText === INVENTORY_STATUS.MANAGED) {
                    disabledText = GENERAL.SQL_SERVER_MANAGED;
                }
                if (
                    obj.statusColText === INVENTORY_STATUS.UNMANAGED &&
                    obj?.status?.toLowerCase() === INVENTORY_STATUS.DOWN
                ) {
                    disabledText = GENERAL.SQL_SERVER_NOT_RUNNING;
                } else if (
                    obj.statusColText === INVENTORY_STATUS.UNMANAGED &&
                    obj.fileSystemType !== GENERAL.FSX_FOR_ONTAP
                ) {
                    disabledText = GENERAL.FSXN_MANAGE_SUPPORTED;
                }
                return {
                    ...obj,
                    cellProps: {
                        isDisabled: true,
                        selectionProps: {
                            title: disabledText,
                            titleProps: {
                                placement: 'bottom'
                            }
                        }
                    },
                    statusColText: isInstanceInProgress ? INVENTORY_STATUS.IN_PROGRESS : obj.statusColText,
                    storageType: dialogData?.storageType
                };
            } else {
                return { ...obj, cellProps: { isDisabled: false }, storageType: dialogData?.storageType };
            }
        });
        let defaultSelection = dbInstances.map((item: any) => {
            const isInstanceInProgress = inProgressInstances.has(
                `${dialogData?.ec2InstanceId}_${item?.databaseInstanceName}`
            );
            if (isInstanceInProgress || item.statusColText === INVENTORY_STATUS.MANAGED) {
                return item.id;
            }
        });

        defaultSelection = defaultSelection.filter(function (element: any) {
            return element !== undefined;
        });
        defaultRef.current = defaultSelection;

        setData(output);
    }, []);

    const managedHostDialogColDefs: ColumnProps[] = [
        {
            Header: 'SQL Server instance',
            accessor: 'databaseInstanceName',
            id: '1',
            isSortable: true,
            width: '212px',
            renderCell: (cellData: string, rowData: any) => {
                return <DsTypography variant="Regular_14">{cellData}</DsTypography>;
            }
        },
        {
            Header: 'Status',
            accessor: 'statusColText',
            id: '2',
            width: '192px',
            filterOptions: 'auto',
            renderCell: (cellData: string, rowData: any) => {
                if (rowData.statusColText === INVENTORY_STATUS.UNMANAGED) {
                    return <DotComponent color={'var(--toggle-off-bg)'} value={INVENTORY_STATUS.UNMANAGED} />;
                }
                if (rowData.statusColText === INVENTORY_STATUS.UNDETECTED) {
                    return <DotComponent color={'var(--toggle-off-bg)'} value={INVENTORY_STATUS.UNDETECTED} />;
                }
                if (rowData.statusColText === INVENTORY_STATUS.IN_PROGRESS) {
                    return (
                        <div className={styles.inProgress}>
                            <SmallLoader />
                            <DsTypography variant="Regular_14">{INVENTORY_STATUS.IN_PROGRESS}</DsTypography>
                        </div>
                    );
                }
                if (rowData.statusColText === INVENTORY_STATUS.MANAGED) {
                    return <DotComponent color={'var(--success)'} value={INVENTORY_STATUS.MANAGED} />;
                }
            }
        },
        {
            Header: 'Storage type',
            accessor: 'fileSystemType',
            id: '3',
            width: '180px',
            filterOptions: 'auto',
            renderCell: (cellData: string, rowData: any) => {
                return <DsTypography variant="Regular_14">{cellData || GENERAL.NOT_AVAILABLE}</DsTypography>;
            }
        },
        {
            Header: '',
            accessor: '',
            id: '4',
            width: '56px'
        }
    ];

    const tableProps = useTable({
        //@ts-ignore
        selectAllProps: false,
        //@ts-ignore
        manageColumnsProps: false,

        isSorting: false,
        selectionType: 'multiple',
        columns: managedHostDialogColDefs,
        rows: data,
        pageSize: 10,
        //@ts-ignore
        defaultSelectedRows: defaultRef.current
    });

    useEffect(() => {
        let selectedRows: any = [];
        const selectionStateRows: any = tableProps.selectionState?.rows;
        Object.keys(selectionStateRows).map(key => {
            if (selectionStateRows[key]) {
                selectedRows.push(data[parseInt(key)]);
            }
        });
        dispatch(setManageHostSelectedRows(selectedRows));
    }, [tableProps.selectionState, data]);

    return (
        <div className={styles.managedHostDialog}>
            <div className={styles.extraDiv} />
            {/* <TableTopBar
                //@ts-ignore
                tableProps={tableProps}
                pluralTitle={``}
                singularTitle={''}
            /> */}
            <Table
                //@ts-ignore
                tableProps={tableProps}
                variant="innerTable"
            />
        </div>
    );
};

export default ManagedHostDialog;
