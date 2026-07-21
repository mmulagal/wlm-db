import type { ComponentType } from 'react';
import { FileSystemHeadroomFixModal } from '../filesystem/headroom/FileSystemHeadroomFixModal';
import type { FileSystemFixModalProps } from '../shared/WadFixModalProps';

export const fileSystemWadModals: Partial<Record<string, ComponentType<FileSystemFixModalProps>>> = {
    'wlmdb-headroom': FileSystemHeadroomFixModal
};

export type { FileSystemFixModalProps as FileSystemWadFixModalProps } from '../shared/WadFixModalProps';
