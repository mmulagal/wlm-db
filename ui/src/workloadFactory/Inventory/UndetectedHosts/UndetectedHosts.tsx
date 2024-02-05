import { Table, useTable, Typography, TableTopBar, useDialog } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import styles from './UndetectedHosts.module.scss';
import DialogComponent from '../../../common/Dialog/DialogComponent';
import { GENERAL } from '../../../utils/appConstants';
import UndetectedHostDialogContent from './UndetectedHostDialogContent/UndetectedHostDialogContent';

const UndetectedHosts = () => {
    const { setDialog, closeDialog } = useDialog();
    const dummyData = [
        {
            name: 'N/A',
            id: '1',
            instance: 'Instance name 1',
            instanceID: '987654',
            vpc: 'vpc 1',
            availability: 'Single AZ',
            ssm: 'Online'
        },
        {
            name: 'N/A',
            id: '2',
            instance: 'Instance name 2',
            instanceID: '987654',
            vpc: 'vpc 2',
            availability: 'Single AZ',
            ssm: 'Online'
        },
        {
            name: 'N/A',
            id: '3',
            instance: 'Instance name 3',
            instanceID: '987654',
            vpc: 'vpc 3',
            availability: 'Single AZ',
            ssm: 'Online'
        },
        {
            name: 'N/A',
            id: '4',
            instance: 'Instance name 4',
            instanceID: '987654',
            vpc: 'vpc 4',
            availability: 'Single AZ',
            ssm: 'Online'
        },
        {
            name: 'N/A',
            id: '5',
            instance: 'Instance name 5',
            instanceID: '987654',
            vpc: 'vpc 5',
            availability: 'Single AZ',
            ssm: 'Online'
        },
        {
            name: 'N/A',
            id: '6',
            instance: 'Instance name 6',
            instanceID: '987654',
            vpc: 'vpc 6',
            availability: 'Single AZ',
            ssm: 'Online'
        },
        {
            name: 'N/A',
            id: '7',
            instance: 'Instance name 7',
            instanceID: '987654',
            vpc: 'vpc 7',
            availability: 'Single AZ',
            ssm: 'Online'
        }
    ];

    const handleManageDetect = (rowData: any) => {
        setDialog(
            <DialogComponent
                header="Detect & manage"
                content={<UndetectedHostDialogContent />}
                primaryButton="Detect & manage"
                secondaryButton={GENERAL.CANCEL}
                callback={() => {}}
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
                    <div className={styles.detectManage} onClick={() => handleManageDetect(rowData)}>
                        <Typography variant="Regular_14" className={styles.textStyle}>
                            Detect & manage
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
            filterOptions: 'auto'
        },
        lastColDetails()
    ];

    const tableProps = useTable({
        isSorting: false,
        selectionType: 'none',
        columns: UnidentifiedHostsColDefs,
        rows: dummyData || [],
        pageSize: 10,
        isHorizontalScroll: true
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
