import { Button, DsTypography, SelectField } from '@netapp/design-system';
import { useDispatch } from 'react-redux';
import { optionType } from '@netapp/design-system/dist/components/Select';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './DialogContent.module.scss';
import { ReactComponent as CopyIcon } from '../../../../assets/ic_copy.svg';
import { GENERAL, GETWELL_DIALOG_CONTENT } from '../../../../utils/appConstants';
import { useAppSelector } from '../../../../store/storeHooks';
import {
    setRecommendedInstanceInBulk,
    setSelectedRecommendedInstance
} from '../../../../store/workloadFactory/getWellOptimizeSlice';
import { generateOptionType } from '../../../../utils/utilityFunctions';
import CopyToClipboardCommon from '../../../../common/CopyToClipboard/copyToClipboard';
import CommonStyles from '../../../../utils/CommonStyles.module.scss';
import { ASSESSMENT_CONFIG_NAMES, AWS_RESIZE_URL, DBType } from '../../../../utils/consts';
import MSSQLPatchDialog from './MSSQLPatchDialog';

import ScheduledLocalSnapshotDalog from './ScheduledLocalSnapshotDalog';
import ScheduledAWSBackupDialog from './ScheduledAWSBackupDialog';
import {
    createBulletRow,
    createClusterQuorumSQLNotesSection,
    createCodeBox,
    createContentWithBullets,
    createDriveLetterNotesSection,
    createDriveSizeMissingPermissionsDialog,
    createFailoverClusterDialog,
    createFailoverClusterNotesSection,
    createOSNotesSection,
    createSection,
    createStandardDialog,
    createStandardNotesSection
} from './DialogContentHelper';
import StorageLayoutOracleDialog from './StorageLayoutOracleDialog';
import StorageConfigOracleDialog from './StorageConfigOracleDialog';

interface SavingsOpportunity {
    savingsOpportunityPercentage?: number;
}

interface RecommendationOption {
    instanceType?: string;
    rank?: number;
    savingsOpportunity?: SavingsOpportunity;
    // Index signature for flexibility
    [key: string]: unknown;
}

interface BulkRecommendationOption {
    hostName?: string;
    recommendationOptions?: RecommendationOption[];
    missingPermissions?: boolean;
    // Index signature for additional properties
    [key: string]: unknown;
}

interface MissingPatch {
    classification?: string;
    kbId?: string;
    severity?: string;
    state?: string;
    title?: string;
}

type DialogType = {
    type: string;
    recommendationOptions?: RecommendationOption[];
    missingPermissions?: string[];
    recommendedSizeInGib?: number;
    bulkRecommendationOptions?: BulkRecommendationOption[];
    missingPatchList?: MissingPatch[];
    operation?: string;
    objectsInViolation?: string[];
    engineType?: string;
    assessmentStatus?: boolean;
};

