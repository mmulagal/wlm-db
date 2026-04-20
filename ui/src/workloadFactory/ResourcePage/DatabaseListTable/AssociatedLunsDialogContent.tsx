import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { DsTypography } from '@tlveng/wlm-ds';
import { useTable } from '../../../common/Lib/Table/useTable';
import { Table, ColumnProps } from '../../../common/Lib/Table/Table';
import { WorkloadFactoryDatabaseItem } from '../../../utils/types/workloadFactoryResourceTypes';
import styles from './AssociatedLunsDialogContent.module.scss';

type LunEntry = {
    id: string;
    name: string;
    driveLetter?: string;
};

type AssociatedLunsDialogContentProps = {
    luns?: WorkloadFactoryDatabaseItem['luns'];
};

const dedupeLuns = (luns?: WorkloadFactoryDatabaseItem['luns']): LunEntry[] => {
    if (!luns) return [];
    const all = [...(luns.dataFiles ?? []), ...(luns.logFiles ?? [])];
    const byName = new Map<string, LunEntry>();
    all.forEach(file => {
        const name = file?.name;
        if (!name || byName.has(name)) return;
        byName.set(name, { id: name, name, driveLetter: file?.driveLetter });
    });
    return Array.from(byName.values());
};

const AssociatedLunsDialogContent = ({ luns }: AssociatedLunsDialogContentProps) => {
    const { t } = useTranslation();
    const notAvailable = t('databases.general.not-available');

    const rows = useMemo(() => dedupeLuns(luns), [luns]);

    const renderTextCell = (cellData: unknown) => (
        <DsTypography variant="Regular_14">{(cellData as string) || notAvailable}</DsTypography>
    );

    const columns: ColumnProps[] = [
        {
            Header: t('databases.resource-overview.drive-letter'),
            accessor: 'driveLetter',
            id: 'drive-letter',
            isSortable: true,
            width: '180px',
            renderCell: renderTextCell
        },
        {
            Header: t('databases.resource-overview.lun-path'),
            accessor: 'name',
            id: 'lun-path',
            isSortable: true,
            width: 'auto',
            renderCell: renderTextCell
        }
    ];

    const tableProps = useTable({
        selectionType: 'none',
        isSorting: false,
        columns,
        rows,
        pageSize: 50
    });

    return (
        <div className={styles.associatedLunsTable}>
            <Table
                // @ts-expect-error – tableProps is typed as the internal table state shape
                tableProps={tableProps}
                variant="innerTable"
            />
        </div>
    );
};

export default AssociatedLunsDialogContent;
