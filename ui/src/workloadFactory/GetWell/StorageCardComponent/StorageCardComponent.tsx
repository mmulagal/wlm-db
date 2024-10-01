import { DsButton, DsTypography } from '@netapp/design-system';
import { ReactComponent as NotActive } from '../../../assets/ic_not_active.svg';
import styles from './StorageCardComponent.module.scss';
import GetWellChart from './GetWellChart/GetWellChart';
import useResize from '../../../common/hooks/useResize';

const StorageCardComponent = ({ cardData }: any) => {
    const windowSize = useResize();
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

            {/* Section 4 */}
            <div className={styles.commonSection}>
                <DsTypography variant="Semibold_14">{cardData?.block_four?.value}</DsTypography>
                <DsTypography variant="Regular_14">{cardData?.block_four?.type}</DsTypography>
            </div>

            {/* 5 Section */}
            {windowSize.width >= 1770 && (
                <div className={styles.fourthSection}>
                    <GetWellChart startColor="#A815F3" endColor="rgba(168, 21, 243, 0.00)" />
                </div>
            )}

            <div className={styles.separator} />

            {/* 6 section */}
            <div className={styles.buttonSection} style={{ width: windowSize.width >= 1770 ? '170px' : '20%' }}>
                <DsButton variant="secondary" onClick={() => {}}>
                    Options
                </DsButton>
            </div>
        </div>
    );
};

export default StorageCardComponent;
