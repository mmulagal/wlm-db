import React, { useRef, useEffect } from 'react';
import Popover from 'react-popover';
import styles from './CustomPopover.module.scss';

function CustomPopover({
    isPopoverOpen,
    togglePopover,
    CustomPopoverBody,
    CustomPopoverTrigger,
    customTriggerStyle,
    disableTransition,
    fromSearchBox
}) {
    const refMenuContent = useRef();
    const refParent = useRef();

    const handleClick = e => {
        if (
            isPopoverOpen &&
            refMenuContent.current &&
            refParent &&
            !refMenuContent.current.contains(e.target) &&
            !refParent.current.contains(e.target)
        ) {
            togglePopover && togglePopover('close');
        }
    };

    useEffect(() => {
        document.addEventListener('click', handleClick);

        return () => {
            document.removeEventListener('click', handleClick);
        };
    });

    return (
        <>
            <Popover
                isOpen={isPopoverOpen}
                body={
                    <div className={styles['custom-popover-container']}>
                        <div className={styles['react-popover info-tooltip']}>
                            <div ref={refMenuContent} className={styles['content']}>
                                {CustomPopoverBody && CustomPopoverBody}
                            </div>
                        </div>
                    </div>
                }
                preferPlace={fromSearchBox ? 'end' : 'right'}
                place={fromSearchBox ? 'left' : ''}
                enterExitTransitionDurationMs={disableTransition ? 0 : 500}
            >
                <div style={customTriggerStyle && customTriggerStyle} ref={refParent}>
                    {CustomPopoverTrigger && CustomPopoverTrigger}
                </div>
            </Popover>
        </>
    );
}

export default CustomPopover;
