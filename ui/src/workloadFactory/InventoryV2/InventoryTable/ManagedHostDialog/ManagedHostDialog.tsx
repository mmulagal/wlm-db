import { DsTypography, Table, useTable } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';

import styles from './ManagedHostDialog.module.scss';
import DotComponent from '../../../../common/DotComponent/DotComponent';
import { useEffect, useRef, useState } from 'react';
import SmallLoader from '../../../../common/SmallLoader/SmallLoader';
import { INVENTORY_STATUS } from '../../../../utils/consts';

const ManagedHostDialog = ({ dialogData }: any) => {
    const [data, setData] = useState<any>([]);

    const defaultRef: any = useRef();

    useEffect(() => {
        let output = dialogData.map((obj: any) => {
            if (obj.status === 'inProgress' || obj.status === 'managed') {
                return { ...obj, cellProps: { isDisabled: true } };
            } else {
                return { ...obj, cellProps: { isDisabled: false } };
            }
        });
        let defaultSelection = dialogData.map((item: any) => {
            if (item.status === 'inProgress' || item.status === 'managed') {
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
            accessor: 'serverInstance',
            id: '1',
            isSortable: true,
            width: '212px',
            renderCell: (cellData: string, rowData: any) => {
                return <DsTypography variant="Regular_14">{cellData}</DsTypography>;
            }
        },
        {
            Header: 'Status',
            accessor: 'status',
            id: '2',
            width: '192px',
            filterOptions: 'auto',
            renderCell: (cellData: string, rowData: any) => {
                if (rowData.status === INVENTORY_STATUS.UNMANAGED) {
                    return <DotComponent color={'var(--toggle-off-bg)'} value={INVENTORY_STATUS.UNMANAGED} />;
                }
                if (rowData.status === 'inProgress') {
                    return (
                        <div className={styles.inProgress}>
                            <SmallLoader />
                            <DsTypography variant="Regular_14">In progress</DsTypography>
                        </div>
                    );
                }
                if (rowData.status === 'managed') {
                    return <DotComponent color={'var(--success)'} value={INVENTORY_STATUS.MANAGED} />;
                }
            }
        },
        {
            Header: 'Storage type',
            accessor: 'storageType',
            id: '3',
            width: '180px',
            filterOptions: 'auto',
            renderCell: (cellData: string, rowData: any) => {
                return <DsTypography variant="Regular_14">{cellData}</DsTypography>;
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

    return (
        <div className={styles.managedHostDialog}>
            <Table
                //@ts-ignore
                tableProps={tableProps}
                variant="innerTable"
            />
        </div>
    );
};

export default ManagedHostDialog;
