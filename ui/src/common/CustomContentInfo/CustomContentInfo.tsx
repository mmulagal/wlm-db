import styles from './CustomContentInfo.module.scss';
import { TooltipInfo } from '@netapp/design-system';

const CustomContentInfo = ({
  tooltipText = '',
  CustomContent = {},
  customStyle = {},
  isToolTip = true,
}) => {
  return (
    <>
    <TooltipInfo className={styles.infoTooltip}>
            {tooltipText}
          </TooltipInfo>
      {/* {isToolTip ? (
        <div style={customStyle}>
          <TooltipInfo className={styles.infoTooltip}>
            {tooltipText}
          </TooltipInfo>
        </div>
      ) : (
        CustomContent && CustomContent
      )} */}
    </>
  );
};

export default CustomContentInfo;
