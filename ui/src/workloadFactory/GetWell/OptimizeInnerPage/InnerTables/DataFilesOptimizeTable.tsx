import { Table, useTable, TableTopBar } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './InnerTable.module.scss';

import { getWadCellProps } from '../../GetWellUtils';

const DataFilesOptimizeTable = ({ type, data, lastColDetails, isWad = false }: any) => {
    const { t } = useTranslation();
    const na = t('databases.general.not-available-table-columns');
    const hasViolationDetails = data?.violationDetails?.some((d: any) => d.additionalInfo);

    const tableData = useMemo(() => {
        let id = 0;
        const details = data?.violationDetails || [];
        if (details.length > 0 && details.some((d: any) => d.additionalInfo)) {
            const grouped = new Map<string, { drives: string[]; lunPaths: string[] }>();
            for (const detail of details) {
                const dbName = String(detail?.value ?? '');
                if (!grouped.has(dbName)) {
                    grouped.set(dbName, { drives: [], lunPaths: [] });
                }
                const entry = grouped.get(dbName)!;
                if (detail?.additionalInfo?.driveLetter) entry.drives.push(detail.additionalInfo.driveLetter);
                if (detail?.additionalInfo?.lunPath) entry.lunPaths.push(detail.additionalInfo.lunPath);
            }
            return Array.from(grouped.entries()).map(([dbName, { drives, lunPaths }]) => ({
                databaseName: dbName,
                drive: drives,
                lunPath: lunPaths,
                id: String(id++),
                cellProps: getWadCellProps(isWad, t, { isDisabled: true })
            }));
        }
        return data?.objectsInViolation?.map((row: any) => ({
            databaseName: row,
            drive: [],
            lunPath: [],
            id: String(id++),
            cellProps: getWadCellProps(isWad, t, { ...row.cellProps, isDisabled: true })
        }));
    }, [data, isWad, t]);

    const TableColDefs: ColumnProps[] = [
        {
            Header: t('databases.well-architect.database-name'),
            accessor: 'databaseName',
            id: '1',
            isSortable: false,
            filterOptions: 'auto',
            isSticky: true,
            width: 'auto',
            renderCell: (cellData: any) => cellData || na
        },
        ...(hasViolationDetails
            ? [
                  {
                      Header: t('databases.well-architect.drive'),
                      accessor: 'drive',
                      id: '2',
                      isSortable: false,
                      width: 'auto',
                      renderCell: (cellData: string[]) =>
                          cellData?.length > 0 ? (
                              <div className={styles.cellList}>
                                  {cellData.map((drive: string, index: number) => (
                                      <span key={index}>{drive}</span>
                                  ))}
                              </div>
                          ) : (
                              na
                          )
                  } as ColumnProps,
                  {
                      Header: t('databases.well-architect.lun-path'),
                      accessor: 'lunPath',
                      id: '3',
                      isSortable: false,
                      width: 'auto',
                      renderCell: (cellData: string[]) =>
                          cellData?.length > 0 ? (
                              <div className={styles.cellList}>
                                  {cellData.map((path: string, index: number) => (
                                      <span key={index}>{path}</span>
                                  ))}
                              </div>
                          ) : (
                              na
                          )
                  } as ColumnProps
              ]
            : []),
        lastColDetails(type, {}, '230px')
    ];

    const tableProps = useTable({
        // @ts-ignore
        manageColumnsProps: false,
        isHorizontalScroll: false,
        isSorting: false,
        columns: TableColDefs,
        rows: tableData || [],
        pageSize: 50,
        selectionType: 'none',
        defaultSelectedRows: tableData.map((item: any) => item.id)
    });

    return (
        <div className={styles['inner-table']}>
            <TableTopBar
                // @ts-ignore
                tableProps={tableProps}
                pluralTitle={t('databases.well-architect.impacted-databases')}
                singularTitle={t('databases.well-architect.impacted-database')}
            />

            <Table
                // @ts-ignore
                tableProps={tableProps}
                isDoubleRow
            />
        </div>
    );
};

export default DataFilesOptimizeTable;
