import { useEffect, useState } from 'react';
import { DsTypography } from '@netapp/design-system';
import styles from './RecommendationTooltip.module.scss';

import { ReactComponent as Bullet } from '../../../assets/ic_bullet.svg';

const RecommendationTooltip = ({ data }: { data: string }) => {
    const [desc, setDesc] = useState('');
    const [points, setPoints] = useState<Array<string>>([]);
    useEffect(() => {
        const desc = data.split('- ')[0].trim();
        const points = data.split('- ').slice(1);
        setDesc(desc);
        setPoints(points);
    }, []);

    return (
        <div className={styles.recommendationTooltip}>
            <div style={{ whiteSpace: 'pre-wrap' }}>
                <DsTypography variant="Regular_13">{desc}</DsTypography>
            </div>
            {points?.map(perPoint => (
                <div className={styles.points}>
                    <div>
                        <Bullet />
                    </div>
                    <DsTypography variant="Regular_13">{perPoint}</DsTypography>
                </div>
            ))}
        </div>
    );
};

export default RecommendationTooltip;
