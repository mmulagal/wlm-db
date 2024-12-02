import { DsTypography } from '@netapp/design-system';
import styles from './HostDistribution.module.scss';
import HostDistributionChart from './HostDistributionChart/HostDistributionChart';
import SquareComponent from '../../DatabaseHomePage/SquareComponent/SquareComponent';
import { GENERAL } from '../../../utils/appConstants';
import useResize from '../../../common/hooks/useResize';

const HostDistribution = () => {
    const windowSize = useResize();
    return (
        <div className={styles.hostDistribution}>
            <div className={styles.headSection}>
                <DsTypography variant="Regular_16" className={styles.title}>
                    Host distribution
                </DsTypography>

                {/* {loading && <FlashingDotsLoader />} */}
            </div>

            <div className={styles.mainSection}>
                <HostDistributionChart
                    color1={'#0BAFFC'}
                    color2={'#A815F3'}
                    data1={65}
                    data2={35}
                    centerText={'Total hosts'}
                    centerValue="100"
                />

                <div className={styles.valueArea}>
                    <div className={styles.firstBlock}>
                        <SquareComponent
                            value={String(65)}
                            color="var(--chart-3)"
                            text={windowSize.width > 1700 ? 'Microsoft SQL Server hosts' : 'Microsoft SQL Server'}
                            isLoading={false}
                            // loadingInFirstRow={loading}
                        />
                    </div>

                    <div className={styles.separator} />

                    <div className={styles.secondBlock}>
                        <SquareComponent
                            value={String(35)}
                            color="var(--chart-9)"
                            text={windowSize.width > 1700 ? 'PostgreSQL hosts' : 'PostgreSQL'}
                            isLoading={false}
                            // loadingInFirstRow={loading}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HostDistribution;
