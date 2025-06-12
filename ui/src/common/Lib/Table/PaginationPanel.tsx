import React from 'react';
import { ReactComponent as ArrowIcon } from '@netapp/icons/ic_link_arrow_expand.svg';
import classNames from 'classnames';
import { Typography } from '@netapp/design-system';
import styles from './PaginationPanel.module.scss';
import { ButtonBase } from '../ButtonBase/ButtonBase';

import { PaginationStateType } from './Table';

export interface PaginationPanelProps {
    pagination: PaginationStateType;
    pageSize: number;
    totalRows: number;
}

export const PaginationPanel = ({
    pagination: { gotoPage, pageCount, pageIndex, pageRows },
    pageSize,
    totalRows
}: PaginationPanelProps) => {
    const first = pageIndex * pageSize + 1;
    const last = first + pageRows.length - 1;

    const handlePrev = () => gotoPage(pageIndex - 1);
    const handleNext = () => gotoPage(pageIndex + 1);

    const isFirstPage = pageIndex === 0;
    const isLastPage = pageIndex === pageCount - 1;

    return (
        <div className={styles['pagination-panel']}>
            <Typography variant="Semibold_14" className={styles['pagination-title']}>{`${
                first === last
                    ? first
                    : `${first?.toLocaleString('en', { useGrouping: true })} - ${last?.toLocaleString('en', {
                          useGrouping: true
                      })}`
            } of ${totalRows?.toLocaleString('en', { useGrouping: true })}`}</Typography>
            <ButtonBase
                onClick={handlePrev}
                disabled={isFirstPage}
                className={classNames(styles['pagination-button'], styles.prev)}
            >
                <ArrowIcon />
            </ButtonBase>
            <Typography variant="Semibold_14" className={styles['current-page']}>
                {(pageIndex + 1)?.toLocaleString('en', { useGrouping: true })}
            </Typography>
            <ButtonBase
                type="button"
                onClick={handleNext}
                disabled={isLastPage}
                className={classNames(styles['pagination-button'], styles.next)}
            >
                <ArrowIcon />
            </ButtonBase>
        </div>
    );
};
