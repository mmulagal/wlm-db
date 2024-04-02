import { Button, Typography, useDialog } from '@netapp/design-system';
import { useAppSelector } from '../../../../store/storeHooks';
import DialogComponent from '../../../../common/Dialog/DialogComponent';
import { GENERAL } from '../../../../utils/appConstants';
import ViewDialog from '../../../../common/ViewDialog/ViewDialog';
import CommonStyles from '../../../../utils/CommonStyles.module.scss';
import styles from './AwsAccount.module.scss';
import MissingPermissionTable from './MissingPermissionTable/MissingPermissionTable';
import { useEffect, useState } from 'react';

type permissionProp = {
    permissionData?: any;
};

const MissingPermissionsMsg = ({ permissionData }: permissionProp) => {
    const { setDialog } = useDialog();
    const deployRedirectToCfLink = useAppSelector(state => state.msSqlAction.deployRedirectToCfLink);
    const isDemoMode = useAppSelector(state => state.auth.isDemoMode);
    const { policiesList } = useAppSelector(state => state.mssql.getPolicies);
    const blockedPermissions =
        (permissionData?.blockedByOrganisation && permissionData?.blockedByOrganisation.length) ||
        (permissionData?.blockedByPermissionBoundary && permissionData?.blockedByPermissionBoundary.length);

    const [dataToDisplay, setDataToDisplay] = useState([]);
    const [permissionCount, setPermissionCount] = useState(0);

    const modifyPermissions = (obj: any) => {
        if (obj.error === 'implicitDeny') {
            return { ...obj, error: `${GENERAL.MISSING_PERMISSION}` };
        } else if (obj.error === 'explicitDeny') {
            return { ...obj, error: `${GENERAL.BLOCKED_BY_PERMISSION_BOUNDARY}` };
        } else {
            return { ...obj, error: `${obj.error}` };
        }
    };

    useEffect(() => {
        if (blockedPermissions) {
            const updatedMissingPermissions =
                permissionData?.missingStatements.length &&
                permissionData?.missingStatements.map((obj: any) => {
                    return modifyPermissions(obj);
                });

            const updatedBlockedByOrganization =
                permissionData?.blockedByOrganisation.length > 0 &&
                permissionData?.blockedByOrganisation.map((obj: any) => {
                    return modifyPermissions(obj);
                });

            const updatedBlockedByPermissionBoundary =
                permissionData?.blockedByPermissionBoundary.length &&
                permissionData?.blockedByPermissionBoundary.map((obj: any) => {
                    return modifyPermissions(obj);
                });
            let mergeData = [];
            if (
                updatedMissingPermissions.length &&
                updatedBlockedByOrganization.length &&
                updatedBlockedByPermissionBoundary.length
            ) {
                mergeData = updatedMissingPermissions.concat(
                    updatedBlockedByOrganization,
                    updatedBlockedByPermissionBoundary
                );
            } else if (updatedMissingPermissions.length && updatedBlockedByOrganization.length) {
                mergeData = updatedMissingPermissions.concat(updatedBlockedByOrganization);
            } else if (updatedMissingPermissions.length && updatedBlockedByPermissionBoundary.length) {
                mergeData = updatedMissingPermissions.concat(updatedBlockedByPermissionBoundary);
            } else if (updatedBlockedByOrganization.length && updatedBlockedByPermissionBoundary.length) {
                mergeData = updatedBlockedByOrganization.concat(updatedBlockedByPermissionBoundary);
            } else {
                mergeData = updatedMissingPermissions;
            }

            setDataToDisplay(mergeData);
            setPermissionCount(mergeData.length);
        } else {
            const updatedMissingPermissions = permissionData?.missingStatements.map((obj: any) => {
                return modifyPermissions(obj);
            });

            setDataToDisplay(updatedMissingPermissions);
        }
    }, [permissionData]);

    const setHeading = (type: string) => {
        if (blockedPermissions && type === 'operate') {
            return GENERAL.REQUIRED_OPERATE_PERMISSIONS;
        } else if (blockedPermissions && type !== 'operate') {
            return `${permissionCount} ${GENERAL.MISSING_AND_BLOCKED_PERMISSIONS}`;
        } else {
            return GENERAL.UNSUPPORTED_PERMISSIONS;
        }
    };

    const openDialog = (type: string) => {
        const data = JSON.stringify(type === 'view' ? policiesList?.view : policiesList?.operate, null, 2);
        setDialog(
            <DialogComponent
                header={setHeading(type)}
                content={
                    type === 'operate' ? (
                        <ViewDialog data={data} />
                    ) : (
                        <MissingPermissionTable
                            missingBlockedPermissions={blockedPermissions}
                            content={dataToDisplay}
                        />
                    )
                }
                primaryButton={GENERAL.CLOSE}
                callback={() => {}}
                customClass={styles.setWidth}
            />
        );
    };

    const openDemoInfoDialog = () => {
        setDialog(
            <DialogComponent
                header={GENERAL.DEMO_TITLE}
                content={<Typography variant="Regular_14">{`${GENERAL.DEMO_CONTENT}`}</Typography>}
                primaryButton={GENERAL.CONTINUE}
                callback={() => {}}
            />
        );
    };

    const redirectToCf = () => {
        if (isDemoMode) {
            openDemoInfoDialog();
        } else {
            window.open(deployRedirectToCfLink, '_blank', 'noopener');
        }
    };

    return (
        <div className={styles.noteText}>
            {!blockedPermissions ? (
                <>
                    {GENERAL.CREATE_PERMISSION_ERROR[0]}
                    <Button
                        Component="button"
                        variant="text"
                        className={CommonStyles.buttonClass}
                        onClick={() => openDialog('missing')}
                    >
                        {GENERAL.CREATE_PERMISSION_ERROR[1]}
                    </Button>
                    <div>
                        {GENERAL.CREATE_PERMISSION_ERROR[2]}
                        {deployRedirectToCfLink || isDemoMode ? (
                            <Button
                                Component="button"
                                variant="link"
                                className={CommonStyles.buttonClass}
                                onClick={() => redirectToCf()}
                            >
                                {GENERAL.CREATE_PERMISSION_ERROR[3]}
                            </Button>
                        ) : (
                            GENERAL.CREATE_PERMISSION_ERROR[3]
                        )}
                        {GENERAL.CREATE_PERMISSION_ERROR[4]}
                    </div>
                </>
            ) : (
                <>
                    {GENERAL.MISSING_BLOCKED_PERMISSIONS[0]}
                    <Button
                        Component="button"
                        variant="text"
                        className={CommonStyles.buttonClass}
                        onClick={() => openDialog('blocked')}
                    >
                        {GENERAL.MISSING_BLOCKED_PERMISSIONS[1]}
                    </Button>
                    {GENERAL.MISSING_BLOCKED_PERMISSIONS[2]}
                    <div>
                        {GENERAL.MISSING_BLOCKED_PERMISSIONS[3]}
                        <Button Component="button" variant="text" onClick={() => openDialog('operate')}>
                            {GENERAL.MISSING_BLOCKED_PERMISSIONS[6]}
                        </Button>
                        {GENERAL.MISSING_BLOCKED_PERMISSIONS[4]}
                    </div>

                    <div>{GENERAL.MISSING_BLOCKED_PERMISSIONS[5]}</div>
                </>
            )}
        </div>
    );
};

export default MissingPermissionsMsg;
