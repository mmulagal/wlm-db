import DialogComponent from '../../../common/Dialog/DialogComponent';
import { GENERAL } from '../../../utils/appConstants';
import { ASSESSMENT_CONFIG_NAMES, DBType, FROM_DIALOG } from '../../../utils/consts';
import DialogContent from './DialogContent/DialogContent';

// Function for handling the dialog from getwell page
export const handleDialog = (
    setDialog,
    type,
    callOptimizeApi,
    closeDialog,
    cardData,
    operation,
    singleRowData,
    engineType = DBType.MSSQL
) => {
    if (
        type === ASSESSMENT_CONFIG_NAMES.OPERATING_SYSTEM_PATCH ||
        type === ASSESSMENT_CONFIG_NAMES.MICROSOFT_SQL_SERVER_PATCH ||
        type === ASSESSMENT_CONFIG_NAMES.DRIVE_LETTER
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
                        missingPatchList={cardData?.missingPatchList}
                    />
                }
                primaryButton="Close"
                callback={() => {
                    closeDialog();
                }}
                closeCallback={() => {
                    closeDialog();
                }}
                customClass="innerPage"
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
                    />
                }
                primaryButton={GENERAL.CONTINUE}
                secondaryButton={GENERAL.CANCEL}
                dialogFrom={FROM_DIALOG.OPTIMIZE}
                callback={() => {
                    callOptimizeApi(type, operation, singleRowData);
                }}
                closeCallback={() => {
                    closeDialog();
                }}
                customClass="innerPage"
                primaryButtonDisabled={engineType === DBType.ORACLE}
                hidePrimaryButton={
                    (type === ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM ||
                        type === ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE ||
                        type === ASSESSMENT_CONFIG_NAMES.TEMPDB_DRIVE_SIZE) &&
                    cardData?.missingPermissions &&
                    cardData?.missingPermissions.length > 0
                }
            />
        );
    }
};

const isDialogPrimaryBtnDisabled = rowData =>
    rowData?.engineType === DBType.MSSQL &&
    (rowData?.data?.name === 'OS type' || rowData?.data?.name === 'NTFS allocation unit size');

export const handleOntapDialog = (setDialog, callOptimizeApi, closeDialog, rowData, operation, singleRowData) => {
    setDialog(
        <DialogComponent
            header={`${rowData?.data?.name} `}
            content={<DialogContent type={rowData?.data?.name} engineType={rowData?.engineType} />}
            primaryButton={GENERAL.CONTINUE}
            secondaryButton={GENERAL.CANCEL}
            callback={() => {
                callOptimizeApi(rowData?.data, operation, singleRowData);
            }}
            closeCallback={() => {
                closeDialog();
            }}
            customClass="innerPage"
            primaryButtonDisabled={isDialogPrimaryBtnDisabled(rowData)}
            primaryButtonTooltip={isDialogPrimaryBtnDisabled(rowData) ? GENERAL.COMING_SOON : ''}
        />
    );
};
