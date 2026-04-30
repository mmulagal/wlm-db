import type { ReactNode } from 'react';
import { DsFlashingDotsLoader } from '@netapp/design-system';
import styles from './TableLazyLoading.module.scss';

export function getTableLazyLoadingComponentProps(loadingText: ReactNode) {
    return {
        ExpandedRow: null,
        lazyLoadingText: (
            <span className={styles.lazyLoadingInline}>
                {loadingText}
                <DsFlashingDotsLoader />
            </span>
        )
    };
}
