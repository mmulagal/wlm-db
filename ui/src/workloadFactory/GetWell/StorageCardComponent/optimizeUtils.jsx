import DialogComponent from '../../../common/Dialog/DialogComponent';
import { GENERAL } from '../../../utils/appConstants';
import { ASSESSMENT_CONFIG_NAMES, DBType, FROM_DIALOG } from '../../../utils/consts';
import DialogContent from './DialogContent/DialogContent';

const primaryButtonDisable = (engineType, type) => {
    // oracle storage layout 6 configs fix are disabled
    if (
        engineType === DBType.ORACLE &&
        (type === ASSESSMENT_CONFIG_NAMES.REDO_LOGS_PLACEMENT ||
            type === ASSESSMENT_CONFIG_NAMES.TEMP_LOGS_PLACEMENT ||
            type === ASSESSMENT_CONFIG_NAMES.ARCHIVE_PLACEMENT ||
            type === ASSESSMENT_CONFIG_NAMES.DATAFILES_PLACEMENT ||
            type === ASSESSMENT_CONFIG_NAMES.CONTROLFILES_PLACEMENT ||
            type === ASSESSMENT_CONFIG_NAMES.ORACLE_BINARY_PLACEMENT)
    ) {
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
                primaryButtonDisabled={primaryButtonDisable(engineType, type)}
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

const isDialogPrimaryBtnDisabled = rowData => {
    if (
        rowData?.engineType === DBType.MSSQL &&
        (rowData?.data?.name === 'OS type' || rowData?.data?.name === 'NTFS allocation unit size')
    ) {
        return true;
    }
    if (
        rowData?.engineType === DBType.ORACLE &&
        (rowData?.data?.name === ASSESSMENT_CONFIG_NAMES.MULTIPATH_IO ||
            rowData?.data?.name === ASSESSMENT_CONFIG_NAMES.HOST_UTILITIES ||
            rowData?.data?.name === ASSESSMENT_CONFIG_NAMES.TRANSPARENT_HUGEPAGES ||
            rowData?.data?.name === ASSESSMENT_CONFIG_NAMES.SELINUX ||
            rowData?.data?.name === ASSESSMENT_CONFIG_NAMES.ISCSI_REPLACEMENT_TIMEOUT ||
            rowData?.data?.name === ASSESSMENT_CONFIG_NAMES.MULTIPATH_FRIENDLY_NAMES ||
            rowData?.data?.name === ASSESSMENT_CONFIG_NAMES.TCP_ADVANCED_OPTIONS ||
            rowData?.data?.name === ASSESSMENT_CONFIG_NAMES.FILESYSTEMS_IO_OPTIONS ||
            rowData?.data?.name === ASSESSMENT_CONFIG_NAMES.MULTIPATH_READCOUNT ||
            rowData?.data?.name === ASSESSMENT_CONFIG_NAMES.MULTIPATH_IO_SESSIONS ||
            rowData?.data?.name === ASSESSMENT_CONFIG_NAMES.MULTIPATH_CONFIGURATION ||
            rowData?.data?.name === ASSESSMENT_CONFIG_NAMES.KERNEL_PARAMETERS ||
            rowData?.data?.name === ASSESSMENT_CONFIG_NAMES.NFSV4_DOMAIN_NAME)
    ) {
        return true;
    }
    return false;
};

export const handleOntapDialog = (setDialog, callOptimizeApi, closeDialog, rowData, operation, singleRowData) => {
    // Check if this is an ASM configuration that should only have a Close button
    const isCloseButton =
        rowData?.data?.name === ASSESSMENT_CONFIG_NAMES.ASM_EXTERNAL_REDUNDANCY ||
        rowData?.data?.name === ASSESSMENT_CONFIG_NAMES.NFS_MOUNT_OPTIONS_DATABASEFILES;
    if (isCloseButton) {
        setDialog(
            <DialogComponent
                header={`${rowData?.data?.name} `}
                content={<DialogContent type={rowData?.data?.name} engineType={rowData?.engineType} />}
                primaryButton={GENERAL.CLOSE}
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
    }
};
