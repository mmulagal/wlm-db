import { Table, useTable } from '@netapp/design-system';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { TableTopBar } from '../../../../common/Lib/Table/TableTopBar';
import styles from './InnerTable.module.scss';
import commonStyles from '../../../../utils/CommonStyles.module.scss';
import { ReactComponent as ArrowIcon } from '../../../../assets/row_arrow.svg';

import { getWadCellProps } from '../../GetWellUtils';
import {
    groupViolationDetails,
    ExpandedRowTable,
    buildParentTableData,
    getNestedTableColumns,
    useAutoExpandFirstRow
} from './ExpandableTableHelper';

const TempDbFilesOptimizeTable = ({ type, data, lastColDetails, isWad = false }: any) => {
    const { t } = useTranslation();
    const na = t('databases.general.not-available-table-columns');
    const hasViolationDetails = data?.violationDetails?.some((d: any) => d.additionalInfo);

    const groupedData = useMemo(() => groupViolationDetails(data, isWad, t, getWadCellProps), [data, isWad, t]);
    const tableData = useMemo(() => buildParentTableData(groupedData, t, na), [groupedData, t, na]);

    const TableColDefs = useMemo(
        () =>
            getNestedTableColumns({
                t,
                na,
                hasViolationDetails,
                lastColDetails,
                type,
                lunPathCellClassName: styles.lunPathCell,
                commonStyles,
                ArrowIcon
            }),
        [t, na, hasViolationDetails, lastColDetails, type]
    );

    const tableProps = useTable({
        // @ts-expect-error - manageColumnsProps type
        manageColumnsProps: false,
        isHorizontalScroll: false,
        isSorting: false,
        columns: TableColDefs,
        rows: tableData,
        pageSize: 50,
        selectionType: 'none',
        defaultSelectedRows: tableData.map((item: any) => item.id)
    });

    useAutoExpandFirstRow(hasViolationDetails, tableData, tableProps.updateRowState);

    const databaseCount = groupedData.length;

    return (
        <div className={styles['inner-table']}>
            <TableTopBar
                // @ts-expect-error - tableProps type
                tableProps={tableProps}
                pluralTitle={`${t('databases.well-architect.impacted-databases')} (${databaseCount})`}
                singularTitle={`${t('databases.well-architect.impacted-database')} (${databaseCount})`}
                hideCount
            />

            <Table
                // @ts-expect-error - tableProps type
                tableProps={tableProps}
                // @ts-expect-error - ExpandedRow accepts functional component
                ExpandedRow={ExpandedRowTable}
            />
        </div>
    );
};

export default TempDbFilesOptimizeTable;
