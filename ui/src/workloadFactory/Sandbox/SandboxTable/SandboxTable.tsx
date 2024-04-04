import { Table, useTable, Typography, TableTopBar, Button } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';

import styles from './SandboxTable.module.scss';
import { useNavigate } from 'react-router-dom';
import { GENERAL } from '../../../utils/appConstants';

const SandboxTable = () => {
    const navigate = useNavigate();
    const data = [
        {
            id: '1',
            name: 'Database name 1',
            hostName: 'host name 1',
            source: 'Source db name 1',
            sourceHost: 'Source db host name 1',
            creationDate: 'March 15, 2024, 00:00:00',
            age: '1 day',
            tag: 'Dev'
        },
        {
            id: '2',
            name: 'db name 2',
            hostName: 'host name 2',
            source: 'Source db name 2',
            sourceHost: 'Source db host name 2',
            creationDate: 'March 15, 2024, 00:00:00',
            age: '5 days',
            tag: 'Dev'
        },
        {
            id: '3',
            name: 'db name 3',
            hostName: 'host name 3',
            source: 'Source db name 3',
            sourceHost: 'Source db host name 3',
            creationDate: 'March 15, 2024, 00:00:00',
            age: '4 days',
            tag: 'Dev'
        },
        {
            id: '4',
            name: 'db name 4',
            hostName: 'host name 4',
            source: 'Source db name 4',
            sourceHost: 'Source db host name 4',
            creationDate: 'March 15, 2024, 00:00:00',
            age: '2 days',
            tag: 'Dev'
        },
        {
            id: '5',
            name: 'db name 5',
            hostName: 'host name 5',
            source: 'Source db name 5',
            sourceHost: 'Source db host name 5',
            creationDate: 'March 15, 2024, 00:00:00',
            age: '7 days',
            tag: 'Dev'
        },
        {
            id: '6',
            name: 'db name 6',
            hostName: 'host name 6',
            source: 'Source db name 6',
            sourceHost: 'Source db host name 6',
            creationDate: 'March 15, 2024, 00:00:00',
            age: '1 days',
            tag: 'Dev'
        },
        {
            id: '7',
            name: 'db name 7',
            hostName: 'host name 7',
            source: 'Source db name 7',
            sourceHost: 'Source db host name 7',
            creationDate: 'March 15, 2024, 00:00:00',
            age: '14 days',
            tag: 'Dev'
        }
    ];

    const SandboxColDefs: ColumnProps[] = [
        {
            Header: GENERAL.SANDBOX_DB_NAME,
            accessor: 'name',
            id: '1',
            isSortable: true,
            isSticky: true,
            width: '220px'
        },
        {
            Header: GENERAL.SANDBOX_DB_HOST_NAME,
            accessor: 'hostName',
            id: '2',
            width: '220px',
            filterOptions: 'auto'
        },
        {
            Header: GENERAL.SANDBOX_SOURCE_DB_NAME,
            accessor: 'source',
            id: '3',
            width: '212px',
            isSortable: true
        },
        {
            Header: GENERAL.SANDBOX_SOURCE_DB_HOST_NAME,
            accessor: 'sourceHost',
            id: '4',
            width: '240px',
            filterOptions: 'auto'
        },
        {
            Header: GENERAL.SANDBOX_LAST_UPDATED,
            accessor: 'creationDate',
            id: '5',
            width: '220px',
            isSortable: true
        },
        {
            Header: GENERAL.AGE,
            accessor: 'age',
            id: '6',
            width: '220px',
            filterOptions: 'auto'
        },
        {
            Header: GENERAL.SANDBOX_TAG,
            accessor: 'tag',
            id: '7',
            width: '220px',
            filterOptions: 'auto'
        },
        {
            Header: '',
            accessor: '',
            id: '8',
            width: '56px'
        }
    ];

    const tableProps = useTable({
        //@ts-ignore
        selectAllProps: false,
        //@ts-ignore
        manageColumnsProps: false,
        isHorizontalScroll: true,
        isSorting: false,
        columns: SandboxColDefs,
        rows: data,
        pageSize: 50
    });
    return (
        <div className={styles.sandboxTable}>
            <TableTopBar
                //@ts-ignore
                tableProps={tableProps}
                pluralTitle="Sandboxes"
                singularTitle="Sandbox"
                actionsRight={
                    <div className={styles.sandboxButton}>
                        <Button
                            variant={'primary'}
                            className={'continue-button'}
                            isThin={true}
                            onClick={() => navigate('../create-new-sandbox')}
                        >
                            {GENERAL.CREATE_NEW_SANDBOX}
                        </Button>
                    </div>
                }
            />
            <Table
                //@ts-ignore
                tableProps={tableProps}
            />
        </div>
    );
};

export default SandboxTable;
