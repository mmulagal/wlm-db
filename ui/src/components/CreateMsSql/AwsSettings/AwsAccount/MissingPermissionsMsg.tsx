import { Button, Typography, useDialog } from '@netapp/design-system';
import { useAppSelector } from '../../../../store/storeHooks';
import DialogComponent from '../../../../common/Dialog/DialogComponent';
import { GENERAL } from '../../../../utils/appConstants';
import ViewDialog from '../../../../common/ViewDialog/ViewDialog';
import CommonStyles from '../../../../utils/CommonStyles.module.scss';
import styles from './AwsAccount.module.scss';

const MissingPermissionsMsg = () => {
    const { setDialog } = useDialog();
    const deployRedirectToCfLink = useAppSelector(state => state.msSqlAction.deployRedirectToCfLink);
    const isDemoMode = useAppSelector(state => state.auth.isDemoMode);
    const { policiesList } = useAppSelector(state => state.mssql.getPolicies);

    const openDialog = (type: string) => {
        const data = JSON.stringify(type === 'view' ? policiesList?.view : policiesList?.operate, null, 2);
        setDialog(
            <DialogComponent
                header={type === 'view' ? GENERAL.REQUIRED_VIEW_PERMISSIONS : GENERAL.REQUIRED_OPERATE_PERMISSIONS}
                content={<ViewDialog data={data} />}
                primaryButton={GENERAL.CLOSE}
                callback={() => {}}
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
            {GENERAL.CREATE_PERMISSION_ERROR[0]}
            {deployRedirectToCfLink || isDemoMode ? (
                <Button
                    Component="button"
                    variant="link"
                    className={CommonStyles.buttonClass}
                    onClick={() => redirectToCf()}
                >
                    {GENERAL.CREATE_PERMISSION_ERROR[1]}
                </Button>
            ) : (
                GENERAL.CREATE_PERMISSION_ERROR[1]
            )}
            {GENERAL.CREATE_PERMISSION_ERROR[2]}
            <Button Component="button" variant="text" onClick={() => openDialog('operate')}>
                {GENERAL.REQUIRED_PERMISSIONS}
            </Button>
        </div>
    );
};

export default MissingPermissionsMsg;
