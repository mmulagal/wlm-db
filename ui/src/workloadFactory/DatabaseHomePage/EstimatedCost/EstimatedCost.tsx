import styles from './EstimatedCost.module.scss';
import { Typography } from '@netapp/design-system';
import SquareComponent from '../SquareComponent/SquareComponent';

const EstimatedCost = () => {
    return (
        <div className={styles.estimatedCost}>
            <div className={styles.headSection}>
                <Typography variant="Regular_16">Estimated monthly cost</Typography>
                <Typography variant="Semibold_20" style={{ lineHeight: 'unset' }}>
                    $ 15,125
                </Typography>
            </div>

            <div className={styles.mainSection}>
                {/* Progress Bar */}
                <div className={styles.progressBar}>
                    <div
                        className={`${styles.progress} ${styles.leftCurveBar}`}
                        style={{
                            width: `10%`,
                            backgroundColor: '#A815F3'
                        }}
                    ></div>
                    <div className={styles.separator}></div>
                    <div
                        className={`${styles.progress}`}
                        style={{
                            width: `25%`,
                            backgroundColor: '#012CAD'
                        }}
                    ></div>
                    <div className={styles.separator}></div>
                    <div
                        className={`${styles.progress}`}
                        style={{
                            width: `25%`,
                            backgroundColor: '#0BAFFC'
                        }}
                    ></div>
                    <div className={styles.separator}></div>
                    <div
                        className={`${styles.progress} ${styles.rightCurveBar}`}
                        style={{
                            width: `40%`,
                            backgroundColor: '#68C6B3'
                        }}
                    ></div>
                </div>
                {/* Ends here */}

                <div className={styles.bottomSection}>
                    <SquareComponent value="$1000" color="#a815f3" text={'Storage'} />
                    <div className={styles.storageSeparator} />
                    <SquareComponent value="$1000" color="#012CAD" text={'Compute'} />
                    <div className={styles.storageSeparator} />
                    <SquareComponent value="$1000" color="#0BAFFC" text={'Connectivity'} />
                    <div className={styles.storageSeparator} />
                    <SquareComponent value="$1000" color="#68C6B3" text={'Other'} />
                </div>
            </div>
        </div>
    );
};

export default EstimatedCost;
