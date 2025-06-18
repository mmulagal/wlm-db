import { Table, useTable, Typography } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import { ReactComponent as WarningIcon } from '@netapp/icons/ic_notice_triangle.svg';
import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { GENERAL } from '../../../../../../utils/appConstants';
import { ReactComponent as DefaultTag } from '../../../../../../assets/defaultTag.svg';
import styles from './EncryptionTable.module.scss';
import { getSelectedFromSelectionState } from '../../../../../../utils/utilityFunctions';
import { setEncryptionRow } from '../../../../../../store/mssql/mssqlFormSlice';
import { useAppSelector } from '../../../../../../store/storeHooks';
import { DEFAULT_MASTER_KEY, DISABLED_STATE, PENDING_DELETION } from '../../../../../../utils/consts';

const EncryptionTable = () => {
    const dispatch = useDispatch();

    // Getting the Data from state
    const { kmsData } = useAppSelector(state => state.mssql.getKmsList);
    const selectedRow = useAppSelector(state => state.mssqlForm.encryption.selectedRow);

    const EncryptionColDefs: ColumnProps[] = [
        {
            Header: GENERAL.CUSTOMER_MASTER_KEY_NAME,
            accessor: 'name',
            id: '1',
            isSortable: false,
            width: '19.4%',
            renderCell: (cellData: any, rowData: any) => (
                <div className={styles.keyName}>
                    <div className={styles.content}>{cellData}</div>
                    {cellData === DEFAULT_MASTER_KEY && (
                        <div className={styles.tag}>
                            <DefaultTag />
                        </div>
                    )}
                </div>
            )
        },
        {
            Header: GENERAL.KEY_ID,
            accessor: 'id',
            id: '2',
            width: '37.46%'
        },
        {
            Header: GENERAL.EXPIRATION_DATE,
            accessor: 'formattedDate',
            id: '3',
            width: '19.13%',

            renderCell: (cellData: any, rowData: any) => (
                <div className={styles.expirationDate}>
                    {rowData?.state === DISABLED_STATE && (
                        <div>
                            <WarningIcon
                                style={{
                                    // @ts-ignore
                                    '--icon-primary-color': 'var(--error)'
                                }}
                            />
                        </div>
                    )}
                    {rowData?.state === PENDING_DELETION && (
                        <div>
                            <WarningIcon
                                style={{
                                    // @ts-ignore
                                    '--icon-primary-color': 'var(--warning)'
                                }}
                            />
                        </div>
                    )}
                    <div className={styles.icon}>{cellData}</div>
                </div>
            )
        },
        {
            Header: GENERAL.ORIGIN,
            accessor: 'origin',
            id: '4',
            width: '13.62%'
        }
    ];

    const tableProps = useTable({
        // @ts-ignore
        selectAllProps: false,
        // @ts-ignore
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
                // @ts-ignore
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
