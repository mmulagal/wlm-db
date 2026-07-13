import type { ComponentType } from 'react';
import { OsTypeFixModal } from '../lun/os-type/OsTypeFixModal';

export interface LunWadFixModalProps {
    recommendationName: string;
    close: () => void;
}

export const lunWadModals: Partial<Record<string, ComponentType<LunWadFixModalProps>>> = {
    'wlmdb-os-type': OsTypeFixModal
};
