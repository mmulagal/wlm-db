import { NOTIFICATION_TYPES, addNotification } from '../../../../store/notificationSlice';
import { GENERAL } from '../../../../utils/appConstants';
import { MANAGE_STATES } from '../../../../utils/consts';

export const handleSingleInstanceManage = (manageSingleInstanceChecks: any, dispatch: any) => {
    if (
        manageSingleInstanceChecks?.assessment === GENERAL.NOT_AVAILABLE &&
        manageSingleInstanceChecks?.remediation === GENERAL.NOT_AVAILABLE &&
        manageSingleInstanceChecks?.dbCreation === GENERAL.NOT_AVAILABLE &&
        manageSingleInstanceChecks?.sandbox === GENERAL.NOT_AVAILABLE
    ) {
        dispatch(
            addNotification({
                notificationType: NOTIFICATION_TYPES.ERROR,
                message: (
                    <>
                        <span style={{ fontWeight: '500' }}>{GENERAL.MANAGE_MIN_PERMISSION_REQUIRED[0]}</span>
                        <span style={{ fontWeight: '400' }}>{GENERAL.MANAGE_MIN_PERMISSION_REQUIRED[1]}</span>
                    </>
                )
            })
        );
    } else if (
        manageSingleInstanceChecks?.assessment === MANAGE_STATES.MISSING_PREREQUISITES &&
        manageSingleInstanceChecks?.remediation === MANAGE_STATES.MISSING_PREREQUISITES &&
        manageSingleInstanceChecks?.dbCreation === MANAGE_STATES.MISSING_PREREQUISITES &&
        manageSingleInstanceChecks?.sandbox === MANAGE_STATES.MISSING_PREREQUISITES
    ) {
        dispatch(
            addNotification({
                notificationType: NOTIFICATION_TYPES.ERROR,
                message: (
                    <>
                        <span style={{ fontWeight: '500' }}>{GENERAL.MANAGE_MIN_PERMISSION_REQUIRED[0]}</span>
                        <span style={{ fontWeight: '400' }}>{GENERAL.MANAGE_MIN_PERMISSION_REQUIRED[1]}</span>
                    </>
                )
            })
        );
    } else {
        // call API
    }
};
