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
            Header: GENERAL.SANDBOX_DB_NAME,
            accessor: 'name',
            id: '1',
            isSortable: true,
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
