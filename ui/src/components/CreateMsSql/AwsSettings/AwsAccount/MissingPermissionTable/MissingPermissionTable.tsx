import { Table, useTable } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import styles from './MissingPermissionTable.module.scss';
import { GENERAL } from '../../../../../utils/appConstants';

type MissingPerm = {
    content: any;
};

const MissingPermissionTable = ({ content }: MissingPerm) => {
    //Fpr Missing and Blocked Permissions
    const MissingPerDefs: ColumnProps[] = [
        {
            Header: GENERAL.SERVICE,
            accessor: 'service',
            id: '1',
            isSortable: true,
            width: '200px'
        },
        {
            Header: GENERAL.PERMISSIONS,
            accessor: 'action',
            id: '2',
            width: '280px',
            isSortable: true
        },
        {
            Header: GENERAL.ERROR_PERMISSION,
            accessor: 'error',
            id: '3',
            width: '492px',
            isSortable: true
        }
    ];

    const tableProps = useTable({
        //@ts-ignore
        selectAllProps: false,
        //@ts-ignore
        manageColumnsProps: false,

        isSorting: false,

        columns: MissingPerDefs,
        rows: content,
        pageSize: 50
    });
    return (
        <div className={styles.missingPermissionTable}>
            <Table
                //@ts-ignore
                tableProps={tableProps}
                variant="innerTable"
                className={styles.addMargin}
            />
        </div>
    );
};

export default MissingPermissionTable;
