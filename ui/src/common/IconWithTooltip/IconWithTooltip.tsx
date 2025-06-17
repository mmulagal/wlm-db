import styles from './IconWithTooltip.module.scss';
import { Popover } from '@netapp/design-system';
import { FC, SVGProps } from 'react';

type IconWithTooltipProps = {
    Icon: FC<SVGProps<SVGSVGElement>>;
    tooltipValue: boolean | number;
    tooltipLabel: string;
};

const IconWithTooltip: FC<IconWithTooltipProps> = ({ Icon, tooltipValue, tooltipLabel, ...iconProps }) => (
    <Popover
        children={<ProtectionTooltipItem label={tooltipLabel} value={tooltipValue} />}
        trigger="hover"
        container={<Icon {...iconProps} fill={tooltipValue === true ? 'var(--blue-70)' : 'var(--grey-45)'} />}
    />
);

const ProtectionTooltipItem = ({ label, value }: { label: string; value: boolean | number }) => (
    <div>
        <div style={{ fontWeight: 500 }}>{label}</div>
        <div className={styles.protectionStatus}>
            <span
                style={{
                    background: value === true ? 'var(--green-60)' : 'var(--grey-45)',
                    width: 10,
                    height: 10,
                    display: 'inline-block',
                    borderRadius: 2,
                    marginRight: 8
                }}
            />
            <span>{value === true ? 'Protected' : 'Not Protected'}</span>
        </div>
    </div>
);

export default IconWithTooltip;
