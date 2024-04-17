import { Table, useTable, Typography, TableTopBar, Button } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';

import styles from './SandboxTable.module.scss';
import { useNavigate } from 'react-router-dom';
import { GENERAL } from '../../../utils/appConstants';
import { useAppSelector } from '../../../store/storeHooks';
import { formatSandboxListData } from '../SandboxUtility';

const SandboxTable = () => {
    const navigate = useNavigate();
    const { aggregatedSandboxList } = useAppSelector(state => state.sandbox);

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
        rows: formatSandboxListData(aggregatedSandboxList),
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
