import { DsTypography, FlashingDotsLoader } from '@netapp/design-system';
import styles from './SavingsSelectedHost.module.scss';
import { useAppSelector } from '../../../../store/storeHooks';
import { GENERAL } from '../../../../utils/appConstants';

const SavingsSelectedHost = () => {
    const isDisabled = false;
    const selectedHostDetails = useAppSelector(state => state.exploreSavings.selectedHostDetails);
    const isDemoMode = useAppSelector(state => state.auth?.isDemoMode);

    return (
        <div className={styles.selectedHosts}>
            <DsTypography variant="Regular_14" className={isDisabled ? styles.disabledHeading : ''}>
                Selected host:
            </DsTypography>
            <div className={styles.valueArea}>
                <div className={styles.container}>
                    {!selectedHostDetails?.loading && (
                        <DsTypography
                            variant="Semibold_14"
                            className={isDisabled ? `${styles.value} ${styles.disabledContent}` : styles.value}
                        >
                            {isDemoMode
                                ? 'SQLserver-Finance-01'
                                : selectedHostDetails?.databaseServer?.activeNode || GENERAL.NOT_AVAILABLE}
                        </DsTypography>
                    )}
                    {selectedHostDetails?.loading && (
                        <div className={styles.loader} style={{ marginRight: '104px' }}>
                            <FlashingDotsLoader />
                        </div>
                    )}
                    <DsTypography
                        variant="Regular_14"
                        className={isDisabled ? `${styles.heading} ${styles.disabledContent}` : styles.heading}
                    >
                        {GENERAL.ES_HOST_NAME}
                    </DsTypography>
                </div>

                {/* <div className={styles.separator} /> */}

                <div className={`${styles.container} ${styles.secondContainer}`}>
                    {!selectedHostDetails?.loading && (
                        <DsTypography
                            variant="Semibold_14"
                            className={isDisabled ? `${styles.value} ${styles.disabledContent}` : styles.value}
                        >
                            {isDemoMode ? 2 : selectedHostDetails?.databaseCount || GENERAL.NOT_AVAILABLE}
                        </DsTypography>
                    )}
                    {selectedHostDetails?.loading && (
                        <div className={styles.loader} style={{ marginRight: '104px' }}>
                            <FlashingDotsLoader />
                        </div>
                    )}
                    <DsTypography
                        variant="Regular_14"
                        className={isDisabled ? `${styles.heading} ${styles.disabledContent}` : styles.heading}
                    >
                        {GENERAL.ES_NUMBER_OF_DB}{' '}
                    </DsTypography>
                </div>

                {/* <div className={styles.separator} /> */}

                <div className={styles.container}>
                    {!selectedHostDetails?.loading && (
                        <DsTypography
                            variant="Semibold_14"
                            className={isDisabled ? `${styles.value} ${styles.disabledContent}` : styles.value}
                        >
                            {isDemoMode ? 2 : selectedHostDetails?.ebsResourceInfo?.length || GENERAL.NOT_AVAILABLE}
                        </DsTypography>
                    )}
                    {selectedHostDetails?.loading && (
                        <div className={styles.loader}>
                            <FlashingDotsLoader />
                        </div>
                    )}
                    <DsTypography
                        variant="Regular_14"
                        className={isDisabled ? `${styles.heading} ${styles.disabledContent}` : styles.heading}
                    >
                        {GENERAL.ES_NUMBER_OF_VOLS}
                    </DsTypography>
                </div>
            </div>
        </div>
    );
};

export default SavingsSelectedHost;
