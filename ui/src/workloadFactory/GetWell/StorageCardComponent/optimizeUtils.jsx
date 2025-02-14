import DialogComponent from '../../../common/Dialog/DialogComponent';
import { GENERAL } from '../../../utils/appConstants';
import { ASSESSMENT_CONFIG_NAMES } from '../../../utils/consts';
import DialogContent from './DialogContent/DialogContent';

//Function for handling the dialog from getwell page
export const handleDialog = (setDialog, type, callOptimizeApi, closeDialog, cardData) => {
    setDialog(
        <DialogComponent
            header={`${type} optimization`}
            content={
                <DialogContent
                    type={type}
                    recommendationOptions={cardData?.recommendationOptions}
                    missingPermissions={cardData?.missingPermissions}
                    recommendedSizeInGib={cardData?.recommendedSizeInGib}
                />
            }
            primaryButton={GENERAL.CONTINUE}
            secondaryButton={GENERAL.CANCEL}
            callback={() => {
                callOptimizeApi(type);
            }}
            closeCallback={() => {
                closeDialog();
            }}
            customClass={'innerPage'}
            hidePrimaryButton={
                (type === ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM ||
                    type === ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE ||
                    type === ASSESSMENT_CONFIG_NAMES.TEMPDB_DRIVE_SIZE) &&
                cardData?.missingPermissions &&
                cardData?.missingPermissions.length > 0
            }
        />
    );
};

const isDialogPrimaryBtnDisabled = rowData => {
    return rowData?.name === 'OS type' || rowData?.name === 'NTFS allocation unit size';
};

export const handleOntapDialog = (setDialog, callOptimizeApi, closeDialog, rowData) => {
    setDialog(
        <DialogComponent
            header={`${rowData?.name} optimization`}
            content={<DialogContent type={rowData?.name} />}
            primaryButton={GENERAL.CONTINUE}
            secondaryButton={GENERAL.CANCEL}
            callback={() => {
                callOptimizeApi(rowData);
            }}
            closeCallback={() => {
                closeDialog();
            }}
            customClass={'innerPage'}
            primaryButtonDisabled={isDialogPrimaryBtnDisabled(rowData)}
            primaryButtonTooltip={isDialogPrimaryBtnDisabled(rowData) ? GENERAL.COMING_SOON : ''}
        />
    );
};
