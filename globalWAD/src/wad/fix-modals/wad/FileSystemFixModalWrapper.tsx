import type { WadElementProps } from '@tlveng/workload-factory-components';
import { PlaceholderFixModal, UnsupportedConfigurationNotice } from '../../shared/fixModalShared';
import { AutomaticCapacityManagementFixModal } from '../file-system/automatic-capacity-management/AutomaticCapacityManagementFixModal';

const UPDATE_AUTOMATIC_CAPACITY_MANAGEMENT = 'update-automatic-capacity-management';

const placeholderConfigurationIds = new Set<string>([
    'update-ssd-capacity',
    'fsx:flex-volume-rebalance',
    'schedule-volume-backups',
    'decrease-ssd-capacity'
]);

export const FileSystemFixModalWrapper = ({ wadApi }: WadElementProps) => {
    const { configurationId } = wadApi.context;

    if (configurationId === UPDATE_AUTOMATIC_CAPACITY_MANAGEMENT) {
        const parentResource = wadApi.fixModalPayload.resources[0]?.parentResource;
        const credentialId = parentResource?.credentialsIds?.[0];
        const region = parentResource?.region;
        const fsxId = parentResource?.id;
        if (!credentialId || !region || !fsxId) {
            return <UnsupportedConfigurationNotice configurationId={configurationId} />;
        }
        return (
            <AutomaticCapacityManagementFixModal
                recommendationName={wadApi.context.configurationName}
                navigate={wadApi.navigate}
                close={wadApi.closeFixModal}
                credentialId={credentialId}
                region={region}
                fsxId={fsxId}
            />
        );
    }

    if (placeholderConfigurationIds.has(configurationId)) {
        return <PlaceholderFixModal onClose={wadApi.closeFixModal} />;
    }

    return <UnsupportedConfigurationNotice configurationId={configurationId} />;
};
