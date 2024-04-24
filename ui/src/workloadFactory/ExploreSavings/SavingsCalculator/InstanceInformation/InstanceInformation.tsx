import { Table, useTable, DsFlashingDotsLoader } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import { DsTypography } from '@netapp/design-system';
import styles from './InstanceInformation.module.scss';
import { useAppSelector } from '../../../../store/storeHooks';
import { GENERAL } from '../../../../utils/appConstants';

const InstanceInformation = () => {
    const { loading } = useAppSelector(state => state.exploreSavings);

    const data = [
        { details: 'Instance type', value: 'M5.xlarge, C4.xlarge', id: '1' },
        { details: 'SQL Edition', value: 'SQL server enterprise edition', id: '2' },
        { details: 'Deployment model', value: 'Always on availability group', id: '3' }
    ];

    const InstanceColDefs: ColumnProps[] = [
        {
            Header: 'Details',
            accessor: 'details',
            id: '1',
            width: '190px',
            renderCell: (cellData: any, rowData: any) => {
                return (
                    <DsTypography variant="Regular_14" style={{ minWidth: '125px' }}>
                        {rowData.details}
                    </DsTypography>
                );
            }
        },

        {
            Header: 'Value',
            accessor: 'value',
            id: '2',
            width: '386px',
            renderCell: (cellData: any, rowData: any) => {
                return !loading ? (
                    <DsTypography variant="Regular_14" style={{ minWidth: '200px' }}>
                        {rowData.value}
                    </DsTypography>
                ) : (
                    <DsFlashingDotsLoader />
                );
            }
        }
    ];

    const tableProps = useTable({
        //@ts-ignore
        selectAllProps: false,
        //@ts-ignore
        manageColumnsProps: false,

        columns: InstanceColDefs,
        rows: data,
        pageSize: 10
    });
    return (
        <div className={styles.instanceInformation}>
            <DsTypography variant="Regular_14">{GENERAL.INSTANCE_INFORMATION}</DsTypography>
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

export default InstanceInformation;
