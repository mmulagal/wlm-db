import React from 'react';
import classNames from 'classnames';

import { ReactComponent as ChevronIcon } from '@netapp/icons/ic_card_arrow_expand.svg';
import { Button } from '@netapp/design-system';
import { ButtonProps } from '@netapp/design-system/dist/components/Button';
import styles from './TransitionChevron.module.scss';

export interface TransitionChevronProps
    extends Omit<ButtonProps<'button'>, 'variant' | 'isThin' | 'icon' | 'children'> {
    /** Is the chevron expanded? (will flip the chevron) */
    isExpanded: boolean;
}

export const TransitionChevron = React.memo(
    ({ isExpanded, isHovered, className = '', ...rest }: TransitionChevronProps) => (
        <Button
            className={classNames(styles.base, className, {
                [styles['is-hovered']]: isHovered
            })}
            variant="icon"
            {...rest}
        >
            <ChevronIcon
                className={classNames({
                    [styles['is-expanded']]: isExpanded
                })}
            />
        </Button>
    )
);
