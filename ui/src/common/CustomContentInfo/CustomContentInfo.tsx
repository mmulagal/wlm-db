import styles from './CustomContentInfo.module.scss';
import { Popover } from '@netapp/design-system';

const CustomContentInfo = ({ tooltipText = '', CustomContent = {}, customStyle = {}, isToolTip = true }) => {
    return (
        <>
            {isToolTip ? (
                <div style={customStyle}>
                    <Popover
                        popoverClass={styles['infoTooltip']}
                        children={tooltipText}
                        trigger="hover"
                        container={<>{CustomContent}</>}
                    />
                </div>
            ) : (
                CustomContent && CustomContent
            )}
        </>
    );
};

export default CustomContentInfo;
