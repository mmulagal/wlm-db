import { DsFlashingDotsLoader, DsTypography, Table, useTable } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './DialogContent.module.scss';
import { GENERAL } from '../../../../utils/appConstants';
import { ReactComponent as Bullet } from '../../../../assets/ic_bullet.svg';
import { useAppSelector } from '../../../../store/storeHooks';
import { useGetMissingPatchAssessmentDataQuery } from '../../../../utils/apiService';
import { PATCH_DIALOG_TYPE, PATCH_SCAN_FIELD, WIZARD_TYPE } from '../../../../utils/consts';

type PatchScanField = (typeof PATCH_SCAN_FIELD)[keyof typeof PATCH_SCAN_FIELD];

type MSSQLPatchDialogProps = {
    type: string;
};

// Shape of a single patch row returned by /assessment/patch-scan for MSSQL and
// host-OS scans. Fields mirror the column accessors used in the table below.
interface PatchDetail {
    kbId?: string;
    title?: string;
    classification?: string;
    severity?: string;
}

interface PatchInstance {
    ec2InstanceId?: string;
    ec2InstanceName?: string;
    missingPatchDetails?: PatchDetail[];
}

interface MssqlPatchResponse {
    missingPatchesInEc2Instances?: PatchInstance[];
    ec2InstancesToPatch?: PatchInstance[];
}

interface HostOsPatchResponse {
    ec2InstancesToPatch?: PatchInstance[];
}

type PatchScanResponse = MssqlPatchResponse | HostOsPatchResponse;

// Row shape consumed by the useTable columns (PatchDetail + per-row instance name + id).
type PatchRow = PatchDetail & { instanceName?: string };

// Flattens the patch-scan response into a single list of patch rows.
// Both MSSQL_PATCH and HOST_OS_PATCH backends return `ec2InstancesToPatch`;
// older MSSQL responses used `missingPatchesInEc2Instances`, so we keep that as a fallback.
const flattenPatchResponse = (field: PatchScanField, response: PatchScanResponse | undefined): PatchRow[] => {
    if (!response) return [];
    const instances: PatchInstance[] =
        field === PATCH_SCAN_FIELD.MSSQL_PATCH
            ? (response as MssqlPatchResponse).missingPatchesInEc2Instances ??
              (response as MssqlPatchResponse).ec2InstancesToPatch ??
              []
            : (response as HostOsPatchResponse).ec2InstancesToPatch ?? [];
    return instances.flatMap(instance =>
        (instance.missingPatchDetails ?? []).map<PatchRow>(patch => ({
            ...patch,
            instanceName: instance.ec2InstanceName
        }))
    );
};

function MSSQLPatchDialog({ type }: MSSQLPatchDialogProps) {
    const { t } = useTranslation();
    const { selectedResourceId, selectedDatabaseInstance, selectedGwInstanceCredId, selectedGwInstanceRegionId } =
        useAppSelector(state => state.getWellOptimize);

    const field: PatchScanField =
        type === PATCH_DIALOG_TYPE.MSSQL_PATCH ? PATCH_SCAN_FIELD.MSSQL_PATCH : PATCH_SCAN_FIELD.HOST_OS_PATCH;
    const hasIds = Boolean(
        selectedGwInstanceCredId && selectedGwInstanceRegionId && selectedResourceId && selectedDatabaseInstance
    );

    const { data: missingPatchResponse, isFetching } = useGetMissingPatchAssessmentDataQuery(
        {
            dbType: WIZARD_TYPE.MSSQL,
            credentialId: selectedGwInstanceCredId,
            regionId: selectedGwInstanceRegionId,
            databaseHostId: selectedResourceId,
            instanceId: selectedDatabaseInstance,
            field
        },
        { skip: !hasIds }
    );

    const tableData = useMemo(() => {
        const list = flattenPatchResponse(field, missingPatchResponse as PatchScanResponse | undefined);
        return list.map((item, index) => ({ ...item, id: String(index) }));
    }, [field, missingPatchResponse]);

    const EncryptionColDefs: ColumnProps[] = [
        {
            Header: t('databases.well-architect.kb-id'),
            accessor: 'kbId',
            id: '1',
            isSortable: true,
            width: '137px'
        },
        {
            Header: t('databases.well-architect.name'),
            accessor: 'title',
            id: '2',
            isSortable: true,
            width: '262px'
        },
        {
            Header: t('databases.well-architect.classification'),
            accessor: 'classification',
            id: '3',
            isSortable: true,
            width: '164px'
        },
        {
            Header: t('databases.well-architect.severity'),
            accessor: 'severity',
            id: '4',
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
        pageSize: 50,
        isLazyLoading: isFetching
    });
    return (
        <div className={styles['storage-tier-block']}>
            <div className={styles['first-section']}>
                <DsTypography variant="Semibold_14">{t('databases.well-architect.action-summary')}</DsTypography>
                <DsTypography variant="Regular_14">
                    {type === PATCH_DIALOG_TYPE.MSSQL_PATCH
                        ? t('databases.well-architect.mssql-os-patch-action-summary')
                        : t('databases.well-architect.mssql-os-patch-action-summary')}
                </DsTypography>
            </div>

            <div className={styles['first-section']}>
                <div className={styles['heading-with-loader']}>
                    <DsTypography variant="Semibold_14">
                        {t('databases.well-architect.mssql-os-patch-missing-patches')}
                    </DsTypography>
                    {isFetching && <DsFlashingDotsLoader />}
                </div>
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

            {type === PATCH_DIALOG_TYPE.OS_PATCH && (
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

            {type === PATCH_DIALOG_TYPE.MSSQL_PATCH && (
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
                        <div>
                            <Bullet />
                        </div>
                        <DsTypography variant="Regular_14">
                            {type === PATCH_DIALOG_TYPE.MSSQL_PATCH
                                ? t('databases.well-architect.mssql-os-patch-note1')
                                : t('databases.well-architect.mssql-os-patch-note2')}
                        </DsTypography>
                    </div>
                    {type === PATCH_DIALOG_TYPE.MSSQL_PATCH && (
                        <div className={styles.row}>
                            <div>
                                <Bullet />
                            </div>
                            <DsTypography variant="Regular_14">
                                {t('databases.well-architect.mssql-os-patch-note-aoag')}
                            </DsTypography>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default MSSQLPatchDialog;
