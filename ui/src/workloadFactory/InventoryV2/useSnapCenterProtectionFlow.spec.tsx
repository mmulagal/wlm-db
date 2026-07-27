import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSnapCenterProtectionFlow } from './useSnapCenterProtectionFlow';

const mockHandleProtectionUtil = vi.fn();
const mockBxpRedirect = vi.fn();
const mockSetDialog = vi.fn();
const mockCloseDialog = vi.fn();
const mockGetState = vi.fn();
const mockDispatch = vi.fn();
const mockRegisterResourceCredBulk = vi.fn();

vi.mock('react-redux', () => ({
    useDispatch: () => mockDispatch
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key })
}));

vi.mock('../../store/storeHooks', () => ({
    useAppSelector: (selector: (state: unknown) => unknown) =>
        selector({
            auth: { isDemoMode: false, isWorkloadFactory: true }
        })
}));

vi.mock('../../store/store', () => ({
    default: {
        getState: (...args: unknown[]) => mockGetState(...args)
    }
}));

vi.mock('../../utils/apiService', () => {
    const mutation = () => [vi.fn()];
    return {
        useGetConnectorsMutation: mutation,
        useGetFsxDetailsMutation: mutation,
        useDiscoverExistingFsxNMutation: mutation,
        useGetWorkSpaceIDMutation: mutation,
        useGetRBACPrivilegesMutation: mutation,
        useGetBackupRecoveryLicenseMutation: mutation,
        useAssignBackupRecoveryLicenseMutation: mutation,
        useListExistingHostsMutation: mutation,
        useAssignRBACPrivilegesMutation: mutation,
        useGenerateCredentialIDMutation: mutation,
        useAddHostScMutation: mutation,
        useAddHostJobScMutation: mutation,
        useDeleteHostScMutation: mutation,
        useConfigureDirectoryMutation: mutation,
        useListAllDirectoriesMutation: mutation,
        useGetDiscoverHostResultMutation: mutation,
        useGetDiscoverInstanceResultMutation: mutation,
        useGetSCCrendentialsMutation: mutation,
        useRegisterResourceCredentialsBulkMutation: () => [mockRegisterResourceCredBulk],
        useGetOrganizationIdsMutation: mutation
    };
});

vi.mock('./AddHostUtils', () => ({
    handleProtectionUtil: (...args: unknown[]) => mockHandleProtectionUtil(...args)
}));

vi.mock('../../utils/utilityFunctions', () => ({
    bxpRedirect: (...args: unknown[]) => mockBxpRedirect(...args)
}));

vi.mock('../../common/Dialog/DialogComponent', () => ({
    default: () => null
}));

vi.mock('./InventoryTablesComponent/ProtectionDialogs/NoAgentDialog', () => ({
    default: () => null
}));

vi.mock('./InventoryTablesComponent/ProtectionDialogs/SingleAgentDialog', () => ({
    default: () => null
}));

vi.mock('./InventoryTablesComponent/ProtectionDialogs/FetchingDIalog', () => ({
    default: () => null
}));

vi.mock('./InventoryTablesComponent/ProtectionDialogs/WindowsAuthDialog', () => ({
    default: () => null
}));

vi.mock('../../store/workloadFactory/snapcenterSlice', () => ({
    cancelProtectionForRow: vi.fn(),
    setAuthVerification: vi.fn(),
    setDataForRow: vi.fn()
}));

vi.mock('../../store/notificationSlice', () => ({
    NOTIFICATION_TYPES: { ERROR: 'ERROR' },
    addNotification: (payload: unknown) => ({ type: 'addNotification', payload })
}));

