import { DsTypography } from '@netapp/design-system';
import { ReactComponent as Light } from '../../../assets/Light.svg';
import styles from './RecommendationText.module.scss';

type RecommendationTextProps = {
    data: {
        title: string;
        description: string;
        values?: Array<string>;
    };
    from?: string;
    cardName?: string;
};

const RecommendationText = ({ data, from = 'optimize', cardName }: RecommendationTextProps) => {
    return (
        <div
            className={styles.recommendationText}
            style={{ padding: from === 'dashboard' ? '24px 40px' : '32px 0px 16px 0px' }}
        >
            {from === 'optimize' && <DsTypography variant="Semibold_14">{data?.title}</DsTypography>}

            {from === 'dashboard' && (
                <div className={styles.dashboardHeading}>
                    <Light />
                    <DsTypography variant="Semibold_14">{data?.title}</DsTypography>
                </div>
            )}

            <div
                className={styles.desc}
                style={{
                    //@ts-ignore
                    whiteSpace: from === 'dashboard' && cardName === 'compute_right_sizing' ? '' : 'pre-wrap',
                    width: from === 'dashboard' ? 'unset' : '1400px'
                }}
            >
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
