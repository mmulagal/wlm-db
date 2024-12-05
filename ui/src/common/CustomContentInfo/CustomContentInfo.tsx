import styles from './CustomContentInfo.module.scss';
import { Popover } from '@netapp/design-system';

import { ReactNode } from 'react';

const CustomContentInfo = ({
    tooltipText = '',
    CustomContent = null as ReactNode,
    customStyle = {},
    isToolTip = true
}) => {
    return isToolTip ? (
        <div style={customStyle}>
            <Popover
                popoverClass={styles['infoTooltip']}
                children={tooltipText}
                trigger="hover"
                container={<div>{CustomContent}</div>}
            />
        </div>
    ) : (
        CustomContent && CustomContent
    );
};

export default CustomContentInfo;
