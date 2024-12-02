import { DsButton, DsFlashingDotsLoader, DsTypography } from '@netapp/design-system';
import { ReactComponent as ComingSoon } from '../../../../assets/ComingSoonLarge.svg';
import { ReactComponent as ComingSoon2 } from '../../../../assets/comingSoon2.svg';
import styles from './CategoryComponent.module.scss';
import SeparatorComponent from '../../../../common/SeparatorComponent/SeparatorComponent';
import useResize from '../../../../common/hooks/useResize';

type CategoryComponentProps = {
    image: React.ReactNode;
    firstBlockText: string;
    optimizationScore: number;
    optimizationInstances: number;
    totalOptimizationInstances: number;
    isComingSoon: boolean;
    isBorderRequired?: boolean;
};
const CategoryComponent = ({
    image,
    firstBlockText,
    optimizationScore,
    optimizationInstances,
    totalOptimizationInstances,
    isComingSoon,
    isBorderRequired
}: CategoryComponentProps) => {
    const windowSize = useResize();
    const isLoading = false;
    return (
        <div
            className={styles.categoryComponent}
            style={{ borderBottom: isBorderRequired ? '1px solid var(--border' : '' }}
        >
            <div className={styles.firstBlock}>
                <div>{image}</div>
                <DsTypography variant="Semibold_14">{firstBlockText}</DsTypography>
            </div>

            <SeparatorComponent variant="vertical" height="60px" />

            <div className={styles.commonBlock}>
                {isComingSoon && <div style={{ height: '36px', display: 'flex', alignItems: 'center' }}>--</div>}
                {!isComingSoon && !isLoading && (
                    <DsTypography variant="Regular_24" style={{ lineHeight: 'unset' }}>
                        {optimizationScore}%
                    </DsTypography>
                )}
                {!isComingSoon && isLoading && (
                    <div style={{ height: '36px', display: 'flex', alignItems: 'center' }}>
                        <DsFlashingDotsLoader />
                    </div>
                )}
                <DsTypography variant="Regular_14">Optimization score</DsTypography>
            </div>

            <SeparatorComponent variant="vertical" height="60px" />

            <div className={styles.thirdBlock}>
                {isComingSoon && <div style={{ height: '36px', display: 'flex', alignItems: 'center' }}>--</div>}
                {!isComingSoon && !isLoading && (
                    <div className={styles.commonBlockText}>
                        <DsTypography variant="Regular_24" style={{ lineHeight: 'unset' }}>
                            {optimizationInstances}
                        </DsTypography>
                        &nbsp;
                        <DsTypography variant="Regular_14" style={{ display: 'flex', alignItems: 'end' }}>
                            out of
                        </DsTypography>
                        &nbsp;
                        <DsTypography variant="Regular_24" style={{ lineHeight: 'unset' }}>
                            {totalOptimizationInstances}
                        </DsTypography>
                    </div>
                )}
                {!isComingSoon && isLoading && (
                    <div style={{ height: '36px', display: 'flex', alignItems: 'center' }}>
                        <DsFlashingDotsLoader />
                    </div>
                )}
                <DsTypography variant="Regular_14">Optimization instances</DsTypography>
            </div>

            <SeparatorComponent variant="vertical" height="60px" />

            <div className={styles.buttonBlock}>
                {isComingSoon && windowSize.width > 1700 && <ComingSoon />}
                {isComingSoon && windowSize.width < 1700 && <ComingSoon2 />}
                {!isComingSoon && (
                    <DsButton variant="secondary" isThin onClick={() => {}}>
                        Optimize
                    </DsButton>
                )}
            </div>
        </div>
    );
};

export default CategoryComponent;
