import { DsTypography } from '@netapp/design-system';
import { ReactComponent as NotActive } from '../../../assets/ic_not_active.svg';
import styles from './StorageCardComponent.module.scss';
import GetWellChart from './GetWellChart/GetWellChart';

const StorageCardComponent = ({ cardData }: any) => {
    return (
        <div className={styles.storageCardComponent}>
            {/* Section one */}
            <div className={styles.commonSection}>
                <DsTypography variant="Semibold_14">{cardData?.block_one?.value}</DsTypography>
                <DsTypography variant="Regular_14">{cardData?.block_one?.type}</DsTypography>
            </div>

            {/* Section Two */}
            <div className={styles.commonSection}>
                <div className={styles.statusTopSection}>
                    <div className={styles.svgSection}>
                        <NotActive />
                    </div>
                    <DsTypography variant="Semibold_14">{cardData?.block_two?.value}</DsTypography>
                </div>
                <DsTypography variant="Regular_14">{cardData?.block_two?.type}</DsTypography>
            </div>

            {/* Section three */}
            <div className={styles.thirdSection} style={{ height: cardData?.block_three?.smallFont ? '56px' : '64px' }}>
                {cardData?.block_three?.smallFont ? (
                    <DsTypography variant="Semibold_14">{cardData?.block_three?.value}</DsTypography>
                ) : (
                    <DsTypography variant="Regular_24" style={{ lineHeight: 'unset' }}>
                        {cardData?.block_three?.value}
                    </DsTypography>
                )}

                <DsTypography variant="Regular_14">{cardData?.block_three?.type}</DsTypography>
            </div>

            {/* Fourth Section */}
            <div className={styles.fourthSection}>
                <GetWellChart startColor="#A815F3" endColor="rgba(168, 21, 243, 0.00)" />
            </div>
        </div>
    );
};

export default StorageCardComponent;
