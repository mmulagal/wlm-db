import { DsTypography, Popover } from '@netapp/design-system';
import { DsButton } from '@tlveng/wlm-ds';
import { ColumnProps, Table } from '../../../common/Lib/Table/Table';
import { TableTopBar } from '../../../common/Lib/Table/TableTopBar';
import { useTable } from '../../../common/Lib/Table/useTable';
import styles from './RegisteredResourcesTable.module.scss';

const RegisteredResourcesTable = () => {
    const tableData = [
        {
            id: '1',
            name: 'Resource 1',
            engineType: 'Microsoft SQL Server',
            hostName: 'host1',
            optimizationScore: 0
        },
        {
            id: '2',
            name: 'Resource 2',
            engineType: 'Oracle',
            hostName: 'host2',
            optimizationScore: 90
        },
        {
            id: '3',
            name: 'Resource 3',
            engineType: 'PostgreSQL',
            hostName: 'host3',
            optimizationScore: 75
        }
    ];

    const handleProgressBar = (cellData: number | string) => {
        if (
            cellData !== 0 &&
            // @ts-ignore
            cellData <= 1
        ) {
            return (
                <div className={styles.progressBar}>
                    <div
                        className={`${styles.progress} ${styles.leftCurveBar} ${styles.rightCurveBar}`}
                        style={{
                            width: `${100}%`,
                            backgroundColor: 'var(--chart-disabled)'
                        }}
                    />
                </div>
            );
        }
        if (
            cellData !== 0 &&
            // @ts-ignore
            cellData >= 1
        ) {
            return (
                <div className={styles.progressBar}>
                    <div
                        className={`${styles.progress} ${styles.leftCurveBar}`}
                        style={{
                            width: `${cellData}%`,
                            backgroundColor: 'var(--chart-4)'
                        }}
                    />
                    <div className={styles.separator} />
                    <div
                        className={`${styles.progress} ${styles.rightCurveBar}`}
                        style={{
                            width: `${100 - (Number(cellData) || 0)}%`,
                            backgroundColor: 'var(--chart-disabled)'
                        }}
                    />
                </div>
            );
        }

        if (cellData === 0) {
            return (
                <div className={styles.progressBar}>
                    <div
                        className={`${styles.progress} ${styles.leftCurveBar} ${styles.rightCurveBar}`}
                        style={{
                            width: `${100}%`,
                            backgroundColor: 'var(--chart-disabled)'
                        }}
                    />
                </div>
            );
        }
    };

    const TableColDefs: ColumnProps[] = [
        {
            Header: 'Resources name',
            accessor: 'name',
            id: '1',
            isSortable: true,
            width: '320px'
        },

        {
            Header: 'Engine type',
            accessor: 'engineType',
            id: '2',
            width: '267px',
            filterOptions: 'auto'
        },
        {
            Header: 'Host name',
            accessor: 'hostName',
            id: '3',
            width: '267px',
            isSortable: true
        },
        {
            Header: 'Optimization score',
            accessor: 'optimizationScore',
            id: '4',
            width: '347px',
            isSortable: true,
            renderCell: (cellData: string) => (
                <div className={styles.barContainer}>
                    {handleProgressBar(cellData)}
                    <div className={styles.scoreText}>
                        <DsTypography variant="Semibold_14">{cellData}</DsTypography>
                        <DsTypography variant="Semibold_14">%</DsTypography>
                    </div>
                </div>
            )
        },
        {
            Header: '',
            accessor: '',
            id: '5',
            width: '248px',
            isSortable: false,
            renderCell: (_: any, rowData: any) => (
                <div className={styles.buttonContainer}>
                    <div />
                    <Popover
                        isAppendedToBody
                        children={
                            <DsTypography variant="Regular_14">
                                Selecting 'View and Fix' will redirect you to the Inventory tab
                            </DsTypography>
                        }
                        trigger="hover"
                        delayHide={200}
                        interactive
                        container={
                            <DsButton variant="secondary" isDisabled isThin>
                                View and fix
                            </DsButton>
                        }
                    />
                </div>
            )
        }
    ];

    const tableProps = useTable({
        // @ts-ignore
        manageColumnsProps: false,
        isHorizontalScroll: true,
        isSorting: false,
        columns: TableColDefs,
        rows: tableData || [],
        pageSize: 50,
        selectionType: 'none'
    });
    return (
        <div className={styles['registered-resources']}>
            <TableTopBar
                // @ts-ignore
                tableProps={tableProps}
                pluralTitle="Registered resources"
                singularTitle="Registered resource"
            />

            <Table
                // @ts-ignore
                tableProps={tableProps}
                isDoubleRow
            />
        </div>
    );
};

export default RegisteredResourcesTable;
