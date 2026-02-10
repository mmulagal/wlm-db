import { DsTypography, Table, useTable } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './DialogContent.module.scss';
import { GENERAL } from '../../../../utils/appConstants';

type MSSQLPatchDialogProps = {
    type: string;
    missingPatchList?: Array<any>;
};

function MSSQLPatchDialog({ type, missingPatchList = [] }: MSSQLPatchDialogProps) {
    const { t } = useTranslation();
    const tableData = useMemo(
        () =>
            missingPatchList?.map((item, index) => ({
                ...item,
                id: index
            })),
        [missingPatchList]
    );

    const EncryptionColDefs: ColumnProps[] = [
        {
            Header:
                type === 'osPatch'
                    ? t('databases.well-architect.ec2instance-name')
                    : t('databases.well-architect.instance-name'),
            accessor: type === 'osPatch' ? 'instanceName' : 'hostInstanceName',
            id: '1',
            isSortable: true,
            width: '180px'
        },
        {
            Header: t('databases.well-architect.kb-id'),
            accessor: 'kbId',
            id: '2',
            isSortable: true,
            width: '137px'
        },
        {
            Header: t('databases.well-architect.name'),
            accessor: 'title',
            id: '3',
            isSortable: true,
            width: '262px'
        },
        {
            Header: t('databases.well-architect.classification'),
            accessor: 'classification',
            id: '4',
            isSortable: true,
            width: '164px'
        },
        {
            Header: t('databases.well-architect.severity'),
            accessor: 'severity',
            id: '5',
            isSortable: true,
            width: '144px'
        }
    ];

    const tableProps = useTable({
        manageColumnsProps: {},
        isSorting: false,
        selectionType: 'none',
        columns: EncryptionColDefs,
        rows: tableData,
        pageSize: 50
    });
    return (
        <div className={styles['storage-tier-block']}>
            <div className={styles['first-section']}>
                <DsTypography variant="Semibold_14">{t('databases.well-architect.action-summary')}</DsTypography>
                <DsTypography variant="Regular_14">
                    {type === 'mssqlPatch'
                        ? t('databases.well-architect.mssql-os-patch-action-summary')
                        : t('databases.well-architect.mssql-os-patch-action-summary')}
                </DsTypography>
            </div>

            <div className={styles['first-section']}>
                <DsTypography variant="Semibold_14" className={styles['fixed-width']}>
                    {t('databases.well-architect.mssql-os-patch-missing-patches')}
                </DsTypography>
                <div className={styles.table}>
                    <Table
                        // @ts-ignore
                        tableProps={tableProps}
                        variant="innerTable"
                    />
                </div>
            </div>

            <div className={styles['first-section']}>
                <DsTypography variant="Semibold_14" className={styles['fixed-width']}>
                    {t('databases.well-architect.mssql-os-patch-action-required')}
                </DsTypography>
                <div className={styles.content}>
                    <div className={styles.row}>
                        <DsTypography variant="Regular_14">
                            {t('databases.well-architect.mssql-os-patch-line1')}
                        </DsTypography>
                    </div>
                </div>
            </div>

            {type === 'osPatch' && (
                <>
                    <div className={styles['first-section']}>
                        <DsTypography variant="Semibold_14" className={styles['fixed-width']}>
                            {t('databases.well-architect.mssql-os-patch-option1')}
                        </DsTypography>
                        <div className={styles['action-section']}>
                            <div className={styles.row}>
                                <DsTypography variant="Semibold_14">1</DsTypography>
                                <DsTypography variant="Regular_14">|</DsTypography>
                                <DsTypography variant="Regular_14">
                                    {t('databases.well-architect.mssql-os-patch-option1-content1')}
                                </DsTypography>
                            </div>

                            <div className={styles.row}>
                                <DsTypography variant="Semibold_14">2</DsTypography>
                                <DsTypography variant="Regular_14">|</DsTypography>
                                <DsTypography variant="Regular_14">
                                    {t('databases.well-architect.mssql-os-patch-option1-content2')}
                                </DsTypography>
                            </div>

                            <div className={styles.row}>
                                <DsTypography variant="Semibold_14">3</DsTypography>
                                <DsTypography variant="Regular_14">|</DsTypography>
                                <DsTypography variant="Regular_14">
                                    {t('databases.well-architect.mssql-os-patch-option1-content3')}
                                </DsTypography>
                            </div>

                            <div className={styles.row}>
                                <DsTypography variant="Semibold_14">4</DsTypography>
                                <DsTypography variant="Regular_14">|</DsTypography>
                                <DsTypography variant="Regular_14">
                                    {t('databases.well-architect.mssql-os-patch-option1-content4')}
                                </DsTypography>
                            </div>

                            <div className={styles.row}>
                                <DsTypography variant="Semibold_14">5</DsTypography>
                                <DsTypography variant="Regular_14">|</DsTypography>
                                <DsTypography variant="Regular_14">
                                    {t('databases.well-architect.mssql-os-patch-option1-content5')}
                                </DsTypography>
                            </div>
                        </div>
                    </div>

                    <div className={styles['first-section']}>
                        <DsTypography variant="Semibold_14" className={styles['fixed-width']}>
                            {t('databases.well-architect.mssql-os-patch-option2')}
                        </DsTypography>
                        <div className={styles['action-section']}>
                            <div className={styles.row}>
                                <DsTypography variant="Semibold_14">1</DsTypography>
                                <DsTypography variant="Regular_14">|</DsTypography>
                                <DsTypography variant="Regular_14">
                                    {t('databases.well-architect.mssql-os-patch-option2-content1')}
                                </DsTypography>
                            </div>

                            <div className={styles.row}>
                                <DsTypography variant="Semibold_14">2</DsTypography>
                                <DsTypography variant="Regular_14">|</DsTypography>
                                <DsTypography variant="Regular_14">
                                    {t('databases.well-architect.mssql-os-patch-option2-content2')}
                                </DsTypography>
                            </div>

                            <div className={styles.row}>
                                <DsTypography variant="Semibold_14">3</DsTypography>
                                <DsTypography variant="Regular_14">|</DsTypography>
                                <DsTypography variant="Regular_14">
                                    {t('databases.well-architect.mssql-os-patch-option2-content3')}
                                </DsTypography>
                            </div>

                            <div className={styles.row}>
                                <DsTypography variant="Semibold_14">4</DsTypography>
                                <DsTypography variant="Regular_14">|</DsTypography>
                                <DsTypography variant="Regular_14">
                                    {t('databases.well-architect.mssql-os-patch-option2-content4')}
                                </DsTypography>
                            </div>

                            <div className={styles.row}>
                                <DsTypography variant="Semibold_14">5</DsTypography>
                                <DsTypography variant="Regular_14">|</DsTypography>
                                <DsTypography variant="Regular_14">
                                    {t('databases.well-architect.mssql-os-patch-option2-content5')}
                                </DsTypography>
                            </div>

                            <div className={styles.row}>
                                <DsTypography variant="Semibold_14">6</DsTypography>
                                <DsTypography variant="Regular_14">|</DsTypography>
                                <DsTypography variant="Regular_14">
                                    {t('databases.well-architect.mssql-os-patch-option2-content6')}
                                </DsTypography>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {type === 'mssqlPatch' && (
                <div className={styles['action-section']}>
                    <div className={styles.row}>
                        <DsTypography variant="Semibold_14">1</DsTypography>
                        <DsTypography variant="Regular_14">|</DsTypography>
                        <DsTypography variant="Regular_14">
                            {t('databases.well-architect.mssql-os-patch-mssql-patch-content1')}
                        </DsTypography>
                    </div>

                    <div className={styles.row}>
                        <DsTypography variant="Semibold_14">2</DsTypography>
                        <DsTypography variant="Regular_14">|</DsTypography>
                        <DsTypography variant="Regular_14">
                            {t('databases.well-architect.mssql-os-patch-mssql-patch-content2')}
                        </DsTypography>
                    </div>

                    <div className={styles.row}>
                        <DsTypography variant="Semibold_14">3</DsTypography>
                        <DsTypography variant="Regular_14">|</DsTypography>
                        <DsTypography variant="Regular_14">
                            {t('databases.well-architect.mssql-os-patch-mssql-patch-content3')}
                        </DsTypography>
                    </div>

                    <div className={styles.row}>
                        <DsTypography variant="Semibold_14">4</DsTypography>
                        <DsTypography variant="Regular_14">|</DsTypography>
                        <DsTypography variant="Regular_14">
                            {t('databases.well-architect.mssql-os-patch-mssql-patch-content4')}
                        </DsTypography>
                    </div>

                    <div className={styles.row}>
                        <DsTypography variant="Semibold_14">5</DsTypography>
                        <DsTypography variant="Regular_14">|</DsTypography>
                        <DsTypography variant="Regular_14">
                            {t('databases.well-architect.mssql-os-patch-mssql-patch-content5')}
                        </DsTypography>
                    </div>

                    <div className={styles.row}>
                        <DsTypography variant="Semibold_14">6</DsTypography>
                        <DsTypography variant="Regular_14">|</DsTypography>
                        <DsTypography variant="Regular_14">
                            {t('databases.well-architect.mssql-os-patch-mssql-patch-content6')}
                        </DsTypography>
                    </div>
                </div>
            )}

            <div className={styles['first-section']}>
                <DsTypography variant="Semibold_14" className={styles['fixed-width']}>
                    {GENERAL.NOTE}
                </DsTypography>
                <div className={styles.content}>
                    <div className={styles.row}>
                        <DsTypography variant="Regular_14">
                            {type === 'mssqlPatch'
                                ? t('databases.well-architect.mssql-os-patch-note1')
                                : t('databases.well-architect.mssql-os-patch-note2')}
                        </DsTypography>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default MSSQLPatchDialog;
