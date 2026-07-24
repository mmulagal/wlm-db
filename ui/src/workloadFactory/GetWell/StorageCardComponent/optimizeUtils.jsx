import i18next from 'i18next';
import DialogComponent from '../../../common/Dialog/DialogComponent';
import { ASSESSMENT_CONFIG_NAMES, DBType, FROM_DIALOG, GETWELL_STATUS } from '../../../utils/consts';
import { hasFixSupport } from '../../../utils/configRegistry';
import DialogContent from './DialogContent/DialogContent';
import store from '../../../store/store';
import { setDialogErrorWithTooltip } from '../../../store/workloadFactory/dialogComponentSlice';

// Check if linked config acknowledgment is required and show error if not acknowledged
export const checkLinkedConfigAcknowledge = () => {
    const { requireAcknowledge } = store.getState().dialogComponent;
    if (requireAcknowledge) {
        store.dispatch(
            setDialogErrorWithTooltip({
                showDialogError: true,
                errorMessage: i18next.t('databases.well-architect.linked-config.acknowledge-error'),
                showTooltipInfo: true,
                tooltipText: i18next.t('databases.well-architect.linked-config.acknowledge-error')
            })
        );
        return true;
    }
    return false;
};

// Function for handling the dialog from getwell page
export const handleDialog = (
    setDialog,
    type,
    callOptimizeApi,
    closeDialog,
    cardData,
    operation,
    singleRowData,
    engineType = DBType.MSSQL,
    isWad = false,
    isUnregistered = false
) => {
    // Get display name from cardData (flat API provides 'name' field)
    const displayName = cardData?.name || type || '';

    // Oracle FILE_SYSTEM_HEADROOM with permissions and under provisioned status - show enabled Continue button
    if (
        engineType === DBType.ORACLE &&
        !isWad &&
        !isUnregistered &&
        (type === ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM ||
            type === 'headroom' ||
            displayName === 'File system headroom') &&
        (!cardData?.missingPermissions || cardData?.missingPermissions.length === 0) &&
        cardData?.block_two?.value === GETWELL_STATUS.UNDER_PROVISIONED
    ) {
        setDialog(
            <DialogComponent
                header={displayName}
                content={
                    <DialogContent
                        type={type}
                        recommendationOptions={cardData?.recommendationOptions}
                        missingPermissions={cardData?.missingPermissions}
                        recommendedSizeInGib={cardData?.recommendedSizeInGib}
                        engineType={engineType}
                        status={cardData?.block_two?.value}
                        isWad={isWad}
                        isUnregistered={isUnregistered}
                    />
                }
                primaryButton={i18next.t('databases.general.continue')}
                secondaryButton={i18next.t('databases.general.cancel')}
                callback={() => {
                    callOptimizeApi(type, operation, singleRowData);
                }}
                closeCallback={() => {
                    closeDialog();
                }}
                customClass="innerPage"
            />
        );
    } else if (
        isUnregistered ||
        isWad ||
        !hasFixSupport(type, engineType, cardData?.block_two?.value, cardData?.missingPermissions)
    ) {
        setDialog(
            <DialogComponent
                header={displayName}
                content={
                    <DialogContent
                        type={type}
                        recommendationOptions={cardData?.recommendationOptions}
                        missingPermissions={cardData?.missingPermissions}
                        recommendedSizeInGib={cardData?.recommendedSizeInGib}
                        engineType={engineType}
                        status={cardData?.block_two?.value}
                        isWad={isWad}
                        isUnregistered={isUnregistered}
                    />
                }
                primaryButton="Close"
                callback={() => {
                    closeDialog();
                }}
                closeCallback={() => {
                    closeDialog();
                }}
                customClass={isWad ? 'oneTimeWADDialog' : 'innerPage'}
            />
        );
    } else {
        setDialog(
            <DialogComponent
                header={displayName}
                content={
                    <DialogContent
                        type={type}
                        recommendationOptions={cardData?.recommendationOptions}
                        missingPermissions={cardData?.missingPermissions}
                        recommendedSizeInGib={cardData?.recommendedSizeInGib}
                        engineType={engineType}
                        isWad={isWad}
                        isUnregistered={isUnregistered}
                    />
                }
                primaryButton={i18next.t('databases.general.continue')}
                secondaryButton={i18next.t('databases.general.cancel')}
                dialogFrom={FROM_DIALOG.OPTIMIZE}
                callback={() => {
                    if (engineType === DBType.ORACLE && checkLinkedConfigAcknowledge()) {
                        return;
                    }
                    callOptimizeApi(type, operation, singleRowData);
                }}
                closeCallback={() => {
                    closeDialog();
                }}
                customClass="innerPage"
            />
        );
    }
};

export const handleConfigDialog = (
    setDialog,
    callOptimizeApi,
    closeDialog,
    rowData,
    operation,
    singleRowData,
    isWad = false,
    isUnregistered = false,
    forceEnableInnerPage = false
) => {
    // Get config ID and display name from flat API
    // Flat API always provides: id (config ID like 'thin-provision') and name (display name like 'Thin Provision')
    const configId = rowData?.data?.id;
    const displayName = rowData?.data?.name;

    // For Oracle CRR in inner page, force enable Continue button even though fixSupported is false
    const isCloseButton =
        isWad ||
        isUnregistered ||
        (!forceEnableInnerPage &&
            !hasFixSupport(configId, rowData?.engineType, rowData?.data?.status, rowData?.data?.missingPermissions));
    if (isCloseButton) {
        setDialog(
            <DialogComponent
                header={`${displayName} `}
                content={
                    <DialogContent
                        type={configId}
                        engineType={rowData?.engineType}
                        isWad={isWad}
                        isUnregistered={isUnregistered}
                        objectsInViolation={rowData?.data?.objectsInViolation}
                        status={rowData?.data?.status}
                        missingPermissions={rowData?.data?.missingPermissions}
                    />
                }
                primaryButton={i18next.t('databases.general.close')}
                callback={() => {
                    closeDialog();
                }}
                closeCallback={() => {
                    closeDialog();
                }}
                customClass={isWad ? 'oneTimeWADDialog' : 'innerPage'}
            />
        );
    } else {
        setDialog(
            <DialogComponent
                header={`${displayName} `}
                content={
                    <DialogContent
                        type={configId}
                        engineType={rowData?.engineType}
                        isWad={isWad}
                        isUnregistered={isUnregistered}
                        objectsInViolation={rowData?.data?.objectsInViolation}
                        status={rowData?.data?.status}
                        missingPermissions={rowData?.data?.missingPermissions}
                        skipFixNotSupportedBanner={forceEnableInnerPage}
                    />
                }
                primaryButton={i18next.t('databases.general.continue')}
                secondaryButton={i18next.t('databases.general.cancel')}
                dialogFrom={FROM_DIALOG.OPTIMIZE}
                callback={() => {
                    if (checkLinkedConfigAcknowledge()) {
                        return;
                    }
                    callOptimizeApi(rowData?.data, operation, singleRowData);
                }}
                closeCallback={() => {
                    closeDialog();
                }}
                customClass="innerPage"
            />
        );
    }
};
