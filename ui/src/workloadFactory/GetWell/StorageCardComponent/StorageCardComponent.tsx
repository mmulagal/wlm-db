import { DsButton, DsFlashingDotsLoader, DsTypography } from '@netapp/design-system';
import { ReactComponent as NotActive } from '../../../assets/ic_not_active.svg';
import { ReactComponent as Optimized } from '../../../assets/optimized.svg';
import { ReactComponent as UnderProvisioned } from '../../../assets/under-provisioned.svg';
import { ReactComponent as OverProvisioned } from '../../../assets/over-provisioned.svg';
import styles from './StorageCardComponent.module.scss';
import GetWellChart from './GetWellChart/GetWellChart';
import useResize from '../../../common/hooks/useResize';

const StorageCardComponent = ({ cardData }: any) => {
    const loading = false;
    const setImage = (value: string) => {
        if (value.toLocaleLowerCase() === 'optimized') {
            return <Optimized />;
        } else if (value === 'Under-provisioned') {
            return <UnderProvisioned />;
        } else if (value === 'Over-provisioned') {
            return <OverProvisioned />;
        } else {
            return <NotActive />;
        }
    };

    const sectionThreeContent = (cardData: any) => {
        if (loading) {
            return (
                <div style={{ height: '24px', display: 'flex', alignItems: 'center' }}>
                    <DsFlashingDotsLoader />
                </div>
            );
        } else if (cardData?.block_three?.smallFont) {
            return <DsTypography variant="Semibold_14">{cardData?.block_three?.value}</DsTypography>;
        } else {
            return (
                <DsTypography variant="Regular_24" style={{ lineHeight: 'unset' }}>
                    {cardData?.block_three?.value}
                </DsTypography>
            );
        }
    };
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
                {loading && (
                    <div style={{ height: '22px', display: 'flex', alignItems: 'center' }}>
                        <DsFlashingDotsLoader />
                    </div>
                )}
                {!loading && (
                    <div className={styles.statusTopSection}>
                        <div className={styles.svgSection}>{setImage(cardData?.block_two?.value)}</div>
                        <DsTypography variant="Semibold_14">{cardData?.block_two?.value}</DsTypography>
                    </div>
                )}
                <DsTypography variant="Regular_14">{cardData?.block_two?.type}</DsTypography>
            </div>

            {/* Section three */}
            <div className={styles.thirdSection} style={{ height: cardData?.block_three?.smallFont ? '56px' : '64px' }}>
                {sectionThreeContent(cardData)}

                <DsTypography variant="Regular_14">{cardData?.block_three?.type}</DsTypography>
            </div>

            {/* Section 4 */}
            <div className={styles.commonSection}>
                {loading && (
                    <div style={{ height: '22px', display: 'flex', alignItems: 'center' }}>
                        <DsFlashingDotsLoader />
                    </div>
                )}
                {!loading && <DsTypography variant="Semibold_14">{cardData?.block_four?.value}</DsTypography>}
                <DsTypography variant="Regular_14">{cardData?.block_four?.type}</DsTypography>
            </div>

            {/* 5 Section */}
            {windowSize.width >= 1770 && (
                <div className={styles.fourthSection}>
                    {/* <GetWellChart startColor="#A815F3" endColor="rgba(168, 21, 243, 0.00)" /> */}
                </div>
            )}

            {/* <div className={styles.separator} /> */}

            {/* 6 section */}
            {cardData?.block_one?.value !== 'ONTAP configuration' &&
                cardData?.block_one?.value !== 'Operating system' && (
                    <div className={styles.buttonSection} style={{ width: windowSize.width >= 1770 ? '170px' : '20%' }}>
                        <DsButton variant="secondary" onClick={() => {}} isDisabled={loading}>
                            Optimize
                        </DsButton>
                    </div>
                )}
        </div>
    );
};

export default StorageCardComponent;
