import { DsTypography } from '@netapp/design-system';
import { ReactComponent as Tagmage } from '../../../../assets/tag.svg';

import styles from './TagComponent.module.scss';
import Tag from '../../../../common/Tag/Tag';
import { useAppSelector } from '../../../../store/storeHooks';
import { useEffect, useState } from 'react';
import { ASSESSMENT_CONFIG_NAMES } from '../../../../utils/consts';

type TagComponentProps = {
    tagHeight: string;
};

const TagComponent = ({ tagHeight }: TagComponentProps) => {
    const { selectedConfig } = useAppSelector(state => state.databaseHome);
    const [tagData, setTagData] = useState<any>([]);

    useEffect(() => {
        switch (selectedConfig) {
            case ASSESSMENT_CONFIG_NAMES.STORAGE_TIER:
            case ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM:
                setTagData(['Performance efficiency']);
                break;

            case ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE:
            case ASSESSMENT_CONFIG_NAMES.TEMPDB_DRIVE_SIZE:
                setTagData(['Operational excellence']);
                break;

            case ASSESSMENT_CONFIG_NAMES.DATA_FILES_MDF:
            case ASSESSMENT_CONFIG_NAMES.LOG_FILES_LDF:
            case ASSESSMENT_CONFIG_NAMES.TEMPDB_PLACEMENT:
                setTagData(['Performance efficiency', 'Operational excellence']);
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
