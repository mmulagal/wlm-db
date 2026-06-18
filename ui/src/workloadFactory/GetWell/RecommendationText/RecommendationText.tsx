import { DsTypography } from '@netapp/design-system';
import { ReactComponent as InfoIcon } from '@netapp/icons/ic_info.svg';
import { ReactComponent as Light } from '../../../assets/Light.svg';
import styles from './RecommendationText.module.scss';
import { ReactComponent as Bullet } from '../../../assets/ic_bullet.svg';

type RecommendationTextProps = {
    data?: {
        title: string;
        description?: string;
        values?: Array<string>;
        valuesHeading?: string;
        descriptionList?: Array<{ title: string; description: string }> | undefined;
        descriptionRssConfig?: {
            first?: string;
            second?: string;
            points?: string[];
            last?: string;
        };
        info?: string;
    };
    from?: string;
    cardName?: string;
};

const RecommendationText = ({ data, from = 'optimize', cardName }: RecommendationTextProps) => (
    <div
        className={styles.recommendationText}
        style={{ padding: from === 'dashboard' ? '24px 40px' : '32px 0px 16px 0px' }}
    >
        {from === 'optimize' && (
            <DsTypography variant="Semibold_14" style={{ minWidth: 'fit-content', width: 'fit-content' }}>
                {data?.title}
            </DsTypography>
        )}

        {from === 'dashboard' && (
            <div className={styles.dashboardHeading}>
                <Light />
                <DsTypography variant="Semibold_14" style={{ minWidth: 'fit-content', width: 'fit-content' }}>
                    {data?.title}
                </DsTypography>
            </div>
        )}

        {data?.info && (
            <div className={styles.info}>
                <div className={styles.setSVG}>
                    <InfoIcon />
                </div>
                <DsTypography style={{ minWidth: '570px' }} variant="Regular_14">
                    {data?.info}
                </DsTypography>
            </div>
        )}

        {data?.description && (
            <div
                className={styles.desc}
                style={{
                    // @ts-ignore
                    whiteSpace: 'pre-wrap',
                    width: from === 'dashboard' ? 'unset' : '1400px'
                }}
            >
                <DsTypography variant="Regular_14">{data?.description}</DsTypography>
            </div>
        )}

        {data?.descriptionList?.map((item: any, index: number) => (
            <div
                key={index + Math.random()}
                style={{
                    // @ts-ignore
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
        ))}

        {data?.valuesHeading && (
            <div className={styles.valuesHeading}>
                <DsTypography variant="Semibold_14">{data?.valuesHeading}</DsTypography>
            </div>
        )}

        {data?.values && data?.values?.length > 0 && (
            <div className={styles.values}>
                {/* <DsTypography variant="Semibold_14">Values</DsTypography> */}
                <div className={styles.values}>
                    {data?.values.map((value, index) => (
                        <div key={index + Math.random()} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            {index !== 0 && <div className={styles.seperator} />}

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
                        </div>
                    ))}
                </div>
            </div>
        )}

        {data?.descriptionRssConfig && (
            <div
                className={styles.rssConfig}
                style={{
                    // @ts-ignore
                    whiteSpace: from === 'dashboard' && cardName === 'compute_right_sizing' ? '' : 'pre-wrap',
                    width: from === 'dashboard' ? 'unset' : '1400px'
                }}
            >
                <DsTypography variant="Regular_14">{data?.descriptionRssConfig?.first}</DsTypography>
                {data?.descriptionRssConfig?.second && (
                    <DsTypography variant="Regular_14">{data?.descriptionRssConfig?.second}</DsTypography>
                )}
                {data?.descriptionRssConfig?.points?.map(perPoint => (
                    <div className={styles.points}>
                        <div className={styles.bullet}>
                            <Bullet />
                        </div>
                        <DsTypography variant="Regular_14">{perPoint}</DsTypography>
                    </div>
                ))}
                <DsTypography variant="Regular_14">{data?.descriptionRssConfig?.last}</DsTypography>
            </div>
        )}
    </div>
);

export default RecommendationText;
