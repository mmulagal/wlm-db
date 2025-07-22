import { DsTypography } from '@netapp/design-system';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as Tagmage } from '../../../../assets/tag.svg';

import styles from './TagComponent.module.scss';
import Tag from '../../../../common/Tag/Tag';
import { useAppSelector } from '../../../../store/storeHooks';
import { ASSESSMENT_CONFIG_NAMES } from '../../../../utils/consts';
import { GENERAL } from '../../../../utils/appConstants';

type TagComponentProps = {
    tagHeight: string;
    type?: string;
};

const TagComponent = ({ tagHeight, type }: TagComponentProps) => {
    const { t } = useTranslation();
    const { selectedConfig } = useAppSelector(state => state.databaseHome);
    const [tagData, setTagData] = useState<any>([]);

    useEffect(() => {
        switch (selectedConfig || type) {
            case ASSESSMENT_CONFIG_NAMES.STORAGE_TIER:
            case ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM:
            case 'MAXDOP':
            case GENERAL.RSS_CONFIGURATION:
            case 'NTFS allocation unit size':
            case 'OS type':
            case 'Tiering policy':
                setTagData([
                    { label: t('databases.well-architect.tags.performanceEfficiency'), value: 'performanceEfficiency' }
                ]);
                break;

            case 'Thin provisioning':
            case 'Autosize':
            case 'Autosize-mode':
            case 'Fractional reserve':
            case 'Snapshot copy reserve':
            case 'Snapshot autodelete':
            case 'Space management':
                setTagData([
                    { label: t('databases.well-architect.tags.costOptimization'), value: 'costOptimization' },
                    { label: t('databases.well-architect.tags.operationalExcellence'), value: 'operationalExcellence' }
                ]);
                break;

            case ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE:
            case ASSESSMENT_CONFIG_NAMES.TEMPDB_DRIVE_SIZE:
                setTagData([
                    { label: t('databases.well-architect.tags.operationalExcellence'), value: 'operationalExcellence' }
                ]);
                break;

            case ASSESSMENT_CONFIG_NAMES.SCHEDULED_LOCAL_SNAPSHOT:
            case 'Space allocation':
            case 'Space reservation':
            case 'Multipath I/O Timeout':
                setTagData([{ label: t('databases.well-architect.tags.reliability'), value: 'reliability' }]);
                break;

            case ASSESSMENT_CONFIG_NAMES.SCHEDULED_FSX_FOR_ONTAP_BACKUPS:
                setTagData([{ label: t('databases.well-architect.tags.reliability'), value: 'reliability' }]);
                break;

            case ASSESSMENT_CONFIG_NAMES.CLONE_MANAGEMENT:
                setTagData([{ label: t('databases.well-architect.tags.costEfficiency'), value: 'costEfficiency' }]);
                break;

            case GENERAL.OPERATING_SYSTEM_PATCH:
                setTagData([{ label: t('databases.well-architect.tags.security'), value: 'security' }]);
                break;

            case 'Multipath I/O Policy':
                setTagData([
                    { label: t('databases.well-architect.tags.performanceEfficiency'), value: 'performanceEfficiency' },
                    { label: t('databases.well-architect.tags.reliability'), value: 'reliability' }
                ]);
                break;

            case ASSESSMENT_CONFIG_NAMES.DATA_FILES_MDF:
            case ASSESSMENT_CONFIG_NAMES.LOG_FILES_LDF:
            case ASSESSMENT_CONFIG_NAMES.TEMPDB_PLACEMENT:
            case 'Data files':
            case 'Log files':
                setTagData([
                    { label: t('databases.well-architect.tags.performanceEfficiency'), value: 'performanceEfficiency' },
                    { label: t('databases.well-architect.tags.operationalExcellence'), value: 'operationalExcellence' }
                ]);
                break;

            case GENERAL.MICROSOFT_SQL_PATCH:
                setTagData([
                    { label: t('databases.well-architect.tags.reliability'), value: 'reliability' },
                    { label: t('databases.well-architect.tags.security'), value: 'security' }
                ]);
                break;

            case GENERAL.LICENSE_SQL_SERVER:
            case 'Tiering minimum cooling days':
                setTagData([{ label: t('databases.well-architect.tags.costOptimization'), value: 'costOptimization' }]);
                break;
            case ASSESSMENT_CONFIG_NAMES.CRR:
            case 'Cross-Region Replication (CRR)':
                setTagData([{ label: t('databases.well-architect.tags.reliability'), value: 'reliability' }]);
                break;
            case ASSESSMENT_CONFIG_NAMES.MSSQL_HIGH_AVAILABILITY:
            case ASSESSMENT_CONFIG_NAMES.SHARED_STORAGE:
            case ASSESSMENT_CONFIG_NAMES.DRIVE_LETTER:
            case ASSESSMENT_CONFIG_NAMES.HEARTBEAT_SETTINGS:
            case ASSESSMENT_CONFIG_NAMES.CLUSTER_QUORUM:
            case ASSESSMENT_CONFIG_NAMES.SQL_SERVER_SERVICE:
                setTagData([{ label: t('databases.well-architect.tags.reliability'), value: 'reliability' }]);
                break;
            case 'ONTAP':
            case 'Operating system':
            case ASSESSMENT_CONFIG_NAMES.COMPUTE_RIGHTSIZING:
                setTagData([
                    { label: t('databases.well-architect.tags.performanceEfficiency'), value: 'performanceEfficiency' },
                    { label: t('databases.well-architect.tags.operationalExcellence'), value: 'operationalExcellence' },
                    { label: t('databases.well-architect.tags.costOptimization'), value: 'costOptimization' },
                    { label: t('databases.well-architect.tags.reliability'), value: 'reliability' },
                    { label: t('databases.well-architect.tags.security'), value: 'security' }
                ]);
                break;
            default:
                setTagData([{ label: t('databases.well-architect.tags.noTagsAvailable'), value: '' }]);
        }
    }, [selectedConfig, t, type]);
    return (
        <div className={styles.tagComponent} style={{ height: tagHeight }}>
            <div className={styles.topSection}>
                <Tagmage />
                <DsTypography variant="Semibold_14" style={{ position: 'relative', top: '-2px' }}>
                    {t('databases.well-architect.tags.title')}
                </DsTypography>
            </div>

            <div className={styles.mainSection}>
                {tagData?.map((tag: { label: string; value: string }) => (
                    <div key={tag.value || tag.label}>
                        <Tag text={tag.label} />
                    </div>
                ))}
            </div>
        </div>
    );
};

export default TagComponent;
