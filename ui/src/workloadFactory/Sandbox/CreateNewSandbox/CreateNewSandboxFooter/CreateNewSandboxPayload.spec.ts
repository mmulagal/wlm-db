import { vi, describe, it, expect, beforeEach } from 'vitest';
import { handleCreateNewSandbox } from './CreateNewSandboxPayload';

const mockDispatch = vi.fn();
const mockSetCreateSandboxPressed = vi.fn((val: boolean) => ({
    type: 'createSandbox/setCreateSandboxPressed',
    payload: val
}));
const mockSetIsSourceSelected = vi.fn((val: boolean) => ({ type: 'createSandbox/setIsSourceSelected', payload: val }));
const mockSetIsTargetSelected = vi.fn((val: boolean) => ({ type: 'createSandbox/setIsTargetSelected', payload: val }));
const mockSetIsMountPathAdded = vi.fn((val: boolean) => ({ type: 'createSandbox/setIsMountPathAdded', payload: val }));
const mockGenerateCreateSandboxPayload = vi.fn();

vi.mock('../../../../store/workloadFactory/createSandboxSlice', () => ({
    setCreateSandboxPressed: (val: boolean) => mockSetCreateSandboxPressed(val),
    setIsSourceSelected: (val: boolean) => mockSetIsSourceSelected(val),
    setIsTargetSelected: (val: boolean) => mockSetIsTargetSelected(val),
    setIsMountPathAdded: (val: boolean) => mockSetIsMountPathAdded(val)
}));

vi.mock('../../SandboxUtility', () => ({
    generateCreateSandboxPayload: (state: any) => mockGenerateCreateSandboxPayload(state),
    isValidSandboxName: vi.fn((name: any) => {
        if (!name || name.length === 0) return true;
        if (name.length > 27 || !/^[a-zA-Z0-9/_]+$/.test(name)) return false;
        return true;
    })
}));

const buildState = (overrides: any = {}) => ({
    createSandbox: {
        source: {
            selectedDatabaseHost: { value: 'host1', label: 'Host 1' },
            selectedDatabaseInstance: { value: 'inst1', label: 'Instance 1' },
            selectedDatabase: { value: 'db1', label: 'Database 1' }
        },
        target: {
            selectedDatabaseHost: { value: 'targetHost1', label: 'Target Host 1' },
            selectedDatabaseInstance: { value: 'targetInst1', label: 'Target Inst 1' },
            selectedDatabase: 'sandbox_db'
        }
    },
    sandbox: {
        selectedMount: 'Auto-assign mount point',
        mountPath: ''
    },
    ...overrides
});

