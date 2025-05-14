import { DsTypography, Table, useTable } from '@netapp/design-system';
import styles from './DetectHeader.module.scss';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import { ReactComponent as Success } from '../../../../../../assets/success.svg';
import { ReactComponent as Cross } from '../../../../../../assets/black-cross.svg';

const DetectedInstanceTable = () => {
    const mockData = [
        {
            id: '1',
            instanceName: 'instance1',
            hostName: 'host1',
            readinessStatus: 'Ready'
        },
        {
            id: '2',
            instanceName: 'instance2',
            hostName: 'host2',
            readinessStatus: 'Not Ready'
        },
        {
            id: '3',
            instanceName: 'instance3',
            hostName: 'host3',
            readinessStatus: 'Ready'
        }
    ];

    const ColDefs: ColumnProps[] = [
        {
            id: '1',
            Header: 'Instance name',
            accessor: 'instanceName',
            width: '310px',
            isSortable: true
        },
        {
            id: '2',
            Header: 'Host name',
            accessor: 'hostName',
            width: '310px',
            filterOptions: 'auto'
        },
        {
            id: '3',
            Header: `Readiness status`,
            accessor: 'readinessStatus',
            width: '310px',
            filterOptions: 'auto',
            renderCell: (cellData: any, rowData: any) => {
                return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {cellData === 'Ready' ? <Success /> : <Cross />}
                        <DsTypography variant="Regular_14">{cellData}</DsTypography>
                    </div>
                );
            }
        }
    ];

    const tableProps = useTable({
        //@ts-ignore
        selectAllProps: false,
        //@ts-ignore
        manageColumnsProps: false,
        isSorting: false,
        selectionType: 'none',
        columns: ColDefs,
        rows: mockData,
        isHorizontalScroll: false,
        isVerticalScroll: true,
        isLazyLoading: false
    });

    return (
        <div className={styles.table}>
            <Table
                //@ts-ignore
                tableProps={tableProps}
                isDoubleRow={true}
                variant="innerTable"
            />
        </div>
    );
};

export default DetectedInstanceTable;