describe('useSnapCenterProtectionFlow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetState.mockReturnValue({
            auth: { isGovAccount: false },
            snapCenter: { protectionProcessState: {}, credentials: { username: 'u', password: 'p' } }
        });
        mockRegisterResourceCredBulk.mockResolvedValue({ error: { data: { message: 'API failed' } } });
    });

    it('startProtection delegates to handleProtectionUtil with dialog callbacks', async () => {
        const { result } = renderHook(() => useSnapCenterProtectionFlow(mockSetDialog, mockCloseDialog));
        const rowData = { databaseInstanceName: 'MSSQLSERVER', name: 'host1' };

        await act(async () => {
            await result.current.startProtection(rowData);
        });

        expect(mockHandleProtectionUtil).toHaveBeenCalledWith(
            rowData,
            expect.objectContaining({
                fetchDialog: expect.any(Function),
                showSingleAgentDialog: expect.any(Function),
                showNoAgentDialog: expect.any(Function),
                scAuthDialog: expect.any(Function),
                closeDialog: mockCloseDialog
            })
        );
    });

    it('fetchDialog opens loading dialog via setDialog', async () => {
        const { result } = renderHook(() => useSnapCenterProtectionFlow(mockSetDialog, mockCloseDialog));
        const rowData = { databaseInstanceName: 'MSSQLSERVER', name: 'host1' };

        await act(async () => {
            await result.current.startProtection(rowData);
        });

        const { fetchDialog } = mockHandleProtectionUtil.mock.calls[0][1];
        act(() => {
            fetchDialog('dialog-key');
        });

        expect(mockSetDialog).toHaveBeenCalled();
    });

    it('startEditProtection redirects instance protect flow when not gov account', () => {
        const { result } = renderHook(() => useSnapCenterProtectionFlow(mockSetDialog, mockCloseDialog));
        const rowData = { databaseInstanceName: 'MSSQLSERVER', name: 'host1' };

        act(() => {
            result.current.startEditProtection(rowData);
        });

        expect(mockBxpRedirect).toHaveBeenCalledWith(
            true,
            { ...rowData, editProtection: true },
            'instance',
            expect.any(Function)
        );
    });

    it('startEditProtection redirects database protect flow when dialogType is database', () => {
        const { result } = renderHook(() =>
            useSnapCenterProtectionFlow(mockSetDialog, mockCloseDialog, { dialogType: 'database' })
        );
        const rowData = { databaseInstanceName: 'MSSQLSERVER', name: 'host1' };

        act(() => {
            result.current.startEditProtection(rowData);
        });

        expect(mockBxpRedirect).toHaveBeenCalledWith(
            true,
            { ...rowData, editProtection: true },
            'database',
            undefined,
            expect.any(Function)
        );
    });

    it('startEditProtection no-ops for gov cloud accounts', () => {
        mockGetState.mockReturnValue({
            auth: { isGovAccount: true },
            snapCenter: { protectionProcessState: {} }
        });

        const { result } = renderHook(() => useSnapCenterProtectionFlow(mockSetDialog, mockCloseDialog));
        const rowData = { databaseInstanceName: 'MSSQLSERVER', name: 'host1' };

        act(() => {
            result.current.startEditProtection(rowData);
        });

        expect(mockBxpRedirect).not.toHaveBeenCalled();
    });

    it('scAuthDialog shows error notification when registerResourceCredBulk fails', async () => {
        const { result } = renderHook(() => useSnapCenterProtectionFlow(mockSetDialog, mockCloseDialog));
        const rowData = {
            databaseInstanceName: 'MSSQLSERVER',
            name: 'host1',
            credentialId: 'cred-1',
            regionId: 'us-east-1',
            ec2InstanceId: 'i-1'
        };

        await act(async () => {
            await result.current.startProtection(rowData);
        });

        const { scAuthDialog } = mockHandleProtectionUtil.mock.calls[0][1];
        await act(async () => {
            scAuthDialog('dialog-key', 'openSingleAgent', [], false, rowData);
        });

        let dialogCallback: (() => Promise<void>) | undefined;
        await act(async () => {
            dialogCallback = mockSetDialog.mock.calls.at(-1)?.[0]?.props?.callback;
        });
        expect(dialogCallback).toBeTypeOf('function');

        await act(async () => {
            await dialogCallback!();
        });

        expect(mockRegisterResourceCredBulk).toHaveBeenCalled();
        expect(mockDispatch).toHaveBeenCalledWith(
            expect.objectContaining({
                payload: expect.objectContaining({
                    notificationType: 'ERROR',
                    message: 'API failed'
                })
            })
        );
    });
});
