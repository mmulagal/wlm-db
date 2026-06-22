import i18next from 'i18next';
import DialogComponent from '../../../common/Dialog/DialogComponent';
import {
    ASSESSMENT_CONFIG_NAMES,
    DBType,
    FROM_DIALOG,
    GETWELL_STATUS,
    MSSQL_UNSUPPORTED_FIX_TYPES,
    ORACLE_UNSUPPORTED_FIX_TYPES,
    OVER_PROVISIONED_UNSUPPORTED_FIX_TYPES,
    UNDER_PROVISIONED_UNSUPPORTED_FIX_TYPES
} from '../../../utils/consts';
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
    isWad = false
) => {
    // Get display name from cardData (flat API provides 'name' field)
    const displayName = cardData?.name || '';

    // Oracle FILE_SYSTEM_HEADROOM with permissions and under provisioned status - show enabled Continue button
    if (
        engineType === DBType.ORACLE &&
        !isWad &&
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
        isWad ||
        MSSQL_UNSUPPORTED_FIX_TYPES.has(type) ||
        MSSQL_UNSUPPORTED_FIX_TYPES.has(displayName) ||
        ORACLE_UNSUPPORTED_FIX_TYPES.has(type) ||
        ORACLE_UNSUPPORTED_FIX_TYPES.has(displayName) ||
        (OVER_PROVISIONED_UNSUPPORTED_FIX_TYPES.has(type) &&
            cardData?.block_two?.value === GETWELL_STATUS.OVER_PROVISIONED) ||
        (OVER_PROVISIONED_UNSUPPORTED_FIX_TYPES.has(displayName) &&
            cardData?.block_two?.value === GETWELL_STATUS.OVER_PROVISIONED) ||
        (UNDER_PROVISIONED_UNSUPPORTED_FIX_TYPES.has(type) &&
            cardData?.block_two?.value === GETWELL_STATUS.UNDER_PROVISIONED &&
            cardData?.missingPermissions &&
            cardData?.missingPermissions.length > 0) ||
        (UNDER_PROVISIONED_UNSUPPORTED_FIX_TYPES.has(displayName) &&
            cardData?.block_two?.value === GETWELL_STATUS.UNDER_PROVISIONED &&
            cardData?.missingPermissions &&
            cardData?.missingPermissions.length > 0)
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
    isWad = false
) => {
    // Get config ID and display name from flat API
    // Flat API always provides: id (config ID like 'thin-provision') and name (display name like 'Thin Provision')
    const configId = rowData?.data?.id;
    const displayName = rowData?.data?.name;

    // Check if this is an ASM configuration that should only have a Close button
    // Note: UNSUPPORTED_FIX_TYPES sets use display names, so we check both displayName and configId for compatibility
    const isOracleWithUnsupportedFix =
        rowData?.engineType === DBType.ORACLE &&
        (ORACLE_UNSUPPORTED_FIX_TYPES.has(displayName) || ORACLE_UNSUPPORTED_FIX_TYPES.has(configId));
    const isMssqlWithUnsupportedFix =
        rowData?.engineType === DBType.MSSQL &&
        (MSSQL_UNSUPPORTED_FIX_TYPES.has(displayName) || MSSQL_UNSUPPORTED_FIX_TYPES.has(configId));

    const isCloseButton = isWad || isOracleWithUnsupportedFix || isMssqlWithUnsupportedFix;
    if (isCloseButton) {
        setDialog(
            <DialogComponent
                header={`${displayName} `}
                content={
                    <DialogContent
                        type={configId}
                        engineType={rowData?.engineType}
                        isWad={isWad}
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
                        objectsInViolation={rowData?.data?.objectsInViolation}
                        status={rowData?.data?.status}
                        missingPermissions={rowData?.data?.missingPermissions}
                    />
                }
                primaryButton={i18next.t('databases.general.continue')}
                secondaryButton={i18next.t('databases.general.cancel')}
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
