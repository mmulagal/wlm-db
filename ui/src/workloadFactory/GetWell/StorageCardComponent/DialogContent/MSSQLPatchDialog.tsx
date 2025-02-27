import { Button, DsTypography } from '@netapp/design-system';
import { Table, useTable, Typography } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import styles from './DialogContent.module.scss';
import { GENERAL } from '../../../../utils/appConstants';

const MSSQLPatchDialog = () => {
    const tableData = [
        { id: '1', kb: 'KB 1', name: 'name 1', classification: 'Classification 1', severity: 'Critical' },
        { id: '2', kb: 'KB 2', name: 'name 2', classification: 'Classification 2', severity: 'High' },
        { id: '3', kb: 'KB 3', name: 'name 3', classification: 'Classification 3', severity: 'Medium' },
        { id: '4', kb: 'KB 4', name: 'name 4', classification: 'Classification 4', severity: 'Low' },
        { id: '5', kb: 'KB 5', name: 'name 5', classification: 'Classification 5', severity: 'Critical' },
        { id: '6', kb: 'KB 6', name: 'name 6', classification: 'Classification 6', severity: 'High' }
    ];
    const EncryptionColDefs: ColumnProps[] = [
        {
            Header: 'KB',
            accessor: 'kb',
            id: '1',
            isSortable: true,
            width: '157px'
        },
        {
            Header: 'Name',
            accessor: 'name',
            id: '2',
            isSortable: true,
            width: '174px'
        },
        {
            Header: 'Classification',
            accessor: 'classification',
            id: '3',
            isSortable: true,
            width: '206px'
        },
        {
            Header: 'Severity',
            accessor: 'severity',
            id: '4',
            isSortable: true,
            width: '174px'
        }
    ];

    const tableProps = useTable({
        //@ts-ignore
        selectAllProps: false,
        //@ts-ignore
        manageColumnsProps: false,

        isSorting: false,
        selectionType: 'none',
        columns: EncryptionColDefs,
        rows: tableData,
        pageSize: 50
    });
    return (
        <div className={styles['storage-tier-block']}>
            <div className={styles['first-section']}>
                <DsTypography variant="Semibold_14">Action summary</DsTypography>
                <DsTypography variant="Regular_14">
                    Workload Factory has identified missing MSSQL patches that must be installed to ensure your system's
                    security and performance. Installation should be done manually according to the organization's
                    policies using tools such as AWS Systems Manager or SQL Server Management Studio (SSMS).
                </DsTypography>
            </div>

            <div className={styles['first-section']}>
                <DsTypography variant="Semibold_14" style={{ width: '712px' }}>
                    Missing patches
                </DsTypography>
                <div className={styles.table}>
                    <Table
                        //@ts-ignore
                        tableProps={tableProps}
                        variant="innerTable"
                    />
                </div>
            </div>

            <div className={styles['first-section']}>
                <DsTypography variant="Semibold_14" style={{ width: '712px' }}>
                    Action required
                </DsTypography>
                <div className={styles.content}>
                    <div className={styles.row}>
                        <DsTypography variant="Regular_14">
                            Please follow the steps below to install the missing patches:
                        </DsTypography>
                    </div>
                    <div className={styles.row}>
                        <Button onClick={() => {}} variant="link">
                            View missing patches list
                        </Button>
                    </div>
                </div>
            </div>

            <div className={styles['action-section']}>
                <div className={styles.row}>
                    <DsTypography variant="Semibold_14">1</DsTypography>
                    <DsTypography variant="Regular_14">|</DsTypography>
                    <DsTypography variant="Regular_14">Open SQL Server Management Studio on your server.</DsTypography>
                </div>

                <div className={styles.row}>
                    <DsTypography variant="Semibold_14">2</DsTypography>
                    <DsTypography variant="Regular_14">|</DsTypography>
                    <DsTypography variant="Regular_14">Connect to your MSSQL instance.</DsTypography>
                </div>

                <div className={styles.row}>
                    <DsTypography variant="Semibold_14">3</DsTypography>
                    <DsTypography variant="Regular_14">|</DsTypography>
                    <DsTypography variant="Regular_14">
                        Navigate to the "Management" node and select "Maintenance Plans".
                    </DsTypography>
                </div>

                <div className={styles.row}>
                    <DsTypography variant="Semibold_14">4</DsTypography>
                    <DsTypography variant="Regular_14">|</DsTypography>
                    <DsTypography variant="Regular_14">
                        Create a new maintenance plan for applying patches.
                    </DsTypography>
                </div>

                <div className={styles.row}>
                    <DsTypography variant="Semibold_14">5</DsTypography>
                    <DsTypography variant="Regular_14">|</DsTypography>
                    <DsTypography variant="Regular_14">
                        Follow the steps to apply the missing patches listed above according to your organization’s
                        policies.
                    </DsTypography>
                </div>

                <div className={styles.row}>
                    <DsTypography variant="Semibold_14">6</DsTypography>
                    <DsTypography variant="Regular_14">|</DsTypography>
                    <DsTypography variant="Regular_14">
                        Ensure that all patches are successfully installed.
                    </DsTypography>
                </div>
            </div>

            <div className={styles['first-section']}>
                <DsTypography variant="Semibold_14" style={{ width: '712px' }}>
                    {GENERAL.NOTE}
                </DsTypography>
                <div className={styles.content}>
                    <div className={styles.row}>
                        <DsTypography variant="Regular_14">
                            It is recommended that these updates are performed during a maintenance window to minimize
                            any potential disruption to your services.
                        </DsTypography>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MSSQLPatchDialog;
