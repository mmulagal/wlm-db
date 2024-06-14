import { useState } from 'react';
import './TooltipComponent.scss';
import usePortalBox from '../hooks/usePortalBox/usePortalBox';

/**
 * title
 * Tooltip title. Zero-length titles string, undefined, null and false are never displayed.
 *
 * placement
 * 'bottom-end'
 * | 'bottom-start'
 * | 'bottom'
 * | 'left-end'
 * | 'left-start'
 * | 'left'
 * | 'right-end'
 * | 'right-start'
 * | 'right'
 * | 'top-end'
 * | 'top-start'
 * | 'top'
 *
 */

export default function TooltipComponent(props) {
    const { title, placement = 'bottom', padding = 8, width, height, arrow = false, children } = props;

    const [isHover, setIsHover] = useState(false);
    const [parentRect, setParentRect] = useState(null);
    const isTitleEmpty = !title || title?.length === 0;
    const isPopup = !isTitleEmpty && isHover;
    const { Portal } = usePortalBox({
        title: title,
        padding: padding,
        isPopup: isPopup,
        parentRect: parentRect,
        placement: placement,
        width: width,
        height: height
    });

    const handleMouseOver = e => {
        const parentRect = e.target.getBoundingClientRect();
        setParentRect(parentRect);
        setIsHover(true);
    };

    const handleMouseOut = e => {
        setIsHover(false);
    };

    return (
        <>
            <div className={'select-none'} onMouseEnter={handleMouseOver} onMouseLeave={handleMouseOut}>
                {children}
            </div>
            {Portal}
        </>
    );
}
