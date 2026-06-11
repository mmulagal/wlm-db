import i18next from 'i18next';
import DialogComponent from '../../../common/Dialog/DialogComponent';
import { GENERAL } from '../../../utils/appConstants';
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
    // Oracle FILE_SYSTEM_HEADROOM with permissions and under provisioned status - show enabled Continue button
    if (
        engineType === DBType.ORACLE &&
        !isWad &&
        type === ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM &&
        (!cardData?.missingPermissions || cardData?.missingPermissions.length === 0) &&
        cardData?.block_two?.value === GETWELL_STATUS.UNDER_PROVISIONED
    ) {
        setDialog(
            <DialogComponent
                header={`${type}`}
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
                primaryButton={GENERAL.CONTINUE}
                secondaryButton={GENERAL.CANCEL}
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
        ORACLE_UNSUPPORTED_FIX_TYPES.has(type) ||
        (OVER_PROVISIONED_UNSUPPORTED_FIX_TYPES.has(type) &&
            cardData?.block_two?.value === GETWELL_STATUS.OVER_PROVISIONED) ||
        (UNDER_PROVISIONED_UNSUPPORTED_FIX_TYPES.has(type) &&
            cardData?.block_two?.value === GETWELL_STATUS.UNDER_PROVISIONED &&
            cardData?.missingPermissions &&
            cardData?.missingPermissions.length > 0)
    ) {
        setDialog(
            <DialogComponent
                header={`${type}`}
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
                header={`${type}`}
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
                primaryButton={GENERAL.CONTINUE}
                secondaryButton={GENERAL.CANCEL}
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

export const handleOntapDialog = (
    setDialog,
    callOptimizeApi,
    closeDialog,
    rowData,
    operation,
    singleRowData,
    isWad = false
) => {
    // Check if this is an ASM configuration that should only have a Close button
    const isOracleWithUnsupportedFix =
        rowData?.engineType === DBType.ORACLE && ORACLE_UNSUPPORTED_FIX_TYPES.has(rowData?.data?.name);
    const isMssqlWithUnsupportedFix =
        rowData?.engineType === DBType.MSSQL && MSSQL_UNSUPPORTED_FIX_TYPES.has(rowData?.data?.name);

    const isCloseButton = isWad || isOracleWithUnsupportedFix || isMssqlWithUnsupportedFix;
    if (isCloseButton) {
        setDialog(
            <DialogComponent
                header={`${rowData?.data?.name} `}
                content={<DialogContent type={rowData?.data?.name} engineType={rowData?.engineType} isWad={isWad} />}
                primaryButton={GENERAL.CLOSE}
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
                header={`${rowData?.data?.name} `}
                content={<DialogContent type={rowData?.data?.name} engineType={rowData?.engineType} isWad={isWad} />}
                primaryButton={GENERAL.CONTINUE}
                secondaryButton={GENERAL.CANCEL}
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
