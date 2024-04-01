import {
    setCreateSandboxPressed,
    setIsDBNameAdded,
    setIsMountPathAdded
} from '../../../../store/workloadFactory/sandboxSlice';

export const handleCreateNewSandbox = (state: any, dispatch: any) => {
    let payload;
    dispatch(setCreateSandboxPressed(true));

    //Fields validation checks
    const selectTargetDBName = !state.sandbox.selectedTargetDatabase;
    const mountPathCheck = state.sandbox.selectedMount === 'Define mount point path' && !state.sandbox.mountPath;

    if (selectTargetDBName) {
        dispatch(setIsDBNameAdded(false));
    } else {
        dispatch(setIsDBNameAdded(true));
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
