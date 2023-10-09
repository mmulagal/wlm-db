import { Table, TableTopBar, TooltipInfo, Typography, useTable } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import styles from './DatabaseTable.module.scss';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import { ReactComponent as ProtectedIcon} from '@netapp/icons/ic_protected.svg';
import { ReactComponent as NotProtectedIcon} from '@netapp/icons/ic_unprotected.svg';
import { GENERAL } from '../../../utils/appConstants';
import MenuPopover from '../../../common/MenuPopover/MenuPopover';
import { useRef, useState } from 'react';
import DatabaseEstimatedCost from './DatabaseEstimatedCost';
import DatabaseHostJson from './DatabaseHost.json';

const DatabaseTable = () => {

    const [menuOpenedRow, setOpenedRow] = useState(null);
    const menuOpenedRowDetail: any = useRef(null);
  

    // This data will get from API
    const databaseTableData: any[] = DatabaseHostJson;

    const menuItems = [
        {
            id: '1',
            displayName: 'View full info'
        },
        {
            id: '2',
            displayName: 'Clone'
        },
        {
            id: '3',
            displayName: 'Migrate'
        },
        {
            id: '4',
            displayName: 'Protect'
        }
    ];

    const protectionTooltipText = (data: any) => {
        return (
            <div className={styles.protectionTooltip}>
                <Typography variant="Semibold_13" className={styles.textHeight}>Protected By:</Typography>
                {
                    data.map((val:any) => 
                        (<Typography variant="Regular_13" className={styles.textHeight}>{val}</Typography>)
                    )
                }
            </div>
        )
    };

    const lastColDetails = () => {
        return {
            id: '10',
            Header: '',
            accessor: '',
            renderCell: (cellData: any, rowData: any) => {
                return (
                <div className={styles.jobMenuPopover}>
                    <MenuPopover
                        isMenuOpen={
                            menuOpenedRowDetail.current === rowData.id ||
                            menuOpenedRow === rowData.id
                        }
                        menuItems={menuItems}
                        toggleMenu={(toggleType: string, menuId: string) => {
                            if (toggleType === 'close') {
                                menuOpenedRowDetail.current = null;
                                setOpenedRow(null);
                            } else if (toggleType === 'open') {
                                menuOpenedRowDetail.current = null;
                                setOpenedRow(rowData.id);
                                menuOpenedRowDetail.current = rowData.id;
                            } else if (toggleType === 'selectedOption') {
                                menuOpenedRowDetail.current = null;
                                setOpenedRow(null);
                            }
                        }}
                        CustomMenu={undefined}
                        disabledText={undefined}
                    />
                </div>
                );
            },
            showHide: true,
            width: '56px',
            isSticky: true
        };
      };
    

    const DatabasesColDefs: ColumnProps[] = [
        {
            id: '1',
            Header: GENERAL.DATABASE_HOST_NAME,
            accessor: 'databaseHostName',
            isSortable: true,
            width:'280px',
            isSticky:true,
            renderCell: (cellData:any, rowData: any) => {
                return(
                    <div>
                        <Typography variant="Semibold_14">
                            {rowData?.databaseHostName}
                        </Typography>
                        <div className={styles.colText}>
                            {rowData?.status === 'Up' && (
                                <div className={`${styles.statusIcon} ${styles['circle']} ${styles['up']}`}></div>
                            )}
                            {rowData?.status === 'Down' && (
                                <div className={`${styles.statusIcon} ${styles['circle']} ${styles['down']}`}></div>
                            )}
                            {rowData?.status === 'Initializing' && (
                                <div className={`${styles.statusIcon} ${styles['circle']} ${styles['initializing']}`}></div>
                            )}
                            <Typography variant="Regular_13">{rowData?.status}</Typography>
                            <div className={CommonStyles.separator} />
                            <Typography variant="Regular_13">{rowData?.type}</Typography>
                        </div>
                    </div>
                )
            }
        },
        {
            id: '2',
            Header: GENERAL.DB_HOST_PROTECTION,
            accessor: 'protection',
            isSortable: true,
            width:'184px',
            filterOptions: 'auto',
            renderCell: (cellData: string, rowData: any) => {
                return (
                    <div className={styles.colText}>
                        <div className={styles.protection}>
                            {cellData === 'Protected' && (
                                <ProtectedIcon 
                                    style={{
                                        //@ts-ignore
                                        '--icon-primary-color': 'var(--green-60)',
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
                            <Typography variant="Regular_14">{cellData}</Typography>
                        </div>
                        {cellData === 'Protected' && (
                            <TooltipInfo onVisibleChange={function noRefCheck(){}}>
                                    {protectionTooltipText(rowData?.protectedBy)}
                            </TooltipInfo>
                        )}
                    </div>
                )
            }
        },
        {
            id: '3',
            Header: GENERAL.DB_HOST_PERFORMANCE,
            accessor: 'performance',
            isSortable: true,
            width:'184px',
            filterOptions: 'auto',
        },
        {
            id: '4',
            Header: GENERAL.DB_HOST_STORAGE_SAVINGS,
            accessor: 'storageSavings',
            isSortable: true,
            width:'184px'
        },
        {
            id: '5',
            Header: GENERAL.DB_HOST_ESTIMATED_COST,
            accessor: 'estimatedCost',
            isSortable: true,
            width:'184px',
            renderCell: (cellData: string, rowData: any) => {
                return (
                    <div className={styles.cost}>
                        <TooltipInfo onVisibleChange={function noRefCheck(){}}>
                            {DatabaseEstimatedCost(rowData?.cost)}
                        </TooltipInfo>
                        <Typography variant='Regular_14'>{cellData}</Typography>
                    </div>
                )
            }
        },
        {
            id: '6',
            Header: GENERAL.DB_HOST_TYPE,
            accessor: 'type',
            isSortable: true,
            width:'184px',
            filterOptions: 'auto',
        },
        {
            id: '7',
            Header: GENERAL.DB_HOST_DEPLOYMENT_MODEL,
            accessor: 'deploymentModel',
            isSortable: true,
            width:'184px',
            filterOptions: 'auto',
        },
        {
            id: '8',
            Header: GENERAL.DB_HOST_REGION,
            accessor: 'region',
            isSortable: true,
            width:'184px',
            filterOptions: 'auto',
        },
        {
            id: '9',
            Header: GENERAL.DB_HOST_FILE_SYSTEM_TYPE,
            accessor: 'fileSystemType',
            isSortable: true,
            width:'184px',
            filterOptions: 'auto',
        },
        lastColDetails()
    ];

    const tableProps = useTable({
        isSorting: false,
        columns: DatabasesColDefs,
        rows: databaseTableData,
        pageSize: 10,
        selectionType: 'none',
        isHorizontalScroll:true,
    });

    return (
        <>
            <div className={styles.databaseTable}>
                <div className={styles.table}>
                    <TableTopBar
                        //@ts-ignore
                        tableProps={tableProps}
                        pluralTitle={GENERAL.DATABASE_HOSTS}
                        singularTitle={GENERAL.DATABASE_HOST}
                    />
                    <Table
                        //@ts-ignore
                        tableProps={tableProps}
                        isDoubleRow={true}
                    />
                </div>
            </div> 
        </>
    
    );
};

export default DatabaseTable;
