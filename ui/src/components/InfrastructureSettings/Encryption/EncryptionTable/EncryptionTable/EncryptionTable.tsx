import { Table, useTable, Typography } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import { GENERAL } from '../../../../../utils/appConstants';
import { ReactComponent as DefaultTag } from '../../../../../assets/defaultTag.svg';
import { ReactComponent as WarningIcon } from '@netapp/icons/ic_notice_triangle.svg';
import styles from './EncryptionTable.module.scss';
import { useEffect } from 'react';
import { getSelectedFromSelectionState } from '../../../../../utils/utilityFunctions';
import { useDispatch } from 'react-redux';
import { setEncryptionRow } from '../../../../../store/mssql/mssqlFormSlice';
import { useAppSelector } from '../../../../../store/storeHooks';
import { DEFAULT_MASTER_KEY, EXPIRED_STATUS, EXPIRING_STATUS } from '../../../../../utils/consts';

const EncryptionTable = () => {
    const dispatch = useDispatch();

    //Getting the Data from state
    const { kmsData } = useAppSelector(state => state.mssql.getKmsList);
    const selectedRow = useAppSelector(state => state.mssqlForm.encryption.selectedRow);

    const EncryptionColDefs: ColumnProps[] = [
        {
            Header: GENERAL.CUSTOMER_MASTER_KEY_NAME,
            accessor: 'name',
            id: '1',
            isSortable: false,

            width: '180px',
            renderCell: (cellData: any, rowData: any) => {
                return (
                    <div className={styles.keyName}>
                        <div className={styles.content}>{cellData}</div>
                        {cellData === DEFAULT_MASTER_KEY && (
                            <div className={styles.tag}>
                                <DefaultTag />
                            </div>
                        )}
                    </div>
                );
            }
        },
        {
            Header: GENERAL.KEY_ID,
            accessor: 'id',
            id: '2',
            width: '348px'
        },
        {
            Header: GENERAL.EXPIRATION_DATE,
            accessor: 'expirationDate',
            id: '3',
            width: '177px',

            renderCell: (cellData: any, rowData: any) => {
                return (
                    <div className={styles.expirationDate}>
                        {rowData?.expiryStatus === EXPIRED_STATUS && (
                            <div>
                                <WarningIcon 
                                style={{
                                    //@ts-ignore
                                    '--icon-primary-color': 'var(--error)'
                                }}/>
                            </div>
                        )}
                        {rowData?.expiryStatus === EXPIRING_STATUS && (
                            <div>
                                <WarningIcon 
                                style={{
                                    //@ts-ignore 
                                    '--icon-primary-color': 'var(--warning)'
                                }}/>
                            </div>
                        )}
                        <div className={styles.icon}>{cellData}</div>
                    </div>
                );
            }
        },
        {
            Header: GENERAL.ORIGIN,
            accessor: 'origin',
            id: '4',
            width: '126px'
        }
    ];

    const tableProps = useTable({
        //@ts-ignore
        selectAllProps: false,
        //@ts-ignore
        manageColumnsProps: false,
        defaultSelectedRows: selectedRow ? [selectedRow[0] && selectedRow[0].id] : [EncryptionColDefs[0].id],
        isSorting: false,
        selectionType: 'singular',
        columns: EncryptionColDefs,
        rows: kmsData,
        pageSize: 10
    });

    useEffect(() => {
        const row = getSelectedFromSelectionState(tableProps.selectionState, kmsData);
        dispatch(setEncryptionRow(row));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tableProps.selectionState, kmsData]);

    return (
        <div className={styles.table}>
            <Table
                //@ts-ignore
                tableProps={tableProps}
                variant="innerTable"
            />

            <Typography variant="Regular_14" className={styles.bottomText}>
                <span style={{ fontWeight: '590' }}>{GENERAL.NOTICE}</span>&nbsp;
                {GENERAL.ONLY_ENABLED_KEYS}
            </Typography>
        </div>
    );
};

export default EncryptionTable;
