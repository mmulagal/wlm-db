import { DsTypography } from '@netapp/design-system';
import { ReactComponent as Tagmage } from '../../../../assets/tag.svg';

import styles from './TagComponent.module.scss';
import Tag from '../../../../common/Tag/Tag';
import { useAppSelector } from '../../../../store/storeHooks';
import { useEffect, useState } from 'react';

type TagComponentProps = {
    tagHeight: string;
};

const TagComponent = ({ tagHeight }: TagComponentProps) => {
    const { selectedConfig } = useAppSelector(state => state.databaseHome);
    const [tagData, setTagData] = useState<any>([]);

    useEffect(() => {
        switch (selectedConfig) {
            case 'Storage tier':
            case 'File system headroom':
                setTagData(['Performance efficiency']);
                break;

            case 'Log drive size':
            case 'TempDB drive size':
                setTagData(['Operational excellence']);
                break;

            case 'User data files (.mdf)':
            case 'Log files (.ldf)':
            case 'TempDB placement':
                setTagData(['Performance efficiency', 'Operational excellence']);
                break;

            case 'ONTAP configuration':
            case 'Operating system':
            case 'Compute rightsizing':
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
