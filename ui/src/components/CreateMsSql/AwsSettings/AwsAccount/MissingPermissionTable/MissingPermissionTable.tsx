import React, { useEffect, useState } from 'react';
import { Table, useTable, TableTopBar } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import { Popover } from '@netapp/design-system/dist/components/Popover';
//@ts-ignore
import CopyToClipboard from 'react-copy-to-clipboard';
import { ReactComponent as CopyIcon } from '../../../../../assets/ic_copy.svg';
import styles from './MissingPermissionTable.module.scss';
import { GENERAL } from '../../../../../utils/appConstants';

type MissingPerm = {
    missingBlockedPermissions: boolean;
    content: any;
};

const MissingPermissionTable = ({ missingBlockedPermissions, content }: MissingPerm) => {
    const dataForCopy = content?.map((item: any) => `${item.service}:${item.action}`);

    //Only For Missing Permissions
    const MissingPerDefs: ColumnProps[] = [
        {
            Header: GENERAL.SERVICE,
            accessor: 'service',
            id: '1',
            isSortable: false,
            width: '200px',
            filterOptions: 'auto'
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
            filterOptions: 'auto'
        }
    ];

    //Fpr Missing and Blocked Permissions
    const MissingAndBlockedPerDefs: ColumnProps[] = [
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

        columns: missingBlockedPermissions ? MissingAndBlockedPerDefs : MissingPerDefs,
        rows: content,
        pageSize: 50
    });
    return (
        <div className={styles.missingPermissionTable}>
            {!missingBlockedPermissions && (
                <TableTopBar
                    //@ts-ignore
                    tableProps={tableProps}
                    pluralTitle={'Unsupported permissions'}
                    singularTitle={'Unsupported permission'}
                    actionsRight={
                        <div className={styles['copy']}>
                            <Popover
                                popoverClass={styles['copy-popover']}
                                children={GENERAL.COPY_ALL_UNSUPPORTED_PERMS}
                                container={
                                    <CopyToClipboard text={dataForCopy}>
                                        <CopyIcon fill={'#0067C5'}></CopyIcon>
                                    </CopyToClipboard>
                                }
                                trigger={'hover'}
                                placement="bottom-end"
                            />
                        </div>
                    }
                />
            )}

            <Table
                //@ts-ignore
                tableProps={tableProps}
                variant="innerTable"
                className={missingBlockedPermissions ? styles.addMargin : ''}
            />
        </div>
    );
};

export default MissingPermissionTable;
