import styles from './EstimatedCost.module.scss';
import { Typography } from '@netapp/design-system';
import SquareComponent from '../SquareComponent/SquareComponent';
import { useAppSelector } from '../../../store/storeHooks';
import { GENERAL } from '../../../utils/appConstants';
import LoadingComponent from '../../../common/LoadingConponent/LoadingComponent';

const EstimatedCost = () => {

    const hostData = useAppSelector(state => state.databaseHome.aggregatedCosts);
    const { databaseHostsLoading } = useAppSelector(state => state.databaseHome.getDatabaseHosts);
    const { databaseJobsLoading } = useAppSelector(state => state.databaseHome.getDatabaseJobs);
    
    return (
        <div className={styles.estimatedCost}>
            <div className={styles.headSection}>
                <Typography variant="Regular_16" className={styles.title}>
                    {GENERAL.ESTIMATED_MONTHLY_COST}
                    {(databaseHostsLoading || databaseJobsLoading) && 
                        <div className={styles.loadingPlacement}>
                            <LoadingComponent/>
                        </div>
                    }
                </Typography>
                <Typography variant="Semibold_20" style={{ lineHeight: 'unset' }}>
                    $ {hostData?.totalCost}
                </Typography>
            </div>

            <div className={styles.mainSection}>
                {/* Progress Bar */}
                <div className={styles.progressBar}>
                    {hostData?.storageCostPercent !== 0 && 
                        <div
                            className={`${styles.progress} ${styles.leftCurveBar}`}
                            style={{
                                width: `${hostData?.storageCostPercent}%`,
                                backgroundColor: '#A815F3'
                            }}
                        ></div>
                    }
                    <div className={styles.separator}></div>
                    {hostData?.computeCostPercent !== 0 &&
                        <div
                            className={`${styles.progress}`}
                            style={{
                                width: `${hostData?.computeCostPercent}%`,
                                backgroundColor: '#012CAD'
                            }}
                        ></div>
                    }
                    <div className={styles.separator}></div>
                    {hostData?.connectivityCostPercent !== 0 &&
                        <div
                            className={`${styles.progress}`}
                            style={{
                                width: `${hostData?.connectivityCostPercent}%`,
                                backgroundColor: '#0BAFFC'
                            }}
                        ></div>
                    }
                    <div className={styles.separator}></div>
                    {hostData?.otherCostPercent !== 0 &&
                        <div
                            className={`${styles.progress} ${styles.rightCurveBar}`}
                            style={{
                                width: `${hostData?.otherCostPercent}%`,
                                backgroundColor: '#68C6B3'
                            }}
                        ></div>
                    }
                </div>
                {/* Ends here */}

                <div className={styles.bottomSection}>
                    <SquareComponent value={'$' + hostData?.storageCost} color="#a815f3" text={'Storage'} />
                    <div className={styles.storageSeparator} />
                    <SquareComponent value={'$' + hostData?.computeCost} color="#012CAD" text={'Compute'} />
                    <div className={styles.storageSeparator} />
                    <SquareComponent value={'$' + hostData?.connectivityCost} color="#0BAFFC" text={'Connectivity'} />
                    <div className={styles.storageSeparator} />
                    <SquareComponent value={'$' + hostData?.otherCost} color="#68C6B3" text={'Other'} />
                </div>
            </div>
        </div>
    );
};

export default EstimatedCost;