const DialogContent = ({
    type,
    recommendationOptions = [],
    missingPermissions,
    recommendedSizeInGib,
    bulkRecommendationOptions = [],
    missingPatchList = [],
    operation = 'single',
    objectsInViolation = [],
    engineType = DBType.MSSQL,
    assessmentStatus = false
}: DialogType) => {
    const dispatch = useDispatch();
    const { t } = useTranslation();
    const { selectedRecommendedInstance, selectedDatabaseStorageType, recommendedInstanceInBulk } = useAppSelector(
        state => state.getWellOptimize
    );

    const generateRecommendedInstanceTypes = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        recommendationOptions?.forEach((option: RecommendationOption) => {
            const label2 = option?.savingsOpportunity?.savingsOpportunityPercentage
                ? `Savings opportunity: ${option?.savingsOpportunity?.savingsOpportunityPercentage}%`
                : '';
            options.push(generateOptionType(option?.instanceType, option?.instanceType, label2, false, ''));
        });
        if (options.length > 1) {
            dispatch(setSelectedRecommendedInstance(options[0]));
        }
        return options;
    }, [recommendationOptions, dispatch]); // Added 'dispatch' to the dependency array to comply with React Hooks rules and prevent stale closures

    const generateRecommendedInstanceTypesForHost = (instance: BulkRecommendationOption) => {
        const options: optionType[] = [];
        instance?.recommendationOptions?.forEach((option: RecommendationOption) => {
            const label2 = option?.savingsOpportunity?.savingsOpportunityPercentage
                ? `Savings opportunity: ${option?.savingsOpportunity?.savingsOpportunityPercentage}%`
                : '';
            options.push(generateOptionType(option?.instanceType, option?.instanceType, label2, false, ''));
        });
        if (options.length > 1 && instance?.hostName && !recommendedInstanceInBulk?.[instance.hostName]) {
            dispatch(setRecommendedInstanceInBulk({ type: instance.hostName, value: options[0] }));
        }
        return options;
    };

    const ontapConfigTextSet = () => {
        if (engineType === DBType.ORACLE) {
            switch (type) {
                case 'Thin provisioning':
                    return 'Thin provisioninig (-space-guarantee = none)';
                case 'Autosize':
                    return 'Autosize on';
                case 'Autosize-mode':
                    return 'Autosize-mode = grow';
                case 'Fractional reserve':
                    return 'Fractional reserve = 0%';
                case 'Snapshot copy reserve':
                    return 'Snapshot copy reserve = 0%';
                case 'Snapshot autodelete':
                    return 'Snapshot autodelete (Volume/oldest first)';
                case 'Space management':
                    return 'Space-mgmt-try-first = volume_grow';
                case ASSESSMENT_CONFIG_NAMES.SNAPSHOT_POLICY:
                    return 'Snapshot policy = none';
                case 'Tiering policy':
                    return [
                        "[Data] tiering policy='none'",
                        "[Redo Log] tiering policy='none'",
                        "[Archive] tiering policy='auto'"
                    ];
                case 'Tiering minimum cooling days':
                    return [
                        '[Archive,RMAN-compressed] tiering-minimum-cooling-days=2',
                        '[Archive, RMAN uncompressed] tiering-minimum-cooling-days=14'
                    ];
                case ASSESSMENT_CONFIG_NAMES.COMPRESSION:
                    return ['[Log] Compression= disabled', '[Data, Archive] Compression=Inline, adaptive'];
                case ASSESSMENT_CONFIG_NAMES.COMPACTION:
                    return 'Compaction = enabled';
                case ASSESSMENT_CONFIG_NAMES.DEDUPLICATION:
                    return ['[Log] Deduplication = disabled', '[Data, Archive] Deduplication = Inline'];
                case 'OS type':
                    return 'OS type = linux';
                case 'Space reservation':
                    return 'Space reservation enabled ';
                case 'Space allocation':
                    return 'Space allocation enabled';
            }
        }
        switch (type) {
            case 'Autosize':
                return 'Autosize on';
            case 'Thin provisioning':
                return 'Thin provisioninig (-space-guarantee = none)';
            case 'Autosize-mode':
                return 'Autosize-mode = grow';
            case 'Fractional reserve':
                return 'Fractional reserve = 0%';
            case 'Snapshot copy reserve':
                return 'Snapshot copy reserve = 0%';
            case 'Snapshot autodelete':
                return 'Snapshot autodelete (Volume/oldest first)';
            case 'Space management':
                return 'Space-mgmt-try-first = volume_grow';
            case 'Tiering policy':
                return 'Tiering-policy = snapshot-only';
            case 'Tiering minimum cooling days':
                return 'Tiering-minimum-cooling-days = 7';
            case 'OS type':
                return 'OS type = windows_2008 ';
            case 'Space reservation':
                return 'Space reservation enabled ';
            case 'Space allocation':
                return 'Space allocation enabled';
            case 'Multipath I/O Status':
                return 'Multipath I/O Status = Enabled';
            case 'Multipath I/O Policy':
                return 'Multipath I/O Policy = Round Robin';
            case 'Multipath I/O Sessions':
                return 'Multipath I/O Sessions = 5';
            case 'Multipath I/O Timeout':
                return 'Multipath I/O Timeout = 60 seconds';
            case 'Shared storage':
                return 'Mapping on impacted LUNs will be updated to include initiator names of both EC2 nodes';
            case 'Drive Letter':
                return objectsInViolation && objectsInViolation.length > 0
                    ? `Drives ${objectsInViolation.map(drive => drive.replace(':', '')).join(', ')} ${t(
                          'databases.well-architect.drive-letter-conflicting-drives'
                      )}`
                    : t('databases.well-architect.drive-letter-no-violation');
            case 'Cluster Quorum':
                return 'Quorum will be set to disk witness with node majority';
            case 'SQL Server Services':
                return objectsInViolation && objectsInViolation.length > 0
                    ? [
                          `${t('databases.well-architect.sql-service-startup-type-config')}${objectsInViolation.join(
                              ', node-'
                          )}`,
                          t('databases.well-architect.sql-service-role-ownership-config')
                      ]
                    : [];
            default:
                return '';
        }
    };

    const engineTypeText = () => {
        switch (engineType) {
            case DBType.MSSQL:
                return 'SQL Server';
            case DBType.ORACLE:
                return 'Oracle';
            case DBType.POSTGRESQL:
                return 'PostgreSQL';
            default:
                return '';
        }
    };

    const createONTAPConfigSection = () =>
        createSection(
            t('databases.well-architect.well-architected-configuration'),
            createCodeBox(ontapConfigTextSet()),
            { width: '712px' }
        );

    const setContent = () => {
        if (engineType === DBType.ORACLE) {
            switch (type) {
                // Oracle storage layout assessment
                case ASSESSMENT_CONFIG_NAMES.REDO_LOGS_PLACEMENT:
                case ASSESSMENT_CONFIG_NAMES.TEMP_LOGS_PLACEMENT:
                case ASSESSMENT_CONFIG_NAMES.ARCHIVE_PLACEMENT:
                case ASSESSMENT_CONFIG_NAMES.DATAFILES_PLACEMENT:
                case ASSESSMENT_CONFIG_NAMES.CONTROLFILES_PLACEMENT:
                case ASSESSMENT_CONFIG_NAMES.ORACLE_BINARY_PLACEMENT:
                    return <StorageLayoutOracleDialog type={type} />;

                // Oracle storage config ONTAP assessment
                case 'Thin provisioning':
                case 'Autosize':
                case 'Autosize-mode':
                case 'Fractional reserve':
                case 'Snapshot copy reserve':
                case 'Snapshot autodelete':
                case 'Space management':
                case 'Tiering policy':
                case ASSESSMENT_CONFIG_NAMES.COMPACTION:
                case ASSESSMENT_CONFIG_NAMES.DEDUPLICATION:
                case ASSESSMENT_CONFIG_NAMES.COMPRESSION:
                case ASSESSMENT_CONFIG_NAMES.SNAPSHOT_POLICY:
                case 'Tiering minimum cooling days':
                case 'OS type':
                case 'Space reservation':
                case 'Space allocation':
                    return (
                        <StorageConfigOracleDialog type={type} createONTAPConfigSection={createONTAPConfigSection} />
                    );
            }
        }
        switch (type) {
            case GENERAL.CLONE_MANAGEMENT_REFRESH:
                return createStandardDialog(
                    t,
                    t('databases.well-architect.clone-refresh-action-summary'),
                    t('databases.well-architect.clone-refresh-what-will-happen'),
                    createSection(
                        GENERAL.NOTE,
                        createContentWithBullets([
                            t('databases.well-architect.note1'),
                            t('databases.well-architect.note2')
                        ]),
                        { width: '712px' }
                    )
                );
            case GENERAL.CLONE_MANAGEMENT_DELETE:
                return createStandardDialog(
                    t,
                    t('databases.well-architect.clone-delete-action-summary'),
                    t('databases.well-architect.clone-delete-what-will-happen'),
                    createSection(
                        GENERAL.NOTE,
                        createContentWithBullets([
                            t('databases.well-architect.note1'),
                            t('databases.well-architect.note2')
                        ]),
                        { width: '712px' }
                    )
                );
            case ASSESSMENT_CONFIG_NAMES.STORAGE_TIER:
                return createStandardDialog(
                    t,
                    t('databases.well-architect.storage-tier-action-summary'),
                    createContentWithBullets([
                        t('databases.well-architect.storage-tier-what-will-happen-content1'),
                        t('databases.well-architect.storage-tier-what-will-happen-content2'),
                        t('databases.well-architect.storage-tier-what-will-happen-content3')
                    ]),
                    createStandardNotesSection(),
                    '',
                    assessmentStatus
                );
            case ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM:
                return missingPermissions && missingPermissions.length ? (
                    <div className={styles['storage-tier-block']}>
                        {createSection(
                            t('databases.well-architect.action-summary'),
                            t('databases.well-architect.file-system-headroom-action-summary')
                        )}

                        {createSection(
                            t('databases.well-architect.action-required'),
                            t('databases.well-architect.file-system-headroom-choose-option1'),
                            { width: '712px' }
                        )}

                        {createSection(
                            t('databases.well-architect.file-system-headroom-option1-content'),
                            <>
                                <DsTypography variant="Regular_14" style={{ width: '712px' }}>
                                    {t('databases.well-architect.drive-size-and-headroom-action-content1')}
                                </DsTypography>
                                {createContentWithBullets([
                                    t('databases.well-architect.drive-size-and-headroom-action-content2'),
                                    t('databases.well-architect.drive-size-and-headroom-action-content3')
                                ])}
                                <div className={styles['dialog-body']}>
                                    <div className={styles['code-box']}>
                                        <div className={styles.code}>
                                            <DsTypography variant="Regular_14">
                                                {missingPermissions.map((permission: string) => (
                                                    <DsTypography key={permission} variant="Regular_14">
                                                        {permission}
                                                    </DsTypography>
                                                ))}
                                            </DsTypography>
                                            <div className={styles.copy}>
                                                <CopyToClipboardCommon
                                                    value={missingPermissions}
                                                    iconProvided={
                                                        <div className={styles.menuItem}>
                                                            <CopyIcon />
                                                        </div>
                                                    }
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </>,
                            { width: '712px' }
                        )}

                        {createSection(
                            t('databases.well-architect.file-system-headroom-option2'),
                            <>
                                <DsTypography variant="Regular_14" style={{ width: '712px' }}>
                                    {t('databases.well-architect.file-system-headroom-option2-content1')}
                                </DsTypography>
                                <div className={styles.content}>
                                    <div className={styles.row}>
                                        <DsTypography variant="Semibold_14">1|</DsTypography>
                                        <DsTypography variant="Regular_14">
                                            {t('databases.well-architect.file-system-headroom-option2-content2')}
                                        </DsTypography>
                                    </div>
                                    <div className={styles.row}>
                                        <DsTypography variant="Semibold_14">2|</DsTypography>
                                        <DsTypography variant="Regular_14">
                                            {t('databases.well-architect.file-system-headroom-option2-content3')}
                                        </DsTypography>
                                    </div>
                                    <div className={styles.row}>
                                        <DsTypography variant="Semibold_14">3|</DsTypography>
                                        <DsTypography variant="Regular_14">
                                            {t('databases.well-architect.file-system-headroom-option2-content4')}
                                        </DsTypography>
                                    </div>
                                    <div className={styles.row}>
                                        <DsTypography variant="Semibold_14">4|</DsTypography>
                                        <DsTypography variant="Regular_14">
                                            {t('databases.well-architect.file-system-headroom-option2-content5')}
                                            {recommendedSizeInGib ? `${recommendedSizeInGib} GiB.` : '.'}
                                        </DsTypography>
                                    </div>
                                </div>
                            </>,
                            { width: '712px' }
                        )}
                    </div>
                ) : (
                    createStandardDialog(
                        t,
                        t('databases.well-architect.file-system-headroom-with-permission'),
                        `${t('databases.well-architect.file-system-headroom-with-permission-content')}${
                            recommendedSizeInGib ? ` to ${recommendedSizeInGib} GiB.` : '.'
                        }`,
                        createStandardNotesSection()
                    )
                );

            case ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE:
                return missingPermissions && missingPermissions.length
                    ? createDriveSizeMissingPermissionsDialog(t, missingPermissions)
                    : createStandardDialog(
                          t,
                          t('databases.well-architect.log-drive-size-action-summary'),
                          createContentWithBullets([t('databases.well-architect.log-drive-size-what-will-happen')]),
                          createStandardNotesSection(),
                          '',
                          assessmentStatus
                      );

            case ASSESSMENT_CONFIG_NAMES.TEMPDB_DRIVE_SIZE:
                return missingPermissions && missingPermissions.length
                    ? createDriveSizeMissingPermissionsDialog(t, missingPermissions)
                    : createStandardDialog(
                          t,
                          t('databases.well-architect.tempdb-drive-size-action-summary'),
                          createContentWithBullets([t('databases.well-architect.tempdb-drive-size-what-will-happen')]),
                          createStandardNotesSection()
                      );
            case 'Thin provisioning':
            case 'Autosize':
            case 'Autosize-mode':
            case 'Fractional reserve':
            case 'Snapshot copy reserve':
            case 'Snapshot autodelete':
            case 'Space management':
            case 'Tiering policy':
            case ASSESSMENT_CONFIG_NAMES.COMPACTION:
            case ASSESSMENT_CONFIG_NAMES.DEDUPLICATION:
            case ASSESSMENT_CONFIG_NAMES.COMPRESSION:
            case ASSESSMENT_CONFIG_NAMES.SNAPSHOT_POLICY:
            case 'Tiering minimum cooling days':
                return createStandardDialog(
                    t,
                    t('databases.well-architect.autosize-action-summary', { engineType: engineTypeText() }),
                    t('databases.well-architect.autosize-what-will-happen', { engineType: engineTypeText() }),
                    createStandardNotesSection(),
                    createONTAPConfigSection()
                );

            case 'OS type':
            case 'Space reservation':
            case 'Space allocation':
                return createStandardDialog(
                    t,
                    t('databases.well-architect.os-type-space-allocation-reservation-action-summary', {
                        engineType: engineTypeText()
                    }),
                    t('databases.well-architect.os-type-space-allocation-reservation-what-will-happen', {
                        engineType: engineTypeText()
                    }),
                    createStandardNotesSection(),
                    createONTAPConfigSection()
                );

            case 'Multipath I/O Status':
            case 'Multipath I/O Policy':
                return createStandardDialog(
                    t,
                    t('databases.well-architect.mpio-status-policy-action-summary'),
                    t('databases.well-architect.mpio-status-policy-what-will-happen'),
                    createOSNotesSection(),
                    createONTAPConfigSection()
                );

            case 'Multipath I/O Timeout':
                return createStandardDialog(
                    t,
                    t('databases.well-architect.mpio-timeout-action-summary'),
                    t('databases.well-architect.mpio-timeout-what-will-happen'),
                    createSection(GENERAL.NOTE, t('databases.well-architect.note1'), { width: '712px' }),
                    createONTAPConfigSection()
                );

            case 'Multipath I/O Sessions':
                return createStandardDialog(
                    t,
                    t('databases.well-architect.mpio-session-action-summary'),
                    t('databases.well-architect.mpio-session-what-will-happen'),
                    createStandardNotesSection(),
                    createONTAPConfigSection()
                );

            case 'Microsoft SQL Server patch':
                return <MSSQLPatchDialog type="mssqlPatch" missingPatchList={missingPatchList} />;

            case 'Operating system patch':
                return <MSSQLPatchDialog type="osPatch" missingPatchList={missingPatchList} />;
            case 'NTFS allocation unit size':
                return (
                    <div className={styles['storage-tier-block']}>
                        {createSection(
                            t('databases.well-architect.action-summary'),
                            <>
                                <DsTypography variant="Regular_14">
                                    {t('databases.well-architect.ntfs-allocation-action-summary1')}
                                </DsTypography>
                                <DsTypography variant="Regular_14">
                                    {t('databases.well-architect.ntfs-allocation-action-summary2')}
                                </DsTypography>
                            </>
                        )}

                        {createSection(
                            t('databases.well-architect.downtime-warning'),
                            t('databases.well-architect.ntfs-allocation-downtime-warning-content')
                        )}

                        {createSection(
                            t('databases.well-architect.optimization-steps'),
                            createContentWithBullets([
                                t('databases.well-architect.ntfs-allocation-optimization-steps1'),
                                t('databases.well-architect.ntfs-allocation-optimization-steps2'),
                                t('databases.well-architect.ntfs-allocation-optimization-steps3'),
                                t('databases.well-architect.ntfs-allocation-optimization-steps4'),
                                t('databases.well-architect.ntfs-allocation-optimization-steps5')
                            ]),
                            { width: '712px' }
                        )}
                    </div>
                );

            case 'Shared storage':
                return createFailoverClusterDialog(
                    t,
                    [
                        t('databases.well-architect.failover-cluster-action-summary'),
                        t('databases.well-architect.shared-storage-action-summary')
                    ],
                    t('databases.well-architect.shared-storage-what-will-happen'),
                    // createONTAPConfigSection(),     will be added again after the dynamic values are populated
                    <></>,
                    createFailoverClusterNotesSection(t)
                );
            case 'Drive Letter':
                return createFailoverClusterDialog(
                    t,
                    [
                        t('databases.well-architect.failover-cluster-action-summary'),
                        t('databases.well-architect.drive-letter-action-summary1'),
                        t('databases.well-architect.drive-letter-action-summary2')
                    ],
                    '',
                    createSection(
                        t('databases.well-architect.well-architected-configuration'),
                        createCodeBox(ontapConfigTextSet()),
                        { width: '712px' }
                    ),
                    createDriveLetterNotesSection(t)
                );
            case 'Heartbeat Settings':
                return createFailoverClusterDialog(
                    t,
                    [
                        t('databases.well-architect.failover-cluster-action-summary'),
                        t('databases.well-architect.heartbeat-setting-action-summary1'),
                        t('databases.well-architect.heartbeat-setting-action-summary2'),
                        t('databases.well-architect.heartbeat-setting-action-summary3')
                    ],
                    createContentWithBullets([
                        t('databases.well-architect.heartbeat-setting-what-will-happen-content1'),
                        t('databases.well-architect.heartbeat-setting-what-will-happen-content2'),
                        t('databases.well-architect.heartbeat-setting-what-will-happen-content3'),
                        t('databases.well-architect.heartbeat-setting-what-will-happen-content4'),
                        t('databases.well-architect.heartbeat-setting-what-will-happen-content5'),
                        t('databases.well-architect.heartbeat-setting-what-will-happen-content6')
                    ]),
                    <></>, // Placeholder to maintain parameter order when skipping optional sections
                    createFailoverClusterNotesSection(t)
                );
            case 'Cluster Quorum':
                return createFailoverClusterDialog(
                    t,
                    [
                        t('databases.well-architect.failover-cluster-action-summary'),
                        t('databases.well-architect.cluster-quorum-action-summary')
                    ],
                    t('databases.well-architect.cluster-quorum-what-will-happen'),
                    // createONTAPConfigSection(),  will be added again after the dynamic values are populated
                    <></>,
                    createClusterQuorumSQLNotesSection(t)
                );
            case 'SQL Server Services':
                return createFailoverClusterDialog(
                    t,
                    [
                        t('databases.well-architect.sql-server-configuration-action-summary1'),
                        t('databases.well-architect.sql-server-configuration-action-summary2')
                    ],
                    t('databases.well-architect.sql-server-configuration-what-will-happen'),
                    createONTAPConfigSection(),
                    createClusterQuorumSQLNotesSection(t)
                );

            case ASSESSMENT_CONFIG_NAMES.SCHEDULED_LOCAL_SNAPSHOT:
                return <ScheduledLocalSnapshotDalog type={type} data={bulkRecommendationOptions} />;
            case ASSESSMENT_CONFIG_NAMES.COMPUTE_RIGHTSIZING:
                return (
                    <div className={styles['storage-tier-block']}>
                        {createSection(
                            GETWELL_DIALOG_CONTENT.ACTION_SUMMARY,
                            GETWELL_DIALOG_CONTENT.COMPUTE_RS_AS_DESC
                        )}

                        {createSection(
                            GETWELL_DIALOG_CONTENT.USER_ACTION_REQUIRED,
                            <div className={styles.content}>
                                <div className={styles.row}>
                                    <DsTypography variant="Regular_14">
                                        {GETWELL_DIALOG_CONTENT.SELECT_INSTANCE}
                                    </DsTypography>
                                </div>
                                {operation === 'single' && (
                                    <div className={styles.instanceTypeContainer}>
                                        <SelectField
                                            label={GENERAL.RECOMMENDED_INSTANCE_TYPE}
                                            isClearable={false}
                                            isDisabled={false}
                                            variant="two-lines"
                                            value={selectedRecommendedInstance}
                                            onChange={(selectedOptions: optionType[]): void => {
                                                dispatch(setSelectedRecommendedInstance(selectedOptions[0]));
                                            }}
                                            isSearchable={generateRecommendedInstanceTypes?.length > 5}
                                            options={generateRecommendedInstanceTypes}
                                            className={`${styles.widthSet}`}
                                        />
                                    </div>
                                )}

                                {operation === 'bulk' &&
                                    bulkRecommendationOptions
                                        ?.reduce(
                                            (
                                                acc: BulkRecommendationOption[],
                                                perInstance: BulkRecommendationOption
                                            ) => {
                                                if (!acc.some(item => item.hostName === perInstance.hostName)) {
                                                    acc.push(perInstance);
                                                }
                                                return acc;
                                            },
                                            []
                                        )
                                        ?.map((perInstance: BulkRecommendationOption) => (
                                            <div
                                                key={perInstance.hostName || 'unknown-host'}
                                                className={styles.instanceTypeContainer}
                                            >
                                                <SelectField
                                                    label={GENERAL.RECOMMENDED_INSTANCE_TYPE}
                                                    isClearable={false}
                                                    isDisabled={perInstance?.missingPermissions}
                                                    variant="two-lines"
                                                    value={recommendedInstanceInBulk?.[perInstance?.hostName || '']}
                                                    onChange={(selectedOptions: optionType[]): void => {
                                                        if (perInstance?.hostName && selectedOptions.length > 0) {
                                                            dispatch(
                                                                setRecommendedInstanceInBulk({
                                                                    type: perInstance.hostName,
                                                                    value: selectedOptions[0]
                                                                })
                                                            );
                                                        }
                                                    }}
                                                    isSearchable={
                                                        generateRecommendedInstanceTypesForHost(perInstance)?.length > 5
                                                    }
                                                    options={generateRecommendedInstanceTypesForHost(perInstance)}
                                                    className={`${styles.widthSet}`}
                                                />
                                            </div>
                                        ))}
                            </div>,
                            { width: '712px' }
                        )}

                        {createSection(
                            GETWELL_DIALOG_CONTENT.WHAT_WILL_HAPPEN,
                            selectedDatabaseStorageType === 'FCI'
                                ? createContentWithBullets([
                                      GETWELL_DIALOG_CONTENT.COMPUTE_RS_WWH_DESC_FCI[0],
                                      GETWELL_DIALOG_CONTENT.COMPUTE_RS_WWH_DESC_FCI[1]
                                  ])
                                : createBulletRow(GETWELL_DIALOG_CONTENT.COMPUTE_RS_WWH_DESC_STANDALONE, false),
                            { width: '712px' }
                        )}

                        {createSection(
                            selectedDatabaseStorageType === 'FCI'
                                ? GENERAL.NOTE
                                : GETWELL_DIALOG_CONTENT.DOWNTIME_WARNING,
                            createContentWithBullets([
                                ...(selectedDatabaseStorageType === 'FCI'
                                    ? GETWELL_DIALOG_CONTENT.COMPUTE_RS_DTW_NOTES_FCI
                                    : GETWELL_DIALOG_CONTENT.COMPUTE_RS_DTW_NOTES_STANDALONE),
                                <DsTypography key="aws-link" variant="Regular_14">
                                    {GETWELL_DIALOG_CONTENT.COMPUTE_RS_LAST_POINT[0]}
                                    <Button
                                        Component="button"
                                        variant="link"
                                        className={CommonStyles.buttonClass}
                                        onClick={() => {
                                            // To open new tab with AWS resize page on click of credential link
                                            window.open(AWS_RESIZE_URL, '_blank', 'noopener');
                                        }}
                                    >
                                        {GETWELL_DIALOG_CONTENT.COMPUTE_RS_LAST_POINT[1]}
                                    </Button>
                                    {GETWELL_DIALOG_CONTENT.COMPUTE_RS_LAST_POINT[2]}
                                </DsTypography>
                            ]),
                            { width: '712px' }
                        )}
                    </div>
                );

            case ASSESSMENT_CONFIG_NAMES.SCHEDULED_FSX_FOR_ONTAP_BACKUPS:
                return <ScheduledAWSBackupDialog type={type} />;

            case ASSESSMENT_CONFIG_NAMES.MAXDOP:
                return createStandardDialog(
                    t,
                    t('databases.well-architect.maxdop-action-summary'),
                    t('databases.well-architect.maxdop-what-will-happen'),
                    createStandardNotesSection()
                );
            case ASSESSMENT_CONFIG_NAMES.RSS_CONFIGURATION:
                return (
                    <div className={styles['storage-tier-block']}>
                        {createSection(
                            t('databases.well-architect.action-summary'),
                            t('databases.well-architect.rss-action-summary')
                        )}

                        {createSection(
                            t('databases.well-architect.what-will-happen'),
                            createContentWithBullets([
                                t('databases.well-architect.rss-what-will-happen-content1'),
                                t('databases.well-architect.rss-what-will-happen-content2'),
                                t('databases.well-architect.rss-what-will-happen-content3'),
                                t('databases.well-architect.rss-what-will-happen-content4'),
                                t('databases.well-architect.rss-what-will-happen-content5')
                            ]),
                            { width: '712px' }
                        )}

                        {createSection(
                            selectedDatabaseStorageType === 'FCI'
                                ? GENERAL.NOTE
                                : GETWELL_DIALOG_CONTENT.DOWNTIME_WARNING,
                            createContentWithBullets(
                                selectedDatabaseStorageType === 'FCI'
                                    ? [
                                          GETWELL_DIALOG_CONTENT.COMPUTE_RS_DTW_NOTES_FCI[0],
                                          GETWELL_DIALOG_CONTENT.COMPUTE_RS_DTW_NOTES_FCI[1]
                                      ]
                                    : [
                                          GETWELL_DIALOG_CONTENT.COMPUTE_RS_DTW_NOTES_STANDALONE[0],
                                          GETWELL_DIALOG_CONTENT.COMPUTE_RS_DTW_NOTES_STANDALONE[1]
                                      ]
                            ),
                            { width: '712px' }
                        )}
                    </div>
                );

            case ASSESSMENT_CONFIG_NAMES.MTU:
                return (
                    <div className={styles['storage-tier-block']}>
                        {createSection(
                            t('databases.well-architect.mtu-alignment-action-summary-heading'),
                            t('databases.well-architect.mtu-alignment-action-summary')
                        )}

                        {createSection(
                            t('databases.well-architect.mtu-alignment-what-will-happen-heading'),
                            <>
                                <DsTypography variant="Regular_14">
                                    {t('databases.well-architect.mtu-alignment-what-will-happen1')}
                                </DsTypography>
                                <DsTypography variant="Regular_14">
                                    {t('databases.well-architect.mtu-alignment-what-will-happen2')}
                                </DsTypography>
                            </>,
                            { width: '712px' }
                        )}

                        {createSection(
                            GENERAL.NOTE,
                            createContentWithBullets([
                                <DsTypography variant="Regular_14" style={{ whiteSpace: 'pre-line' }}>
                                    {`${t('databases.well-architect.mtu-alignment-note1')}\n${t(
                                        'databases.well-architect.mtu-alignment-note1-additional'
                                    )}\n${t('databases.well-architect.mtu-alignment-note1-final')}`}
                                </DsTypography>,
                                t('databases.well-architect.mtu-alignment-note2')
                            ]),
                            { width: '712px' }
                        )}

                        {createSection(
                            '',
                            <DsTypography variant="Regular_14">
                                {t('databases.well-architect.mtu-alignment-note3')}
                            </DsTypography>,
                            { width: '712px' }
                        )}
                    </div>
                );

            default:
                return (
                    <DsTypography variant="Regular_14">
                        {t('databases.well-architect.no-configurations-available')}
                    </DsTypography>
                );
        }
    };

    return <div className={styles.dialogContent}>{setContent()}</div>;
};

export default DialogContent;
