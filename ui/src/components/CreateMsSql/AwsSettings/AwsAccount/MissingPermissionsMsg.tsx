import { Button, useDialog } from '@netapp/design-system';
import { useEffect, useState } from 'react';
import { useAppSelector } from '../../../../store/storeHooks';
import DialogComponent from '../../../../common/Dialog/DialogComponent';
import { GENERAL } from '../../../../utils/appConstants';
import ViewDialog from '../../../../common/ViewDialog/ViewDialog';
import CommonStyles from '../../../../utils/CommonStyles.module.scss';
import styles from './AwsAccount.module.scss';
import MissingPermissionTable from './MissingPermissionTable/MissingPermissionTable';
import { POLICIES_PERMISSIONS } from '../../../../utils/consts';

type permissionProp = {
    permissionData?: any;
};

const MissingPermissionsMsg = ({ permissionData }: permissionProp) => {
    const { setDialog } = useDialog();
    const { policiesList } = useAppSelector(state => state.mssql.getPolicies);
    const blockedPermissions = permissionData?.explicitlyDenied && permissionData?.explicitlyDenied.length;

    const [dataToDisplay, setDataToDisplay] = useState([]);
    const [permissionCount, setPermissionCount] = useState(0);

    const modifyPermissions = (obj: any, msg: string) => {
        if (msg === 'missing') {
            return { ...obj, error: `${GENERAL.MISSING_PERMISSION}` };
        }
        if (msg === 'blocked') {
            return { ...obj, error: `${GENERAL.BLOCKED_BY_PERMISSION_BOUNDARY}` };
        }
        return { ...obj, error: `${GENERAL.MISSING_PERMISSION}` };
    };

    useEffect(() => {
        if (blockedPermissions) {
            const updatedMissingPermissions =
                permissionData?.implicitlyDenied.length &&
                permissionData?.implicitlyDenied.map((obj: any) => modifyPermissions(obj, 'missing'));

            const updatedBlockedByOrganization =
                permissionData?.explicitlyDenied.length > 0 &&
                permissionData?.explicitlyDenied.map((obj: any) => modifyPermissions(obj, 'blocked'));

            let mergeData = [];
            if (updatedMissingPermissions.length && updatedBlockedByOrganization.length) {
                mergeData = updatedMissingPermissions.concat(updatedBlockedByOrganization);
            } else if (updatedBlockedByOrganization.length) {
                mergeData = updatedBlockedByOrganization;
            } else if (updatedMissingPermissions.length) {
                mergeData = updatedMissingPermissions;
            } else {
                mergeData = [];
            }

            setDataToDisplay(mergeData);
            setPermissionCount(mergeData.length);
        } else {
            const updatedMissingPermissions =
                permissionData?.implicitlyDenied?.length &&
                permissionData?.implicitlyDenied.map((obj: any) => modifyPermissions(obj, 'missing'));

            setDataToDisplay(updatedMissingPermissions);
            setPermissionCount(updatedMissingPermissions?.length);
        }
    }, [permissionData]);

    const setHeading = (type: string) => {
        if (type === 'operate') {
            return GENERAL.REQUIRED_OPERATE_PERMISSIONS;
        }
        return `${permissionCount} ${GENERAL.MISSING_AND_BLOCKED_PERMISSIONS}`;
    };

    const openDialog = (type: string) => {
        let permissionsData;

        const viewPackage = policiesList?.packages?.find?.(pkg => pkg?.name === POLICIES_PERMISSIONS.VIEW_POLICY);
        const viewPermissions = viewPackage?.permissions;
        const operatePackage = policiesList?.packages?.find?.(pkg => pkg?.name === POLICIES_PERMISSIONS.OPERATE_POLICY);
        const dbHostPackage = policiesList?.packages?.find?.(
            pkg => pkg?.name === POLICIES_PERMISSIONS.DATABASE_HOST_CREATION_POLICY
        );

        const mergedStatements = [
            ...(viewPermissions?.Statement ?? []),
            ...(operatePackage?.permissions?.Statement ?? []),
            ...(dbHostPackage?.permissions?.Statement ?? [])
        ];

        permissionsData = {
            Version:
                viewPermissions?.Version ??
                operatePackage?.permissions?.Version ??
                dbHostPackage?.permissions?.Version ??
                '2012-10-17',
            Statement: mergedStatements
        };
        const data = JSON.stringify(
            type === 'view'
                ? policiesList?.packages?.find?.(pkg => pkg?.name === POLICIES_PERMISSIONS.VIEW_POLICY)?.permissions
                : permissionsData,
            null,
            2
        );
        setDialog(
            <DialogComponent
                header={setHeading(type)}
                content={
                    type === 'operate' ? <ViewDialog data={data} /> : <MissingPermissionTable content={dataToDisplay} />
                }
                primaryButton={GENERAL.CLOSE}
                callback={() => {}}
                customClass={styles.setWidth}
            />
        );
    };

    return (
        <div className={styles.noteText}>
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
        </div>
    );
};

export default MissingPermissionsMsg;
