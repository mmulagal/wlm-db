import { Table, useTable, TableTopBar } from '@netapp/design-system';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './InnerTable.module.scss';
import commonStyles from '../../../../utils/CommonStyles.module.scss';
import { ReactComponent as ArrowIcon } from '../../../../assets/row_arrow.svg';

import { getWadCellProps } from '../../GetWellUtils';
import {
    getExpandableTableColumns,
    groupViolationDetails,
    buildExpandableTableData,
    toggleExpandedRow,
    useInitialExpandedRow
} from './ExpandableTableHelper';

const DataFilesOptimizeTable = ({ type, data, lastColDetails, isWad = false }: any) => {
    const { t } = useTranslation();
    const na = t('databases.general.not-available-table-columns');
    const hasViolationDetails = data?.violationDetails?.some((d: any) => d.additionalInfo);
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

    const toggleRow = (id: string) => toggleExpandedRow(id, setExpandedRows, false);

    const groupedData = useMemo(() => groupViolationDetails(data, isWad, t, getWadCellProps), [data, isWad, t]);

    useInitialExpandedRow(groupedData, hasViolationDetails, setExpandedRows);

    const tableData = useMemo(
        () => buildExpandableTableData(groupedData, expandedRows, t, na),
        [groupedData, expandedRows, t, na]
    );

    const TableColDefs = getExpandableTableColumns({
        t,
        na,
        toggleRow,
        hasViolationDetails,
        commonStyles,
        ArrowIcon,
        lastColDetails,
        type,
        innerStyles: styles
    });

    const tableProps = useTable({
        // @ts-ignore
        manageColumnsProps: false,
        isHorizontalScroll: false,
        isSorting: false,
        columns: TableColDefs,
        rows: tableData,
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
            />
        </div>
    );
};

export default DataFilesOptimizeTable;
