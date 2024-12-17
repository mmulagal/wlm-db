import { DsTypography } from '@netapp/design-system';
import { ReactComponent as Light } from '../../../assets/Light.svg';
import styles from './RecommendationText.module.scss';
import { ReactComponent as InfoIcon } from '@netapp/icons/ic_info.svg';

type RecommendationTextProps = {
    data: {
        title: string;
        description: string;
        values?: Array<string>;
        descriptionList?: Array<{ title: string; description: string }> | undefined;
        info?: string;
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

            {data?.info && (
                <div className={styles.info}>
                    <div className={styles.setSVG}>
                        <InfoIcon />
                    </div>
                    <DsTypography variant="Regular_14">{data?.info}</DsTypography>
                </div>
            )}

            {data?.description && (
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
            )}

            {data?.descriptionList?.map(item => {
                return (
                    <div
                        style={{
                            //@ts-ignore
                            whiteSpace: from === 'dashboard' ? '' : 'pre-wrap',
                            width: from === 'dashboard' ? 'unset' : '1400px',
                            marginBottom: '10px'
                        }}
                    >
                        <DsTypography variant="Regular_14">
                            <span style={{ fontWeight: 500 }}>{item?.title}</span>
                            {item?.description}
                        </DsTypography>
                    </div>
                );
            })}

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
