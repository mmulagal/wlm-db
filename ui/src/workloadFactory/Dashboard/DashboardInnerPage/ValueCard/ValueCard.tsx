import { DsTypography, Popover, TooltipInfo } from '@netapp/design-system';
import styles from './ValueCard.module.scss';
import { ReactComponent as Edit } from '../../../../assets/ic_edit.svg';
import { GENERAL } from '../../../../utils/appConstants';

type ValueCardProps = {
    optimizationScore?: string;
    optimizedInstances?: string;
    notOptimizedInstances?: string;
    severity?: string;
    instances?: string;
    configurationState?: string;
    from?: string;
    tooltipText?: string;
    type?: string;
    handleEdit?: any;
};

const ValueCard = ({
    optimizedInstances,
    notOptimizedInstances,
    severity,
    instances,
    configurationState,
    from = 'innerPage',
    tooltipText,
    type,
    handleEdit
}: ValueCardProps) => (
    <>
        {from === 'innerPage' && (
            <div className={styles.valueCard}>
                <div className={styles.block} style={{ borderRight: '1px solid var(--border)' }}>
                    <DsTypography variant="Regular_24" style={{ lineHeight: 'unset' }}>
                        {optimizedInstances}
                    </DsTypography>
                    <DsTypography variant="Regular_14">Well-architected instances</DsTypography>
                </div>

                <div className={styles.block} style={{ borderRight: '1px solid var(--border)' }}>
                    <DsTypography variant="Regular_24" style={{ lineHeight: 'unset' }}>
                        {notOptimizedInstances}
                    </DsTypography>
                    <DsTypography variant="Regular_14">Not-optimized instances</DsTypography>
                </div>

                <div className={styles.block} style={{ borderRight: '1px solid var(--border)' }}>
                    <DsTypography variant="Semibold_14">{severity}</DsTypography>
                    <DsTypography variant="Regular_14">Severity</DsTypography>
                </div>

                <div className={styles.block}>
                    <div className={styles.configState}>
                        <DsTypography variant="Semibold_14">{configurationState}</DsTypography>
                        <Popover
                            children={GENERAL.MANAGE_ANALYSIS_STATE}
                            trigger="hover"
                            container={
                                <div onClick={() => handleEdit(type)}>
                                    <Edit />
                                </div>
                            }
                        />
                    </div>
                    <DsTypography variant="Regular_14">Analysis state</DsTypography>
                </div>
            </div>
        )}
        {from === 'dismissPage' && (
            <div className={styles.valueCard}>
                <div className={styles.block} style={{ borderRight: '1px solid var(--border)' }}>
                    <DsTypography variant="Regular_24" style={{ lineHeight: 'unset' }}>
                        {instances}
                    </DsTypography>
                    <DsTypography variant="Regular_14">Instances</DsTypography>
                </div>

                <div className={styles.block} style={{ borderRight: '1px solid var(--border)' }}>
                    <div className={styles.configContainer}>
                        {tooltipText && <TooltipInfo>{tooltipText}</TooltipInfo>}
                        <DsTypography variant="Semibold_14">{configurationState}</DsTypography>
                    </div>

                    <DsTypography variant="Regular_14">Analysis state</DsTypography>
                </div>

                <div className={styles.block}>
                    <DsTypography variant="Semibold_14">{severity}</DsTypography>
                    <DsTypography variant="Regular_14">Severity</DsTypography>
                </div>
            </div>
        )}
    </>
);

export default ValueCard;
