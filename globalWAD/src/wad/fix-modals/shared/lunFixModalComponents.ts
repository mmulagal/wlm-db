import type { ComponentType } from 'react';
import { OsTypeFixModal } from '../lun/os-type/OsTypeFixModal';

export interface LunFixModalProps {
    recommendationName: string;
    close: () => void;
}

export const lunFixModalComponents: Partial<Record<string, ComponentType<LunFixModalProps>>> = {
    'wlmdb-os-type': OsTypeFixModal
};
