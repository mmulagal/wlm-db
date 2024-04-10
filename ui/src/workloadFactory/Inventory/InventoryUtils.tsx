import { DsFlashingDotsLoader, TooltipInfo, Typography } from "@netapp/design-system";
import { GENERAL } from "../../utils/appConstants";
import { formatFractionalNumber, isAwsBackupEnabled } from "../../utils/utilityFunctions";
import EstimatedCostPopover from "./EstimatedCostPopover/EstimatedCostPopover";

export const renderProtectionColumn = (cellData: any, rowData: any, styles: any) => {
    const isLoading = rowData?.loading;
                const protectionData = rowData?.protection;
                const totalDbCount = rowData?.databaseCount || 0;
                let protectedChk = false;
                if (
                    isAwsBackupEnabled(rowData) ||
                    protectionData?.isFsxOntapSnapshotsEnabled ||
                    protectionData?.isSqlNativeEnabled
                ) {
                    protectedChk = true;
                }

                let protectionDbCount = 0;
                let protectionPercent = 0;
                if (isAwsBackupEnabled(rowData) || protectionData?.isFsxOntapSnapshotsEnabled) {
                    protectionDbCount = totalDbCount;
                    protectionPercent = 100;
                } else if (protectionData?.isSqlNativeEnabled) {
                    protectionDbCount = protectionData?.protectedDatabases || 0;
                    protectionPercent =
                        totalDbCount > 0 && protectionDbCount <= totalDbCount
                            ? (protectionDbCount / totalDbCount) * 100
                            : 0;
                }

                return (
                    <>
                        {protectionData && (
                            <div className={styles.colText}>
                                {protectedChk && (
                                    <TooltipInfo onVisibleChange={function noRefCheck() {}}>
                                        {protectionDbCount +
                                            GENERAL.PROTECTION_TOOLTIP[0] +
                                            totalDbCount +
                                            GENERAL.PROTECTION_TOOLTIP[1]}
                                    </TooltipInfo>
                                )}
                                <div className={styles.protection}>
                                    <Typography variant="Regular_14">
                                        {protectedChk
                                            ? formatFractionalNumber(protectionPercent) + '% ' + GENERAL.PROTECTION
                                            : GENERAL.NOT_PROTECTED}
                                    </Typography>
                                </div>
                            </div>
                        )}
                        {!protectionData && isLoading && <DsFlashingDotsLoader />}
                        {!protectionData && !isLoading && GENERAL.NOT_AVAILABLE}
                    </>
                );
};

export const renderEstimatedCost = (cellData: any, rowData: any, styles: any) => {
    const costData = rowData?.estimatedUsageCost;
                const totalCost = costData?.compute + costData?.storage?.fsxn + costData?.storage?.fsxw + costData?.storage?.ebs + costData?.connectivity + costData?.others;
                return (
                    <>
                        {costData && (
                            <div className={styles.cost}>
                                <TooltipInfo className={styles.tooltipClass} onVisibleChange={function noRefCheck() {}}>
                                    {EstimatedCostPopover({ ...costData, totalCost: totalCost })}
                                </TooltipInfo>
                                <Typography variant="Regular_14">{`$ ${formatFractionalNumber(
                                    totalCost,
                                    2
                                )}`}</Typography>
                            </div>
                        )}
                        {!costData && rowData?.loading && <DsFlashingDotsLoader />}
                        {!costData && !rowData?.loading && GENERAL.NOT_AVAILABLE}
                    </>
                );
};
