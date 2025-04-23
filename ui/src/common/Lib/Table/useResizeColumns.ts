import React, { useLayoutEffect, useRef } from 'react';
import _throttle from 'lodash/throttle';
import { HashTable } from '../../../utils/utilityFunctions';

const createResizableColumn = function (
    col: any,
    resizer: any,
    id: string,
    setResizedState: React.Dispatch<React.SetStateAction<HashTable<string>>>
) {
    // Track the current position of mouse
    let x = 0;
    let w = 0;

    const mouseDownHandler = function (e: any) {
        // Get the current mouse position
        x = e.clientX;

        // Calculate the current width of column
        const styles = window.getComputedStyle(col);
        w = parseInt(styles.width, 10);

        // Attach listeners for document's events
        document.addEventListener('mousemove', mouseMoveHandler);
        document.addEventListener('mouseup', mouseUpHandler);
    };

    const mouseMoveHandler = _throttle(
        function (e: any) {
            // Determine how far the mouse has been moved
            const dx = e.clientX - x;

            // Update the width of column
            if (w + dx > 60 && w + dx < 1500) {
                setResizedState((prev: any) => ({
                    ...prev,
                    [id]: `${w + dx}px`
                }));
            }
        },
        200,
        { leading: true }
    );

    // When user releases the mouse, remove the existing event listeners
    const mouseUpHandler = function () {
        document.removeEventListener('mousemove', mouseMoveHandler);
        document.removeEventListener('mouseup', mouseUpHandler);
    };

    resizer.addEventListener('mousedown', mouseDownHandler);
};

const useResizeColumn = (id: string, setResizedState: React.Dispatch<React.SetStateAction<HashTable<string>>>) => {
    const columnRef = useRef<HTMLDivElement>(null);
    const resizeRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        if (columnRef.current && resizeRef.current) {
            createResizableColumn(columnRef.current, resizeRef.current, id, setResizedState);
        }
    }, [id, setResizedState]);

    return { columnRef, resizeRef };
};

export { useResizeColumn };
