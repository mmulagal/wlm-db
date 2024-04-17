import { Table, useTable } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import { DsTypography, DsFlashingDotsLoader } from '@netapp/design-system';
import styles from './SelectedVolumeSummary.module.scss';
import { useAppSelector } from '../../../../store/storeHooks';

const SelectedVolumeSummary = () => {
    const { loading } = useAppSelector(state => state.exploreSavings);
    const setSummaryHeader = {
        gp3: true,
        gp2: true,
        io1: true,
        io2: true
    };
    const data = [
        { details: 'Total volumes', gp3: 10, gp2: 10, io1: 10, io2: 10, id: '1' },
        {
            details: 'Total storage amount',
            gp3: '250.5 TiB',
            gp2: '250.5 TiB',
            io1: '250.5 TiB',
            io2: '250.5 TiB',
            id: '2'
        },
        { details: 'Total provisioned IOPS', gp3: 60000, gp2: 60000, io1: 60000, io2: 60000, id: '3' },
        { details: 'Total throughput MB/s', gp3: 3000, gp2: 3000, io1: 3000, io2: 3000, id: '4' }
    ];

    const InstanceColDefs: ColumnProps[] = [
        {
            Header: 'Details',
            accessor: 'details',
            id: '1',
            width: '190px'
        },

        {
            Header: 'gp3',
            accessor: 'gp3',
            id: '2',
            width: '96.5px',
            renderCell: (cellData: any, rowData: any) => {
                return loading ? (
                    <DsFlashingDotsLoader />
                ) : (
                    <DsTypography variant="Regular_14">{rowData.gp3}</DsTypography>
                );
            }
        },
        {
            Header: 'gp2',
            accessor: 'gp2',
            id: '3',
            width: '96.5px',
            renderCell: (cellData: any, rowData: any) => {
                return loading ? (
                    <DsFlashingDotsLoader />
                ) : (
                    <DsTypography variant="Regular_14">{rowData.gp2}</DsTypography>
                );
            }
        },
        {
            Header: 'io1',
            accessor: 'io1',
            id: '4',
            width: '96.5px',
            renderCell: (cellData: any, rowData: any) => {
                return loading ? (
                    <DsFlashingDotsLoader />
                ) : (
                    <DsTypography variant="Regular_14">{rowData.io1}</DsTypography>
                );
            }
        },
        {
            Header: 'io2',
            accessor: 'io2',
            id: '5',
            width: '96.5px',
            renderCell: (cellData: any, rowData: any) => {
                return loading ? (
                    <DsFlashingDotsLoader />
                ) : (
                    <DsTypography variant="Regular_14">{rowData.io2}</DsTypography>
                );
            }
        }
    ];

    const InstanceColDefsNoGp3: ColumnProps[] = [
        {
            Header: 'Details',
            accessor: 'details',
            id: '1',
            width: '190px'
        },

        {
            Header: 'gp2',
            accessor: 'gp2',
            id: '3',
            width: '128px',
            renderCell: (cellData: any, rowData: any) => {
                return loading ? (
                    <DsFlashingDotsLoader />
                ) : (
                    <DsTypography variant="Regular_14">{rowData.gp2}</DsTypography>
                );
            }
        },
        {
            Header: 'io1',
            accessor: 'io1',
            id: '4',
            width: '128px',
            renderCell: (cellData: any, rowData: any) => {
                return loading ? (
                    <DsFlashingDotsLoader />
                ) : (
                    <DsTypography variant="Regular_14">{rowData.io1}</DsTypography>
                );
            }
        },
        {
            Header: 'io2',
            accessor: 'io2',
            id: '5',
            width: '128px',
            renderCell: (cellData: any, rowData: any) => {
                return loading ? (
                    <DsFlashingDotsLoader />
                ) : (
                    <DsTypography variant="Regular_14">{rowData.io2}</DsTypography>
                );
            }
        }
    ];

    const InstanceColDefsNoGp3Gp2: ColumnProps[] = [
        {
            Header: 'Details',
            accessor: 'details',
            id: '1',
            width: '190px'
        },

        {
            Header: 'io1',
            accessor: 'io1',
            id: '4',
            width: '193px',
            renderCell: (cellData: any, rowData: any) => {
                return loading ? (
                    <DsFlashingDotsLoader />
                ) : (
                    <DsTypography variant="Regular_14">{rowData.io1}</DsTypography>
                );
            }
        },
        {
            Header: 'io2',
            accessor: 'io2',
            id: '5',
            width: '193px',
            renderCell: (cellData: any, rowData: any) => {
                return loading ? (
                    <DsFlashingDotsLoader />
                ) : (
                    <DsTypography variant="Regular_14">{rowData.io2}</DsTypography>
                );
            }
        }
    ];

    const InstanceColDefsOnlyIO2: ColumnProps[] = [
        {
            Header: 'Details',
            accessor: 'details',
            id: '1',
            width: '190px'
        },

        {
            Header: 'io2',
            accessor: 'io2',
            id: '5',
            width: '386px',
            renderCell: (cellData: any, rowData: any) => {
                return loading ? (
                    <DsFlashingDotsLoader />
                ) : (
                    <DsTypography variant="Regular_14">{rowData.io2}</DsTypography>
                );
            }
        }
    ];

    const setColumns = () => {
        if (setSummaryHeader.gp3 && setSummaryHeader.gp2 && setSummaryHeader.io1 && setSummaryHeader.io2) {
            return InstanceColDefs;
        } else if (!setSummaryHeader.gp3 && setSummaryHeader.gp2 && setSummaryHeader.io1 && setSummaryHeader.io2) {
            return InstanceColDefsNoGp3;
        } else if (!setSummaryHeader.gp3 && !setSummaryHeader.gp2 && setSummaryHeader.io1 && setSummaryHeader.io2) {
            return InstanceColDefsNoGp3Gp2;
        } else {
            return InstanceColDefsOnlyIO2;
        }
    };

    const tableProps = useTable({
        //@ts-ignore
        selectAllProps: false,
        //@ts-ignore
        manageColumnsProps: false,

        columns: setColumns(),
        rows: data,
        pageSize: 10
    });
    return (
        <div className={styles.selectedVolumeSummary}>
            <DsTypography variant="Regular_14">The selected volumes summary per volume type:</DsTypography>
            <div className={styles.instanceTable}>
                <Table
                    //@ts-ignore
                    tableProps={tableProps}
                    variant="innerTable"
                />
            </div>
        </div>
    );
};

export default SelectedVolumeSummary;