describe('handleCreateNewSandbox', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGenerateCreateSandboxPayload.mockReturnValue({ sandboxName: 'sandbox_db', action: 'CREATE' });
    });

    it('should dispatch setCreateSandboxPressed(true) always', () => {
        const state = buildState();
        handleCreateNewSandbox(state, mockDispatch);
        expect(mockDispatch).toHaveBeenCalledWith(
            expect.objectContaining({ type: expect.stringContaining('setCreateSandboxPressed') })
        );
    });

    it('should return payload when all source, target are valid', () => {
        const state = buildState();
        const result = handleCreateNewSandbox(state, mockDispatch);
        expect(result).toBeTruthy();
        expect(mockGenerateCreateSandboxPayload).toHaveBeenCalledWith(state.createSandbox);
    });

    it('should dispatch setIsSourceSelected(true) when source is complete', () => {
        const state = buildState();
        handleCreateNewSandbox(state, mockDispatch);
        expect(mockDispatch).toHaveBeenCalledWith(
            expect.objectContaining({ type: expect.stringContaining('setIsSourceSelected'), payload: true })
        );
    });

    it('should dispatch setIsSourceSelected(false) and return false when source is incomplete', () => {
        const state = buildState({
            createSandbox: {
                source: {
                    selectedDatabaseHost: null,
                    selectedDatabaseInstance: null,
                    selectedDatabase: null
                },
                target: {
                    selectedDatabaseHost: { value: 'targetHost1', label: 'Target Host 1' },
                    selectedDatabaseInstance: { value: 'targetInst1', label: 'Target Inst 1' },
                    selectedDatabase: 'sandbox_db'
                }
            },
            sandbox: { selectedMount: 'Auto-assign mount point', mountPath: '' }
        });

        const result = handleCreateNewSandbox(state, mockDispatch);

        expect(result).toBe(false);
        expect(mockDispatch).toHaveBeenCalledWith(
            expect.objectContaining({ type: expect.stringContaining('setIsSourceSelected'), payload: false })
        );
    });

    it('should return false when source database is missing', () => {
        const state = buildState({
            createSandbox: {
                source: {
                    selectedDatabaseHost: { value: 'host1', label: 'Host 1' },
                    selectedDatabaseInstance: { value: 'inst1', label: 'Instance 1' },
                    selectedDatabase: null
                },
                target: {
                    selectedDatabaseHost: { value: 'targetHost1' },
                    selectedDatabaseInstance: { value: 'targetInst1' },
                    selectedDatabase: 'sandbox_db'
                }
            },
            sandbox: { selectedMount: 'Auto-assign mount point', mountPath: '' }
        });

        const result = handleCreateNewSandbox(state, mockDispatch);
        expect(result).toBe(false);
    });

    it('should dispatch setIsTargetSelected(true) when target is complete and valid', () => {
        const state = buildState();
        handleCreateNewSandbox(state, mockDispatch);
        expect(mockDispatch).toHaveBeenCalledWith(
            expect.objectContaining({ type: expect.stringContaining('setIsTargetSelected'), payload: true })
        );
    });

    it('should dispatch setIsTargetSelected(false) and return false when target is incomplete', () => {
        const state = buildState({
            createSandbox: {
                source: {
                    selectedDatabaseHost: { value: 'host1', label: 'Host 1' },
                    selectedDatabaseInstance: { value: 'inst1', label: 'Instance 1' },
                    selectedDatabase: { value: 'db1', label: 'Database 1' }
                },
                target: {
                    selectedDatabaseHost: null,
                    selectedDatabaseInstance: null,
                    selectedDatabase: null
                }
            },
            sandbox: { selectedMount: 'Auto-assign mount point', mountPath: '' }
        });

        const result = handleCreateNewSandbox(state, mockDispatch);
        expect(result).toBe(false);
        expect(mockDispatch).toHaveBeenCalledWith(
            expect.objectContaining({ type: expect.stringContaining('setIsTargetSelected'), payload: false })
        );
    });

    it('should return false when target database name is invalid (too long)', () => {
        const state = buildState({
            createSandbox: {
                source: {
                    selectedDatabaseHost: { value: 'host1', label: 'Host 1' },
                    selectedDatabaseInstance: { value: 'inst1', label: 'Instance 1' },
                    selectedDatabase: { value: 'db1', label: 'Database 1' }
                },
                target: {
                    selectedDatabaseHost: { value: 'targetHost1' },
                    selectedDatabaseInstance: { value: 'targetInst1' },
                    selectedDatabase: 'this_is_a_very_long_sandbox_name_that_exceeds_limit'
                }
            },
            sandbox: { selectedMount: 'Auto-assign mount point', mountPath: '' }
        });

        const result = handleCreateNewSandbox(state, mockDispatch);
        expect(result).toBe(false);
    });

    it('should dispatch setIsMountPathAdded(true) when mount is auto-assign', () => {
        const state = buildState();
        handleCreateNewSandbox(state, mockDispatch);
        expect(mockDispatch).toHaveBeenCalledWith(
            expect.objectContaining({ type: expect.stringContaining('setIsMountPathAdded'), payload: true })
        );
    });

    it('should dispatch setIsMountPathAdded(false) when mount is define and mountPath is empty', () => {
        const state = buildState({
            createSandbox: {
                source: {
                    selectedDatabaseHost: { value: 'host1', label: 'Host 1' },
                    selectedDatabaseInstance: { value: 'inst1', label: 'Instance 1' },
                    selectedDatabase: { value: 'db1', label: 'Database 1' }
                },
                target: {
                    selectedDatabaseHost: { value: 'targetHost1' },
                    selectedDatabaseInstance: { value: 'targetInst1' },
                    selectedDatabase: 'sandbox_db'
                }
            },
            sandbox: {
                selectedMount: 'Define mount point path',
                mountPath: ''
            }
        });

        handleCreateNewSandbox(state, mockDispatch);
        expect(mockDispatch).toHaveBeenCalledWith(
            expect.objectContaining({ type: expect.stringContaining('setIsMountPathAdded'), payload: false })
        );
    });

    it('should dispatch setIsMountPathAdded(true) when mount is define and mountPath is provided', () => {
        const state = buildState({
            createSandbox: {
                source: {
                    selectedDatabaseHost: { value: 'host1', label: 'Host 1' },
                    selectedDatabaseInstance: { value: 'inst1', label: 'Instance 1' },
                    selectedDatabase: { value: 'db1', label: 'Database 1' }
                },
                target: {
                    selectedDatabaseHost: { value: 'targetHost1' },
                    selectedDatabaseInstance: { value: 'targetInst1' },
                    selectedDatabase: 'sandbox_db'
                }
            },
            sandbox: {
                selectedMount: 'Define mount point path',
                mountPath: 'C:\\Data'
            }
        });

        handleCreateNewSandbox(state, mockDispatch);
        expect(mockDispatch).toHaveBeenCalledWith(
            expect.objectContaining({ type: expect.stringContaining('setIsMountPathAdded'), payload: true })
        );
    });

    it('should call generateCreateSandboxPayload with createSandbox state', () => {
        const state = buildState();
        handleCreateNewSandbox(state, mockDispatch);
        expect(mockGenerateCreateSandboxPayload).toHaveBeenCalledWith(state.createSandbox);
    });

    it('should return the generated payload', () => {
        const expectedPayload = { sandboxName: 'sandbox_db', source: 'source', destination: 'dest' };
        mockGenerateCreateSandboxPayload.mockReturnValueOnce(expectedPayload);

        const state = buildState();
        const result = handleCreateNewSandbox(state, mockDispatch);

        expect(result).toEqual(expectedPayload);
    });
});
