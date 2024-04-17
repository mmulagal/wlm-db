import { setIsDbNameAdded } from '../../../../store/workloadFactory/createSandboxSlice';
import { setCreateSandboxPressed, setIsMountPathAdded } from '../../../../store/workloadFactory/createSandboxSlice';

export const handleCreateNewSandbox = (state: any, dispatch: any) => {
    let payload;
    dispatch(setCreateSandboxPressed(true));

    //Fields validation checks
    const selectTargetDBName = !state.sandbox.selectedTargetDatabase;
    const mountPathCheck = state.sandbox.selectedMount === 'Define mount point path' && !state.sandbox.mountPath;

    if (selectTargetDBName) {
        dispatch(setIsDbNameAdded(false));
    } else {
        dispatch(setIsDbNameAdded(true));
    }

    if (state.sandbox.selectedMount === 'Define mount point path' && mountPathCheck) {
        dispatch(setIsMountPathAdded(false));
    } else {
        dispatch(setIsMountPathAdded(true));
    }

    if (!selectTargetDBName && !mountPathCheck) {
        console.log('create');
        return true;
    } else {
        console.log('error');
        return false;
    }
};
