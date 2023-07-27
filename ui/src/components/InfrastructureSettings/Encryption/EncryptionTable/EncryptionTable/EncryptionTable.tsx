import { Table, useTable, Typography } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import { GENERAL } from '../../../../../utils/appConstants';
import { ReactComponent as DefaultTag } from '../../../../../assets/defaultTag.svg';
import styles from './EncryptionTable.module.scss';
import { useEffect } from 'react';
import { getSelectedFromSelectionState } from '../../../../../utils/utilityFunctions';

const EncryptionTable = () => {
    const data: any = [
        { key: 'aws/fsx', expirationDate: 'None', origin: 'AWS_KMS', id: '1' },
        {
            key: 'key2',
            expirationDate: 'None',
            origin: 'AWS_KMS',
            id: '2',
            cellProps: {
                isDisabled: true
            }
        },
        { key: 'about to expire', expirationDate: 'None', origin: 'AWS_KMS', id: '5' },
        { key: 'key 4', expirationDate: 'None', origin: 'AWS_KMS', id: '6' }
    ];

    const EncryptionColDefs: ColumnProps[] = [
        {
            Header: GENERAL.CUSTOMER_MASTER_KEY_NAME,
            accessor: 'key',
            id: '1',
            isSortable: false,

            width: '335px',
            renderCell: (cellData: any, rowData: any) => {
                return (
                    <div className={styles.keyName}>
                        <Typography variant="Regular_14" className={styles.content}>
                            {cellData}
                        </Typography>
                        {cellData === 'aws/fsx' && (
                            <div className={styles.tag}>
                                <DefaultTag />
                            </div>
                        )}
                    </div>
                );
            }
        },
        {
            Header: GENERAL.EXPIRATION_DATE,
            accessor: 'expirationDate',
            id: '2',
            width: '250px',

            renderCell: (cellData: any) => {
                return (
                    <div className={styles.expirationDate}>
                        <div className={styles.icon}>{cellData}</div>
                    </div>
                );
            }
        },
        {
            Header: GENERAL.ORIGIN,
            accessor: 'origin',
            id: '3',
            width: '256px'
        }
    ];
    const tableProps = useTable({
        //@ts-ignore
        selectAllProps: false,
        //@ts-ignore
        manageColumnsProps: false,
        isSorting: false,
        selectionType: 'singular',
        columns: EncryptionColDefs,
        rows: data,
        pageSize: 10
    });

    useEffect(() => {
        const rows = getSelectedFromSelectionState(tableProps.selectionState, data);
        console.log(rows);
    }, [tableProps.selectionState]);

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
