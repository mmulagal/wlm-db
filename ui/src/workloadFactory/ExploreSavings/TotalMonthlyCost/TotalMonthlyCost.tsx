import { DsTypography, DsFlashingDotsLoader } from '@netapp/design-system';
import { ReactComponent as GraphIcon } from '../../../assets/ic_graph.svg';
import styles from './TotalMonthlyCost.module.scss';
import ComparisonChart from '../../../ui-components/Charts/ComparisionChart';
import { useAppSelector } from '../../../store/storeHooks';

const TotalMonthlyCost = () => {
    const { loading } = useAppSelector(state => state.exploreSavings);
    const noData = false;

    const calculatedResponse = {
        fsx: {
            total: 7000
        },
        ebs: {
            total: 14000
        }
    };
    return (
        <div className={styles.totalMonthlyCost}>
            <div className={styles.headSection}>
                <DsTypography variant="Semibold_16" className={styles.title}>
                    Total monthly cost
                </DsTypography>
                {loading && <DsFlashingDotsLoader />}
            </div>

            <div className={styles.mainSection}>
                {loading && (
                    <>
                        <div style={{ position: 'relative', top: '250px' }}>
                            <ComparisonChart
                                data={[1, 1]}
                                yTickFormatter={yValue => '$' + 0}
                                height={120}
                                colors={['chart-9', 'chart-6']}
                                categories={[
                                    'Microsoft SQL server on FSx for ONTAP',
                                    'Microsoft SQL server on Amazon Elastic Block Store (EBS)'
                                ]}
                            />
                        </div>
                    </>
                )}
                {noData && !loading && (
                    <>
                        <div className={styles['calculate-notice']}>
                            <GraphIcon style={{ marginTop: 24 }} />
                            <DsTypography variant="Semibold_14" className={styles.noData}>
                                To view storage cost savings, enter your configuration.
                            </DsTypography>
                        </div>
                        <ComparisonChart
                            data={[0, 0]}
                            height={75}
                            categories={[
                                'Microsoft SQL server on FSx for ONTAP',
                                'Microsoft SQL server on Amazon Elastic Block Store (EBS)'
                            ]}
                        />
                    </>
                )}
                {!noData && !loading && (
                    <>
                        <ComparisonChart
                            data={[calculatedResponse.fsx.total, calculatedResponse.ebs.total]}
                            yTickFormatter={yValue => '$' + yValue}
                            height={370}
                            colors={calculatedResponse && ['chart-9', 'chart-6']}
                            categories={[
                                'Microsoft SQL server on FSx for ONTAP',
                                'Microsoft SQL server on Amazon Elastic Block Store (EBS)'
                            ]}
                        />
                    </>
                )}
            </div>
        </div>
    );
};

export default TotalMonthlyCost;
