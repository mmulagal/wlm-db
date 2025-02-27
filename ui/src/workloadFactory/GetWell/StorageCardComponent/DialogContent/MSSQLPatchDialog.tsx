import { Button, DsTypography } from '@netapp/design-system';
import { Table, useTable, Typography } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import styles from './DialogContent.module.scss';
import { GENERAL } from '../../../../utils/appConstants';

type MSSQLPatchDialogProps = {
    type: string;
    missingPatchList?: Array<any>;
};

const MSSQLPatchDialog = ({ type, missingPatchList = [] }: MSSQLPatchDialogProps) => {
    const tableData = missingPatchList?.map((item, index) => {
        return {
            ...item,
            id: index
        };
    });

    const EncryptionColDefs: ColumnProps[] = [
        {
            Header: 'KB',
            accessor: 'kbId',
            id: '1',
            isSortable: true,
            width: '137px'
        },
        {
            Header: 'Name',
            accessor: 'title',
            id: '2',
            isSortable: true,
            width: '262px'
        },
        {
            Header: 'Classification',
            accessor: 'classification',
            id: '3',
            isSortable: true,
            width: '164px'
        },
        {
            Header: 'Severity',
            accessor: 'severity',
            id: '4',
            isSortable: true,
            width: '144px'
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
                    {type === 'mssqlPatch'
                        ? "Workload Factory has identified missing MSSQL patches that must be installed to ensure your system's security and performance. Installation should be done manually according to the organization's policies using tools such as AWS Systems Manager or SQL Server Management Studio (SSMS)."
                        : "Workload Factory has identified missing MSSQL patches that must be installed to ensure your system's security and performance. Installation should be done manually according to the organization's policies using tools such as AWS Systems Manager or SQL Server Management Studio (SSMS)."}
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
                </div>
            </div>

            {type === 'osPatch' && (
                <>
                    <div className={styles['first-section']}>
                        <DsTypography variant="Semibold_14" style={{ width: '712px' }}>
                            Option 1: Using AWS Patch Manager
                        </DsTypography>
                        <div className={styles['action-section']}>
                            <div className={styles.row}>
                                <DsTypography variant="Semibold_14">1</DsTypography>
                                <DsTypography variant="Regular_14">|</DsTypography>
                                <DsTypography variant="Regular_14">Sign in to the AWS Management Console.</DsTypography>
                            </div>

                            <div className={styles.row}>
                                <DsTypography variant="Semibold_14">2</DsTypography>
                                <DsTypography variant="Regular_14">|</DsTypography>
                                <DsTypography variant="Regular_14">Open the AWS Systems Manager console.</DsTypography>
                            </div>

                            <div className={styles.row}>
                                <DsTypography variant="Semibold_14">3</DsTypography>
                                <DsTypography variant="Regular_14">|</DsTypography>
                                <DsTypography variant="Regular_14">
                                    In the navigation pane, choose Patch Manager.
                                </DsTypography>
                            </div>

                            <div className={styles.row}>
                                <DsTypography variant="Semibold_14">4</DsTypography>
                                <DsTypography variant="Regular_14">|</DsTypography>
                                <DsTypography variant="Regular_14">
                                    Select the instances you want to patch.
                                </DsTypography>
                            </div>

                            <div className={styles.row}>
                                <DsTypography variant="Semibold_14">5</DsTypography>
                                <DsTypography variant="Regular_14">|</DsTypography>
                                <DsTypography variant="Regular_14">
                                    Apply the missing patches according to your organization’s policies.
                                </DsTypography>
                            </div>
                        </div>
                    </div>

                    <div className={styles['first-section']}>
                        <DsTypography variant="Semibold_14" style={{ width: '712px' }}>
                            Option 2: Using Windows Server Update Services (WSUS)
                        </DsTypography>
                        <div className={styles['action-section']}>
                            <div className={styles.row}>
                                <DsTypography variant="Semibold_14">1</DsTypography>
                                <DsTypography variant="Regular_14">|</DsTypography>
                                <DsTypography variant="Regular_14">
                                    Open the WSUS Administration Console on your server.
                                </DsTypography>
                            </div>

                            <div className={styles.row}>
                                <DsTypography variant="Semibold_14">2</DsTypography>
                                <DsTypography variant="Regular_14">|</DsTypography>
                                <DsTypography variant="Regular_14">
                                    In the navigation pane, expand Update Services and select your WSUS server.
                                </DsTypography>
                            </div>

                            <div className={styles.row}>
                                <DsTypography variant="Semibold_14">3</DsTypography>
                                <DsTypography variant="Regular_14">|</DsTypography>
                                <DsTypography variant="Regular_14">Click on Updates.</DsTypography>
                            </div>

                            <div className={styles.row}>
                                <DsTypography variant="Semibold_14">4</DsTypography>
                                <DsTypography variant="Regular_14">|</DsTypography>
                                <DsTypography variant="Regular_14">
                                    Search for the missing patches listed above.
                                </DsTypography>
                            </div>

                            <div className={styles.row}>
                                <DsTypography variant="Semibold_14">5</DsTypography>
                                <DsTypography variant="Regular_14">|</DsTypography>
                                <DsTypography variant="Regular_14">
                                    Approve the patches for installation according to your organization’s policies.
                                </DsTypography>
                            </div>

                            <div className={styles.row}>
                                <DsTypography variant="Semibold_14">6</DsTypography>
                                <DsTypography variant="Regular_14">|</DsTypography>
                                <DsTypography variant="Regular_14">
                                    Verify that all patches are successfully installed.
                                </DsTypography>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {type === 'mssqlPatch' && (
                <div className={styles['action-section']}>
                    <div className={styles.row}>
                        <DsTypography variant="Semibold_14">1</DsTypography>
                        <DsTypography variant="Regular_14">|</DsTypography>
                        <DsTypography variant="Regular_14">
                            Open SQL Server Management Studio on your server.
                        </DsTypography>
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
            )}

            <div className={styles['first-section']}>
                <DsTypography variant="Semibold_14" style={{ width: '712px' }}>
                    {GENERAL.NOTE}
                </DsTypography>
                <div className={styles.content}>
                    <div className={styles.row}>
                        <DsTypography variant="Regular_14">
                            {type === 'mssqlPatch'
                                ? 'It is recommended that these updates are performed during a maintenance window to minimize any potential disruption to your services.'
                                : 'It is recommended to perform these updates during a maintenance window to minimize any potential disruption to your services.'}
                        </DsTypography>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MSSQLPatchDialog;
