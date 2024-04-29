import {
    setCreateSandboxPressed,
    setIsMountPathAdded,
    setIsSourceSelected,
    setIsTargetSelected
} from '../../../../store/workloadFactory/createSandboxSlice';
import { generateCreateSandboxPayload } from '../../SandboxUtility';

export const handleCreateNewSandbox = (state: any, dispatch: any) => {
    let payload;
    dispatch(setCreateSandboxPressed(true));

    const {
        selectedDatabaseHost: sourceDatabaseHost,
        selectedDatabaseInstance: sourceInstance,
        selectedDatabase: sourceDatabase
    } = state.createSandbox.source;
    const {
        selectedDatabaseHost: targetDatabaseHost,
        selectedDatabaseInstance: targetInstance,
        selectedDatabase: targetDatabase
    } = state.createSandbox.target;
    const mountPathCheck = state.sandbox.selectedMount === 'Define mount point path' && !state.sandbox.mountPath;

    if (sourceDatabase && sourceInstance && sourceDatabaseHost) {
        dispatch(setIsSourceSelected(true));
    } else {
        dispatch(setIsSourceSelected(false));
        return false;
    }

    if (targetDatabase && targetInstance && targetDatabaseHost) {
        dispatch(setIsTargetSelected(true));
    } else {
        dispatch(setIsTargetSelected(false));
        return false;
    }

    if (state.sandbox.selectedMount === 'Define mount point path' && mountPathCheck) {
        dispatch(setIsMountPathAdded(false));
    } else {
        dispatch(setIsMountPathAdded(true));
    }

    payload = generateCreateSandboxPayload(state?.createSandbox);
    return payload;
};
