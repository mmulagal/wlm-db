import { DsTypography, FlashingDotsLoader } from '@netapp/design-system';
import styles from './SavingsSelectedHost.module.scss';

const SavingsSelectedHost = () => {
    const isDisabled = false;
    const isLoading = false;
    return (
        <div className={styles.selectedHosts}>
            <DsTypography variant="Regular_14" className={isDisabled ? styles.disabledHeading : ''}>
                Selected host:
            </DsTypography>
            <div className={styles.valueArea}>
                <div className={styles.container}>
                    <DsTypography
                        variant="Semibold_14"
                        className={isDisabled ? `${styles.value} ${styles.disabledContent}` : styles.value}
                    >
                        Host name number 1
                    </DsTypography>
                    <DsTypography
                        variant="Regular_14"
                        className={isDisabled ? `${styles.heading} ${styles.disabledContent}` : styles.heading}
                    >
                        Host name
                    </DsTypography>
                </div>

                <div className={styles.separator} />

                <div className={styles.container}>
                    {!isLoading && (
                        <DsTypography
                            variant="Semibold_14"
                            className={isDisabled ? `${styles.value} ${styles.disabledContent}` : styles.value}
                        >
                            120
                        </DsTypography>
                    )}
                    {isLoading && (
                        <div className={styles.loader}>
                            <FlashingDotsLoader />
                        </div>
                    )}
                    <DsTypography
                        variant="Regular_14"
                        className={isDisabled ? `${styles.heading} ${styles.disabledContent}` : styles.heading}
                    >
                        Number of database{' '}
                    </DsTypography>
                </div>

                <div className={styles.separator} />

                <div className={styles.container}>
                    {!isLoading && (
                        <DsTypography
                            variant="Semibold_14"
                            className={isDisabled ? `${styles.value} ${styles.disabledContent}` : styles.value}
                        >
                            120
                        </DsTypography>
                    )}
                    {isLoading && (
                        <div className={styles.loader}>
                            <FlashingDotsLoader />
                        </div>
                    )}
                    <DsTypography
                        variant="Regular_14"
                        className={isDisabled ? `${styles.heading} ${styles.disabledContent}` : styles.heading}
                    >
                        Number of volumes{' '}
                    </DsTypography>
                </div>
            </div>
        </div>
    );
};

export default SavingsSelectedHost;
