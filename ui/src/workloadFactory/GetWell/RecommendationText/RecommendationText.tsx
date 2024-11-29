import { DsTypography } from '@netapp/design-system';
import styles from './RecommendationText.module.scss';

const RecommendationText = ({ data }: { data: { title: string; description: string; values?: Array<string> } }) => {
    return (
        <div className={styles.recommendationText}>
            <DsTypography variant="Semibold_14">{data?.title}</DsTypography>

            <div className={styles.desc} style={{ whiteSpace: 'pre-wrap' }}>
                <DsTypography variant="Regular_14">{data?.description}</DsTypography>
            </div>

            {data?.values && data?.values?.length > 0 && (
                <div className={styles.values}>
                    <DsTypography variant="Semibold_14">Values</DsTypography>
                    <div className={styles.values}>
                        {data?.values.map((value, index) => (
                            <>
                                <div className={styles.seperator} />

                                <DsTypography
                                    key={index}
                                    variant="Regular_14"
                                    style={{
                                        width:
                                            value.includes('Under-provisioned') || value.includes('Over-provisioned')
                                                ? '180px'
                                                : 'fit-content',
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    {value}
                                </DsTypography>
                            </>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default RecommendationText;
