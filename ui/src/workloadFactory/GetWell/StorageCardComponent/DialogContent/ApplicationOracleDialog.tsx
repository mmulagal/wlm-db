import { Table, useTable } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './DialogContent.module.scss';
import { ASSESSMENT_CONFIG_NAMES } from '../../../../utils/consts';
import { createActionOptionSection, createContentWithBullets, createSection } from './DialogContentHelper';

type ApplicationOracleDialogProps = {
    missingPatchList?: Array<any>;
    type: string;
};

const ApplicationOracleDialog = ({ missingPatchList = [], type }: ApplicationOracleDialogProps) => {
    const { t } = useTranslation();
    const tableData = useMemo(
        () =>
            missingPatchList?.map((item, index) => ({
                ...item,
                id: index
            })),
        [missingPatchList]
    );

    const patchColDefs: ColumnProps[] = [
        {
            Header: t('databases.well-architect.oracle-critical-patch-cve-id'),
            accessor: 'cveId',
            id: '1',
            isSortable: true,
            width: '120px'
        },
        {
            Header: t('databases.well-architect.oracle-critical-patch-component'),
            accessor: 'component',
            id: '2',
            isSortable: true,
            width: '150px'
        },
        {
            Header: t('databases.well-architect.oracle-critical-patch-description'),
            accessor: 'description',
            id: '3',
            isSortable: true,
            width: '280px'
        },
        {
            Header: t('databases.well-architect.oracle-critical-patch-published-date'),
            accessor: 'releaseDate',
            id: '4',
            isSortable: true,
            width: '162px'
        }
    ];

    const tableProps = useTable({
        manageColumnsProps: {},
        isSorting: false,
        selectionType: 'none',
        columns: patchColDefs,
        rows: tableData,
        pageSize: 50
    });

    const setContent = () => {
        switch (type) {
            case ASSESSMENT_CONFIG_NAMES.ORACLE_SECURITY_PATCH:
                return (
                    <>
                        {createSection(
                            t('databases.well-architect.action-summary'),
                            t('databases.well-architect.oracle-critical-patch-action-summary')
                        )}

                        {createSection(
                            t('databases.well-architect.oracle-critical-patch-security-patches'),
                            <div className={styles.table}>
                                {/* @ts-ignore */}
                                <Table tableProps={tableProps} variant="innerTable" />
                            </div>
                        )}

                        {createActionOptionSection(
                            t('databases.well-architect.oracle-critical-patch-action-required'),
                            [
                                t('databases.well-architect.oracle-critical-patch-step1'),
                                t('databases.well-architect.oracle-critical-patch-step2'),
                                t('databases.well-architect.oracle-critical-patch-step3'),
                                t('databases.well-architect.oracle-critical-patch-step4'),
                                t('databases.well-architect.oracle-critical-patch-step5'),
                                t('databases.well-architect.oracle-critical-patch-step6'),
                                t('databases.well-architect.oracle-critical-patch-step7'),
                                t('databases.well-architect.oracle-critical-patch-step8'),
                                t('databases.well-architect.oracle-critical-patch-step9')
                            ]
                        )}

                        {createSection(
                            t('databases.well-architect.note'),
                            createContentWithBullets([
                                t('databases.well-architect.oracle-critical-patch-note1'),
                                t('databases.well-architect.oracle-critical-patch-note2')
                            ])
                        )}
                    </>
                );
            default:
                break;
        }
    };

    return <div className={styles['storage-tier-block']}>{setContent()}</div>;
};

export default ApplicationOracleDialog;
