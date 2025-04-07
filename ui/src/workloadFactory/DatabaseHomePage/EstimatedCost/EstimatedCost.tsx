import styles from './EstimatedCost.module.scss';
import { Button, FlashingDotsLoader, TooltipInfo, Typography, useDialog } from '@netapp/design-system';
import SquareComponent from '../SquareComponent/SquareComponent';
import { GENERAL } from '../../../utils/appConstants';
import DialogComponent from '../../../common/Dialog/DialogComponent';
import EstimatedCostDialogContent from './EstimatedCostDialogContent/EstimatedCostDialogContent';
import { useEffect, useState } from 'react';
import { formatNumberWithCustomComma } from '../../../utils/utilityFunctions';

type EstimatedCostProps = {
    hostData: any;
    hostsLoading?: boolean;
};

const EstimatedCost = ({ hostData, hostsLoading }: EstimatedCostProps) => {
    const { setDialog } = useDialog();

    const [linkChk, setLinkChk] = useState(true);

    useEffect(() => {
        if (hostData) {
            setLinkChk(hostData?.requireBillingPerm || false);
        }
    }, [hostData]);

    const ToolTipContainer = () => {
        return (
            <div className={styles.tooltipContainerClass}>
                <Typography variant="Regular_13">{GENERAL.ESTIMATED_COST_TOOLTIP}</Typography>
                {linkChk && (
                    <Button variant="text" onClick={() => costDialog()}>
                        {GENERAL.LEARN_HOW_ESTIMATED_COST}
                    </Button>
                )}
            </div>
        );
    };

    const costDialog = () => {
        setDialog(
            <DialogComponent
                header="Improve cost accuracy"
                content={<EstimatedCostDialogContent />}
                primaryButton={GENERAL.CLOSE}
                callback={() => {}}
            />
        );
    };
    return (
        <div className={styles.estimatedCost}>
            <div className={styles.headSection}>
                <div className={styles.tooltipSection}>
                    <Typography variant="Regular_16" className={styles.title}>
                        {GENERAL.ESTIMATED_MONTHLY_COST}
                    </Typography>
                    <TooltipInfo interactive={true} delayHide={200} trigger="hover" placement="bottom-end">
                        <Typography variant="Regular_13" className={styles.textWidth}>
                            {ToolTipContainer()}
                        </Typography>
                    </TooltipInfo>
                </div>

                <div className={styles.rightTopValue}>
                    <Typography variant="Semibold_20" style={{ lineHeight: 'unset' }}>
                        ${formatNumberWithCustomComma(hostData?.totalCost)}
                    </Typography>
                    {hostsLoading && <FlashingDotsLoader />}
                </div>
            </div>

            <div className={styles.mainSection}>
                {/* Progress Bar */}
                <div className={styles.progressBar}>
                    {hostData?.storageCostPercent === 0 &&
                        hostData?.computeCostPercent === 0 &&
                        hostData?.connectivityCostPercent === 0 &&
                        hostData?.otherCostPercent === 0 && (
                            <div
                                className={`${styles.progress} ${styles.leftCurveBar} ${styles.rightCurveBar}`}
                                style={{
                                    width: `${100}%`,
                                    backgroundColor: 'var(--chart-disabled)'
                                }}
                            ></div>
                        )}
                    {hostData?.storageCostPercent !== 0 && (
                        <div
                            className={`${styles.progress} ${styles.leftCurveBar} 
                                ${
                                    hostData?.computeCostPercent === 0 &&
                                    hostData?.connectivityCostPercent === 0 &&
                                    hostData?.otherCostPercent === 0 &&
                                    styles.rightCurveBar
                                }`}
                            style={{
                                width: `${hostData?.storageCostPercent}%`,
                                backgroundColor: 'var(--chart-9)'
                            }}
                        ></div>
                    )}
                    <div className={styles.separator}></div>
                    {hostData?.computeCostPercent !== 0 && (
                        <div
                            className={`${styles.progress} 
                                        ${hostData?.storageCostPercent === 0 && styles.leftCurveBar} 
                                        ${
                                            hostData?.connectivityCostPercent === 0 &&
                                            hostData?.otherCostPercent === 0 &&
                                            styles.rightCurveBar
                                        }`}
                            style={{
                                width: `${hostData?.computeCostPercent}%`,
                                backgroundColor: 'var(--chart-1)'
                            }}
                        ></div>
                    )}
                    <div className={styles.separator}></div>
                    {hostData?.connectivityCostPercent !== 0 && (
                        <div
                            className={`${styles.progress} 
                                        ${
                                            hostData?.storageCostPercent === 0 &&
                                            hostData?.computeCostPercent === 0 &&
                                            styles.leftCurveBar
                                        } 
                                        ${hostData?.otherCostPercent === 0 && styles.rightCurveBar}`}
                            style={{
                                width: `${hostData?.connectivityCostPercent}%`,
                                backgroundColor: 'var(--chart-3)'
                            }}
                        ></div>
                    )}
                    <div className={styles.separator}></div>
                    {hostData?.otherCostPercent !== 0 && (
                        <div
                            className={`${styles.progress} 
                                        ${
                                            hostData?.storageCostPercent === 0 &&
                                            hostData?.computeCostPercent === 0 &&
                                            hostData?.connectivityCostPercent === 0 &&
                                            styles.leftCurveBar
                                        } 
                                        ${styles.rightCurveBar}`}
                            style={{
                                width: `${hostData?.otherCostPercent}%`,
                                backgroundColor: 'var(--chart-4)'
                            }}
                        ></div>
                    )}
                </div>
                {/* Ends here */}

                <div className={styles.bottomSection}>
                    <SquareComponent
                        value={'$' + formatNumberWithCustomComma(hostData?.storageCost)}
                        color="var(--chart-9)"
                        text={'Storage'}
                        loadingInFirstRow={hostsLoading}
                        isSmall={true}
                    />
                    <div className={styles.storageSeparator} />
                    <SquareComponent
                        value={'$' + formatNumberWithCustomComma(hostData?.computeCost)}
                        color="var(--chart-1)"
                        text={'Compute'}
                        loadingInFirstRow={hostsLoading}
                        isSmall={true}
                    />
                    <div className={styles.storageSeparator} />
                    <SquareComponent
                        value={'$' + formatNumberWithCustomComma(hostData?.connectivityCost)}
                        color="var(--chart-3)"
                        text={'Connectivity'}
                        loadingInFirstRow={hostsLoading}
                        isSmall={true}
                    />
                    <div className={styles.storageSeparator} />
                    <SquareComponent
                        value={'$' + formatNumberWithCustomComma(hostData?.otherCost)}
                        color="var(--chart-4)"
                        text={'Other'}
                        loadingInFirstRow={hostsLoading}
                        isSmall={true}
                    />
                </div>
            </div>
        </div>
    );
};

export default EstimatedCost;
