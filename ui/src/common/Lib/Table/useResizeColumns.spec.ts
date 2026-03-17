import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useResizeColumn } from './useResizeColumns';

vi.mock('lodash/throttle', () => ({
    default: (fn: any) => fn
}));

vi.mock('../../../utils/utilityFunctions', () => ({
    HashTable: {}
}));

describe('useResizeColumn', () => {
    it('should be defined', () => {
        expect(useResizeColumn).toBeDefined();
    });

    it('should return columnRef and resizeRef', () => {
        const setResizedState = vi.fn();
        const { result } = renderHook(() => useResizeColumn('col1', setResizedState));

        expect(result.current).toHaveProperty('columnRef');
        expect(result.current).toHaveProperty('resizeRef');
    });

    it('should return refs with current initially null', () => {
        const setResizedState = vi.fn();
        const { result } = renderHook(() => useResizeColumn('col1', setResizedState));

        expect(result.current.columnRef.current).toBeNull();
        expect(result.current.resizeRef.current).toBeNull();
    });

    it('should work with different column IDs', () => {
        const setResizedState = vi.fn();
        const { result } = renderHook(() => useResizeColumn('columnWithLongId', setResizedState));

        expect(result.current.columnRef).toBeTruthy();
        expect(result.current.resizeRef).toBeTruthy();
    });
});
