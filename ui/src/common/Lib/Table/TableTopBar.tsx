import React, { ReactNode, useState } from 'react';
import classNames from 'classnames';
import { Parser } from '@json2csv/plainjs';
import { ReactComponent as ExportIcon } from '@netapp/icons/ic_download.svg';
import _pick from 'lodash/pick';
import _mapKeys from 'lodash/mapKeys';
import _map from 'lodash/map';
import { Button, DsFlashingDotsLoader, SearchInput, TooltipInfo, Typography } from '@netapp/design-system';
import { TableProps } from './Table';
import styles from './TableTopBar.module.scss';
import { HashTable } from '../../../utils/utilityFunctions';

interface ExportToCsvProps {
    /* Exported file name */
    fileName: string;
    /* export to csv options: https://juanjodiaz.github.io/json2csv/#/parsers/parser?id=options */
    options?: any;
}

export const exportToCsv = ({ fileName, options = {} }: ExportToCsvProps, tableProps: TableProps) => {
    const { organizedRows, columns } = tableProps;

    const selectedColumns = columns.map(column => column.csvAccessor || column.accessor).filter(accessor => accessor);

    const keysMapping = columns.reduce<HashTable<string>>((acc, val) => {
        if (typeof val.Header === 'string' && val.accessor) {
            acc[val.accessor] = val.Header;
        }
        return acc;
    }, {});

    const data = organizedRows.map(row => _pick(row, selectedColumns));
    const dataWithTableHeaders = _map(data, rows => _mapKeys(rows, (value, key) => keysMapping[key] || key));

    const parser = new Parser(options);
    const parsedData = parser.parse(dataWithTableHeaders);
    const element = document.createElement('a');
    element.setAttribute('href', `data:text/plain;charset=utf-8,${encodeURIComponent(parsedData)}`);
    element.setAttribute('download', fileName);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
};

export interface TableTopBarProps {
    /** The props of the table (returned from useTable hook) */
    tableProps: TableProps;
    /** A title to be used when there is only one row */
    singularTitle: string;
    /** A title to be used when there are more than one row */
    pluralTitle: string;
    /** Should add a tooltip in the table TopBar? */
    info?: ReactNode;
    /** Custom class name */
    className?: string;
    /** Custom class name for the title */
    titleClassName?: string;
    /** Text filter value (search) that will filter the table when the table loaded  */
    initialTextFilter?: string;
    /** A custom components to add at the left */
    LeftComponent?: ReactNode;
    /** Add here custom actions that will be to the left of the default actions */
    actionsRight?: ReactNode;
    /** Add here custom actions that will be to the right of the default actions */
    actionsLeft?: ReactNode;
    /** Should allow export to csv? include here export options */
    exportToCsvOptions?: ExportToCsvProps;
    /** Props for search input */
    searchInputProps?: any;
    /** Lazy loading text */
    lazyLoadingText?: string;
    /** Should use Tabs instead of title? */
    TabsProps?: any;
    subTitle?: string;
}

export const TableTopBar = ({
    tableProps,
    singularTitle,
    pluralTitle,
    info,
    className,
    initialTextFilter,
    actionsRight,
    actionsLeft,
    exportToCsvOptions,
    searchInputProps,
    titleClassName = '',
    LeftComponent,
    lazyLoadingText = 'Loading',
    subTitle
}: TableTopBarProps) => {
    const { organizedRows, updateTextFilter, rows, filterState, resetFilters, selectionState, isLazyLoading } =
        tableProps;
    const [inputTextFilter, setInputTextFilter] = useState(initialTextFilter);
    const itemCount = rows.length;
    const filteredItemCount = organizedRows.length;

    const textFilter = filterState?.textFilter;
    const showFilterText = filterState?.count > 0 || textFilter;
    const showSelectionText = selectionState && selectionState?.count > 0;

    return (
        <div className={classNames(styles.base, className)}>
            {LeftComponent}
            <Typography variant="Semibold_16" isEllipsis className={classNames(styles.title, titleClassName)}>
                <div className={styles.tableMainTitleContainer}>
                    <span>{itemCount === 1 ? singularTitle : pluralTitle}</span>
                    <span>({itemCount === filteredItemCount ? itemCount : `${filteredItemCount}/${itemCount}`})</span>
                    {info && <TooltipInfo isAppendedToBody>{info}</TooltipInfo>}
                    {showFilterText && (
                        <span>{`| Filtered by${textFilter ? ' search' : ''}${
                            textFilter && filterState?.count > 0 ? ' & ' : ''
                        }${
                            filterState?.count
                                ? ` ${filterState?.count} parameter${filterState?.count > 1 ? 's' : ''}`
                                : ''
                        }`}</span>
                    )}
                    {showSelectionText && (
                        <span>{`| ${
                            selectionState?.count === itemCount ? 'All selected' : `${selectionState?.count} selected`
                        }`}</span>
                    )}
                    {showFilterText && (
                        <Button
                            variant="text"
                            className={styles['reset-button']}
                            onClick={() => {
                                resetFilters();
                                setInputTextFilter('');
                            }}
                        >
                            Reset filters
                        </Button>
                    )}
                    {isLazyLoading && (
                        <div className={styles['lazy-loading-indication']}>
                            <Typography variant="Semibold_16">|</Typography>
                            <DsFlashingDotsLoader className={styles['lazy-loading']} />
                            <Typography variant="Regular_14" color="var(--text-disabled)">
                                {lazyLoadingText}
                            </Typography>
                        </div>
                    )}
                </div>
                {subTitle && (
                    <Typography title={subTitle} className={styles.subTextClass} variant="Regular_14">
                        {subTitle}
                    </Typography>
                )}
            </Typography>
            <div className={styles.actions}>
                {actionsLeft}
                <SearchInput
                    value={inputTextFilter}
                    isDisabled={isLazyLoading}
                    onChange={(value: string) => {
                        setInputTextFilter(value);
                        updateTextFilter(value);
                    }}
                    {...searchInputProps}
                />
                {exportToCsvOptions && (
                    <Button
                        className={styles.export}
                        variant="icon"
                        isDisabled={tableProps?.organizedRows?.length === 0 || isLazyLoading}
                        title="Export to CSV"
                        onClick={() => exportToCsv(exportToCsvOptions, tableProps)}
                    >
                        <ExportIcon />
                    </Button>
                )}
                {actionsRight}
            </div>
        </div>
    );
};
