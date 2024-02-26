import { Table, useTable, Typography, TableTopBar, useDialog } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import styles from './UndetectedHosts.module.scss';
import DialogComponent from '../../../common/Dialog/DialogComponent';
import { GENERAL } from '../../../utils/appConstants';
import UndetectedHostDialogContent from './UndetectedHostDialogContent/UndetectedHostDialogContent';
import UndetectedSecondDialog from './UndetectedSecondDialog/UndetectedSecondDialog';
import { useAppSelector } from '../../../store/storeHooks';

const UndetectedHosts = () => {
    const { setDialog, closeDialog } = useDialog();
    const unIdentifiableHosts = useAppSelector(state => state.inventory.unIdentifiableHosts);

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
                    <div className={styles.detectManage} onClick={() => handleManageDetect(rowData)}>
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
            filterOptions: 'auto'
        },
        lastColDetails()
    ];

    const tableProps = useTable({
        isSorting: false,
        selectionType: 'none',
        columns: UnidentifiedHostsColDefs,
        rows: unIdentifiableHosts || [],
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
