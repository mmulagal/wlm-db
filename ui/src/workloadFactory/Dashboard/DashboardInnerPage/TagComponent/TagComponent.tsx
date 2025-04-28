import { DsTypography } from '@netapp/design-system';
import { ReactComponent as Tagmage } from '../../../../assets/tag.svg';

import styles from './TagComponent.module.scss';
import Tag from '../../../../common/Tag/Tag';
import { useAppSelector } from '../../../../store/storeHooks';
import { useEffect, useState } from 'react';
import { ASSESSMENT_CONFIG_NAMES } from '../../../../utils/consts';
import { GENERAL } from '../../../../utils/appConstants';

type TagComponentProps = {
    tagHeight: string;
    type?: string;
};

const TagComponent = ({ tagHeight, type }: TagComponentProps) => {
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
                setTagData(['Performance efficiency']);
                break;

            case 'Thin provisioning':
            case 'Autosize':
            case 'Autosize-mode':
            case 'Fractional reserve':
            case 'Snapshot copy reserve':
            case 'Snapshot autodelete':
            case 'Space management':
                setTagData(['Cost optimization', 'Operational excellence']);
                break;

            case ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE:
            case ASSESSMENT_CONFIG_NAMES.TEMPDB_DRIVE_SIZE:
                setTagData(['Operational excellence']);
                break;

            case ASSESSMENT_CONFIG_NAMES.SCHEDULED_LOCAL_SNAPSHOT:
            case 'Space allocation':
            case 'Space reservation':
                setTagData(['Reliability']);
                break;

            case ASSESSMENT_CONFIG_NAMES.SCHEDULED_FSX_FOR_ONTAP_BACKUPS:
                setTagData(['Reliability']);
                break;

            case ASSESSMENT_CONFIG_NAMES.CLONE_MANAGEMENT:
                setTagData(['Cost efficiency']);
                break;

            case GENERAL.OPERATING_SYSTEM_PATCH:
                setTagData(['Security']);
                break;

            case 'Multipath I/O Policy':
                setTagData(['Performance efficiency', 'Reliability']);
                break;

            case ASSESSMENT_CONFIG_NAMES.DATA_FILES_MDF:
            case ASSESSMENT_CONFIG_NAMES.LOG_FILES_LDF:
            case ASSESSMENT_CONFIG_NAMES.TEMPDB_PLACEMENT:
            case 'Data files':
            case 'Log files':
                setTagData(['Performance efficiency', 'Operational excellence']);
                break;

            case GENERAL.MICROSOFT_SQL_PATCH:
                setTagData(['Reliability', 'Security']);
                break;

            case GENERAL.LICENSE_SQL_SERVER:
            case 'Tiering minimum cooling days':
                setTagData(['Cost optimization']);
                break;
            case ASSESSMENT_CONFIG_NAMES.CRR:
            case 'Cross-Region Replication (CRR)':
                setTagData(['Reliability']);
                break;

            case 'ONTAP':
            case 'Operating system':
            case ASSESSMENT_CONFIG_NAMES.COMPUTE_RIGHTSIZING:
                setTagData([
                    'Performance efficiency',
                    'Operational excellence',
                    'Cost optimization',
                    'Reliability',
                    'Security'
                ]);
                break;
        }
    }, [selectedConfig]);
    return (
        <div className={styles.tagComponent} style={{ height: tagHeight }}>
            <div className={styles.topSection}>
                <Tagmage />
                <DsTypography variant="Semibold_14" style={{ position: 'relative', top: '-2px' }}>
                    Tags
                </DsTypography>
            </div>

            <div className={styles.mainSection}>
                {tagData?.map((tag: string, index: number) => (
                    <div key={index}>
                        <Tag text={tag} />
                    </div>
                ))}
            </div>
        </div>
    );
};

export default TagComponent;
