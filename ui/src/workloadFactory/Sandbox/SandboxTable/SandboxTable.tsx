import { Table, useTable, Typography, TableTopBar, Button } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';

import styles from './SandboxTable.module.scss';

const SandboxTable = () => {
    const data = [
        {
            id: '1',
            name: 'db name',
            hostName: 'host name',
            source: 'Source db name',
            sourceHost: 'Source db host name',
            creationDate: 'March 15, 2024, 00:00:00',
            age: '1 day',
            tag: 'Dev'
        },
        {
            id: '2',
            name: 'db name',
            hostName: 'host name',
            source: 'Source db name',
            sourceHost: 'Source db host name',
            creationDate: 'March 15, 2024, 00:00:00',
            age: '1 day',
            tag: 'Dev'
        },
        {
            id: '3',
            name: 'db name',
            hostName: 'host name',
            source: 'Source db name',
            sourceHost: 'Source db host name',
            creationDate: 'March 15, 2024, 00:00:00',
            age: '1 day',
            tag: 'Dev'
        },
        {
            id: '4',
            name: 'db name',
            hostName: 'host name',
            source: 'Source db name',
            sourceHost: 'Source db host name',
            creationDate: 'March 15, 2024, 00:00:00',
            age: '1 day',
            tag: 'Dev'
        },
        {
            id: '5',
            name: 'db name',
            hostName: 'host name',
            source: 'Source db name',
            sourceHost: 'Source db host name',
            creationDate: 'March 15, 2024, 00:00:00',
            age: '1 day',
            tag: 'Dev'
        },
        {
            id: '6',
            name: 'db name',
            hostName: 'host name',
            source: 'Source db name',
            sourceHost: 'Source db host name',
            creationDate: 'March 15, 2024, 00:00:00',
            age: '1 day',
            tag: 'Dev'
        },
        {
            id: '7',
            name: 'db name',
            hostName: 'host name',
            source: 'Source db name',
            sourceHost: 'Source db host name',
            creationDate: 'March 15, 2024, 00:00:00',
            age: '1 day',
            tag: 'Dev'
        }
    ];

    const SandboxColDefs: ColumnProps[] = [
        {
            Header: 'Database name',
            accessor: 'name',
            id: '1',
            isSortable: true,
            width: '220px'
        },
        {
            Header: 'Database host name',
            accessor: 'hostName',
            id: '2',
            width: '220px',
            filterOptions: 'auto'
        },
        {
            Header: 'Source database name',
            accessor: 'source',
            id: '3',
            width: '212px',
            isSortable: true
        },
        {
            Header: 'Source database host name',
            accessor: 'sourceHost',
            id: '4',
            width: '240px',
            filterOptions: 'auto'
        },
        {
            Header: 'Creation date',
            accessor: 'creationDate',
            id: '5',
            width: '220px',
            isSortable: true
        },
        {
            Header: 'Age',
            accessor: 'age',
            id: '6',
            width: '220px',
            filterOptions: 'auto'
        },
        {
            Header: 'Tag/Type',
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
                        <Button variant={'primary'} className={'continue-button'} isThin={true} onClick={() => {}}>
                            {'Create new sandbox'}
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
