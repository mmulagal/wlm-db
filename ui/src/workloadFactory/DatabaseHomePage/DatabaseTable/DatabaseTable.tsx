import { Table, TableTopBar, Typography, useTable } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import styles from './Database.module.scss';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import { ReactComponent as ProtectedIcon} from '@netapp/icons/ic_protected.svg';
import { ReactComponent as NotProtectedIcon} from '@netapp/icons/ic_unprotected.svg';
import { ReactComponent as InfoIcon} from '@netapp/icons/ic_info_tooltip.svg';
import { ReactComponent as TableAction} from '@netapp/icons/ic_table_action.svg';
import { useState } from 'react';

const DatabaseTable = () => {

    const databaseTableData: any[] = [
        {
            id: 1,
            databaseHostName: 'Database hostname 1',
            status: 'Up',
            protection: 'Protected',
            performance: 'High ( < 10 ms )',
            storageSavings: '82% (1.124 TiB)',
            estimatedCost: '$1024',
            type: 'Micrososft SQL Server',
            deploymentModel: 'fci',
            region: 'US East (N.Virginia)',
            fileSystemType: 'FSx ONTAP'

        },
        {   id: 2,
            databaseHostName: 'Database hostname 2',
            status: 'Up',
            protection: 'Protected',
            performance: 'Medium ( < 20 ms )',
            storageSavings: '82% (1.124 TiB)',
            estimatedCost: '$1024',
            type: 'Micrososft SQL Server',
            deploymentModel: 'fci',
            region: 'US East (N.Virginia)',
            fileSystemType: 'EBS'
        },
        {
            id: 3,
            databaseHostName: 'Database hostname 3',
            status: 'Down',
            protection: 'Not protected',
            performance: 'Low ( < 100 ms )',
            storageSavings: '82% (1.124 TiB)',
            estimatedCost: '$1024',
            type: 'Micrososft SQL Server',
            deploymentModel: 'standalone',
            region: 'US East (N.Virginia)',
            fileSystemType: 'FSx Windows'
        },
        {
            id: 4,
            databaseHostName: 'Database hostname 4',
            status: 'Down',
            protection: 'Not protected',
            performance: 'Low ( < 100 ms )',
            storageSavings: '82% (1.124 TiB)',
            estimatedCost: '$1024',
            type: 'Micrososft SQL Server',
            deploymentModel: 'standalone',
            region: 'US East (N.Virginia)',
            fileSystemType: 'FSx Windows'
        },
        {
            id: 5,
            databaseHostName: 'Database hostname 5',
            status: 'Initializing',
            protection: 'Protected',
            performance: 'Low ( < 100 ms )',
            storageSavings: '82% (1.124 TiB)',
            estimatedCost: '$1024',
            type: 'Micrososft SQL Server',
            deploymentModel: 'standalone',
            region: 'US East (N.Virginia)',
            fileSystemType: 'FSx Windows'
        },
        {
            id: 6,
            databaseHostName: 'Database hostname 6',
            status: 'Initializing',
            protection: 'Protected',
            performance: 'Low ( < 100 ms )',
            storageSavings: '82% (1.124 TiB)',
            estimatedCost: '$1024',
            type: 'Micrososft SQL Server',
            deploymentModel: 'standalone',
            region: 'US East (N.Virginia)',
            fileSystemType: 'FSx Windows'
        },
        {
            id: 7,
            databaseHostName: 'Database hostname 7',
            status: 'Up',
            protection: 'Protected',
            performance: 'High ( < 10 ms )',
            storageSavings: '82% (1.124 TiB)',
            estimatedCost: '$1024',
            type: 'Micrososft SQL Server',
            deploymentModel: 'fci',
            region: 'US East (N.Virginia)',
            fileSystemType: 'FSx ONTAP'

        },
        {   id: 8,
            databaseHostName: 'Database hostname 8',
            status: 'Up',
            protection: 'Protected',
            performance: 'Medium ( < 20 ms )',
            storageSavings: '82% (1.124 TiB)',
            estimatedCost: '$1024',
            type: 'Micrososft SQL Server',
            deploymentModel: 'fci',
            region: 'US East (N.Virginia)',
            fileSystemType: 'EBS'
        },
    ]

    const DatabasesColDefs: ColumnProps[] = [
        {
            id: '1',
            Header: 'Database host name',
            accessor: 'databaseHostName',
            isSortable: true,
            width:'280px',
            isSticky:true,
            renderCell: (cellData:any, rowData: any) => {
                return(
                    <div>
                        <Typography variant="Semibold_14" className={styles.setHeaderStyle}>
                            {rowData?.databaseHostName}
                        </Typography>
                        <Typography variant="Regular_13" className={styles.setHeaderStyle}>
                            {rowData?.status === 'Up' && (
                                <div className={`${styles["icon"]} ${styles['circle']} ${styles['up']}`}></div>
                            )}
                            {rowData?.status === 'Down' && (
                                <div className={`${styles["icon"]} ${styles['circle']} ${styles['down']}`}></div>
                            )}
                            {rowData?.status === 'Initializing' && (
                                <div className={`${styles["icon"]} ${styles['circle']} ${styles['initializing']}`}></div>
                            )}
                            <div>{rowData?.status}</div>
                            <div className={CommonStyles.separator} />
                            <div>{rowData?.type}</div>
                        </Typography>
                    </div>
                )
            }
        },
        {
            id: '2',
            Header: 'Protection',
            accessor: 'protection',
            isSortable: true,
            width:'184px',
            filterOptions: 'auto',
            renderCell: (cellData: string) => {
                return (
                    <Typography variant="Regular_14" className={styles.setHeaderStyle}>
                        {cellData === 'Protected' && (
                            <ProtectedIcon 
                                style={{
                                    //@ts-ignore
                                    '--icon-primary-color': 'var(--green-60)'
                                }}
                            />
                        )}
                        {cellData === 'Not protected' && (
                            <NotProtectedIcon 
                                style={{
                                    //@ts-ignore
                                    '--icon-primary-color': 'var(--grey-45)'
                                }}
                            />
                        )}
                        <div>{cellData}</div>
                        {cellData === 'Protected' && (
                            <InfoIcon  
                                style={{
                                    //@ts-ignore
                                    '--icon-primary-color': 'var(--grey-30)'
                                }}
                            />
                        )}
                    </Typography>
                )
            }
        },
        {
            id: '3',
            Header: 'Performance',
            accessor: 'performance',
            isSortable: true,
            width:'184px',
            filterOptions: 'auto',
        },
        {
            id: '4',
            Header: 'Storage savings',
            accessor: 'storageSavings',
            isSortable: true,
            width:'184px'
        },
        {
            id: '5',
            Header: 'Estimated Cost',
            accessor: 'estimatedCost',
            isSortable: true,
            width:'184px',
            renderCell: (cellData: string) => {
                return (
                    <Typography variant='Regular_14' className={styles.setHeaderStyle}>
                        <div>{cellData}</div>
                        <InfoIcon  
                            style={{
                                //@ts-ignore
                                '--icon-primary-color': 'var(--grey-30)'
                            }}
                        />
                    </Typography>
                )
            }
        },
        {
            id: '6',
            Header: 'Type',
            accessor: 'type',
            isSortable: true,
            width:'184px',
            filterOptions: 'auto',
        },
        {
            id: '7',
            Header: 'Deployment model',
            accessor: 'deploymentModel',
            isSortable: true,
            width:'184px',
            filterOptions: 'auto',
        },
        {
            id: '8',
            Header: 'Region',
            accessor: 'region',
            isSortable: true,
            width:'184px',
            filterOptions: 'auto',
        },
        {
            id: '9',
            Header: 'File system type',
            accessor: 'fileSystemType',
            isSortable: true,
            width:'184px',
            filterOptions: 'auto',
        },
        {
            id: '10',
            Header: '',
            accessor: '',
            width:'60px',
            isSticky:true,
            renderCell: (cellData: string) => {
                return (
                    <TableAction  
                        style={{
                            //@ts-ignore
                            '--icon-primary-color': 'var(--blue-70)'
                        }}
                    />
                )
            }
        }
    ];

    const tableProps = useTable({
        isSorting: false,
        columns: DatabasesColDefs,
        rows: databaseTableData,
        pageSize: 10,
        selectionType: 'none',
        isHorizontalScroll:true
    });

    return (
        <>
            <div className={styles.databaseTable}>
                <div className={styles.table}>
                    <TableTopBar
                        //@ts-ignore
                        tableProps={tableProps}
                        pluralTitle={'Databases'}
                        singularTitle={'Database'}
                    />
                    <Table
                        //@ts-ignore
                        tableProps={tableProps}
                    />
                </div>
            </div> 
        </>
    
    );
};

export default DatabaseTable;
