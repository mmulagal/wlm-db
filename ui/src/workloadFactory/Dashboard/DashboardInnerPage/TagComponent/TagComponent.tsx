import { DsTypography } from '@netapp/design-system';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as Tagmage } from '../../../../assets/tag.svg';
import { ReactComponent as Severity } from '../../../../assets/severity-icon.svg';

import styles from './TagComponent.module.scss';
import Tag from '../../../../common/Tag/Tag';

type TagComponentProps = {
    tagHeight?: string;
    severity?: string;
    categories?: string[];
};

const TagComponent = ({ tagHeight = 'auto', severity, categories }: TagComponentProps) => {
    const { t } = useTranslation();
    const [tagData, setTagData] = useState<any>([]);

    useEffect(() => {
        // Use categories directly from API response
        if (categories?.length) {
            setTagData(
                categories.map(category => ({
                    label: category,
                    value: category.toLowerCase().replace(/\s+/g, '')
                }))
            );
        } else {
            setTagData([{ label: t('databases.well-architect.tags.noTagsAvailable'), value: '' }]);
        }
    }, [t, categories]);

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

            {severity && (
                <div className={styles.severitySection}>
                    <Severity />

                    <DsTypography variant="Semibold_14">{t('databases.log-analyzer.severity')}:</DsTypography>

                    <div className={styles.severity}>
                        <div
                            className={`${styles.circle} ${severity === 'Critical' ? styles.error : styles.warning}`}
                        />
                        <DsTypography variant="Semibold_14">{severity}</DsTypography>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TagComponent;
