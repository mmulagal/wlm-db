import React, {
    ChangeEvent,
    SyntheticEvent,
    forwardRef,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState
} from 'react';
import './dsSelect.scss';

import { DropDownCustomeItem, DsExpandableComponent, SelectionType } from '@netapp/design-system/dist/v2/types/types';
import {
    DsDropDownListItemProps,
    DsDropDownListProps,
    DsDropDownSearch
} from '@netapp/design-system/dist/v2/components/dsDropDownList/dsDropDownList';
import { DsButtonProps } from '@netapp/design-system/dist/v2/components/dsButton/dsButton';
import { DsTextField, DsTextFieldProps } from '@netapp/design-system/dist/v2/components/dsTextField/dsTextField';
import { Chip, DsChipTextField } from '@netapp/design-system/dist/v2/components/dsTextField/dsChipTextField';
import { DsCheckbox, DsTooltipInfo, DsTypography } from '@netapp/design-system';
import { _Classes } from '../../utils/utilityFunctions';
import { DsDropDownList } from './dsDropDownList';

export type DsSelectVariant = 'underline';

interface SelectChip extends Chip {
    isSelected: boolean;
}

export interface DsSelectItemProps extends DsDropDownListItemProps {
    /** The value that will be shown when item is selected */
    value: string;
}

interface SelectActionProps extends Omit<DsButtonProps, 'onClick'> {
    onClick?: (event: SyntheticEvent, selectedIds?: (string | number)[]) => void;
}
type SelectActions = [SelectActionProps] | [SelectActionProps, SelectActionProps];

export interface DsSelectProps
    extends Omit<DsTextFieldProps, 'countLimiting' | 'value' | 'onChange'>,
        DsExpandableComponent,
        DropDownCustomeItem<DsDropDownListItemProps> {
    options: DsSelectItemProps[];
    selectedOptionIds?: (number | string)[];
    onInputChange?: (event?: ChangeEvent<HTMLInputElement>) => void;
    onSelect?: (option: DsSelectItemProps[]) => void;
    selectionType?: SelectionType;
    /** The formatLabel is a type that can get 'chip' or 'count' or a function (value: string[] | undefined) => string | undefined */
    formatLabel?: 'chip' | 'count' | ((value: string[] | undefined) => string | undefined) | any;
    isWithActions?: boolean;
    searchMethod?: DsDropDownSearch;
    isCleanable?: boolean;
    isSelectAll?: boolean;
    value?: any[];
    onSelectionChange?: (selectedOptions: DsSelectItemProps[]) => void;
    dropDown?: {
        placement?: 'alignRight' | 'center' | 'alignLeft';
        autoPosition?: boolean;
        offsetXpixels?: number;
        widthPixels?: number;
        maxHeight?: string;
        isCloseOnClickOutside?: boolean;
        actions?: SelectActions;
    };
}

export const DsSelectFsx = forwardRef<HTMLDivElement, DsSelectProps>(
    (
        {
            className = '',
            isDisabled,
            disabledReason,
            isLoading,
            value,
            isOptional,
            isReadOnly,
            isExpanded,
            message,
            onSelectionChange = () => {},
            onInputChange = () => {},
            onClick = () => {},
            onExpandChange = () => {},
            onSelect = () => {},
            formatOptionLabel,
            variant = 'Default',
            placeholder,
            style = {},
            title,
            tooltip,
            typographyVariant = 'Regular_14',
            options = [],
            selectedOptionIds,
            selectionType = 'single',
            formatLabel = 'chip',
            isWithActions = false,
            /** basic - search by exact search key, smart - search by similar search key */
            searchMethod,
            isCleanable = true,
            isSelectAll = false,
            dropDown,
            ...rest
        }: DsSelectProps,
        ref
    ) => {
        const SELECT_ALL = 'selectAll';
        const SELECT_ALL_CHIP: DsSelectItemProps = useMemo(
            () => ({
                id: SELECT_ALL,
                label: 'Select all',
                value: SELECT_ALL,
                className: SELECT_ALL
            }),
            []
        );
        const DEFAULT_DROPDOWN_WIDTH = 182;

        const inputRef = useRef<HTMLInputElement>(null);

        const [selectOptions, setSelectOptions] = useState<DsSelectItemProps[]>([]);
        const [expanded, setExpanded] = useState<boolean>(!!isExpanded);
        const [inputText, setInputText] = useState<string | SelectChip[] | undefined>();
        const [savedInputValueText, setSavedInputValueText] = useState<string | SelectChip[] | undefined>();
        const [selectedOptIds, setSelectedOptIds] = useState<(number | string)[]>([]);
        const [offsetX, setOffsetX] = useState('0px');

        const optionsWithAll = useMemo<DsSelectItemProps[]>(() => {
            if (options.length === 0) {
                return [
                    {
                        id: 'noOptions',
                        label: 'No options available',
                        value: 'none',
                        isDisabled: true
                    }
                ];
            }

            return selectionType === 'multi' && isSelectAll ? [SELECT_ALL_CHIP, ...options] : options;
        }, [SELECT_ALL_CHIP, isSelectAll, options, selectionType]);

        useEffect(() => {
            setExpanded(!!isExpanded);
        }, [isExpanded]);

        useEffect(() => {
            setSelectOptions(ops => (JSON.stringify(optionsWithAll) === JSON.stringify(ops) ? ops : optionsWithAll));
        }, [optionsWithAll]);

        useEffect(() => {
            if (value !== undefined) {
                // For multi-select, value should be an array of selected options
                if (Array.isArray(value)) {
                    // Set selectedOptIds and inputText based on value
                    setSelectedOptIds(value.map(opt => opt.id));
                    setInputText(
                        value.map(option => ({
                            id: option.id.toString(),
                            label: option.label,
                            isSelected: true,
                            isHidden: false
                        }))
                    );
                }
            }
        }, [value]);

        useEffect(() => {
            if (selectedOptionIds) {
                setSelectedOptIds(ids =>
                    JSON.stringify(ids) !== JSON.stringify(selectedOptionIds) ? selectedOptionIds : ids
                );
            }
        }, [selectedOptionIds]);

        useEffect(() => {
            if (selectionType === 'single') {
                const selectedOption = selectOptions.find(option => selectedOptIds.map(id => id).includes(option.id));
                setInputText(selectedOption?.label);
            } else {
                const selectedOpts = selectOptions.filter(option => selectedOptIds.map(id => id).includes(option.id));

                const selectedChips = selectedOpts.map<SelectChip>(option => {
                    const { id, label } = option;

                    return {
                        id: id.toString(),
                        label,
                        isSelected: id !== SELECT_ALL ? true : selectedOpts.length === optionsWithAll.length,
                        isHidden: id === SELECT_ALL
                    };
                });

                setInputText(selectedChips);
            }
        }, [selectOptions, selectionType, selectedOptIds, optionsWithAll.length]);

        useEffect(() => {
            if (inputRef.current) {
                inputRef.current.setAttribute('isInputSelect', 'true');
            }
        }, [formatLabel]); // formatLabel needs to stay in the dependencies array to force the useEffect to run

        useEffect(() => {
            const placement = dropDown?.placement || 'right';
            const offsetXpixels = dropDown?.offsetXpixels || 0;
            const boundariesWidth = inputRef.current?.clientWidth || 0;
            const dropDownWidth = dropDown?.widthPixels || DEFAULT_DROPDOWN_WIDTH;

            switch (placement) {
                case 'center': {
                    const offsetX = (boundariesWidth - dropDownWidth + offsetXpixels) / 2;
                    setOffsetX(`${offsetX}px`);
                    break;
                }
                case 'alignRight': {
                    const offsetX = boundariesWidth - dropDownWidth + offsetXpixels;
                    setOffsetX(`${offsetX}px`);
                    break;
                }
            }
        }, [dropDown?.placement, dropDown, formatLabel]);

        const chipsToOptions = useCallback(
            (chips: Chip[]) =>
                selectOptions.filter(option => chips.map(chip => chip.id).includes(option.id.toString())),
            [selectOptions]
        );

        const changeEventWithActionButtons = useCallback(
            (chips: Chip[]) => {
                const selectedOptions = chipsToOptions(chips).filter(option => option.id !== SELECT_ALL);

                if (!isWithActions || !expanded) {
                    setSelectedOptIds(selectedOptions.map(opt => opt.id));
                    onSelect(selectedOptions);
                }

                if (isWithActions && expanded && onSelectionChange) {
                    onSelectionChange(selectedOptions);
                }
            },
            [chipsToOptions, expanded, isWithActions, onSelect, onSelectionChange]
        );

        const handleSingleSelectItem = useCallback(
            (option?: DsSelectItemProps, event?: SyntheticEvent) => {
                setSelectedOptIds(option ? [option.id] : []);
                onSelect(option ? [option] : []);
                setExpanded(false);
                setInputText(option?.label);
                if (event && option?.onClick) option?.onClick(event);
            },
            [onSelect]
        );

        const handleCheckSelectItem = useCallback(
            (event: ChangeEvent<HTMLInputElement>, id: string, option: DsSelectItemProps) => {
                const { label } = option;
                let chips = (inputText as SelectChip[]) || [];
                if (event.target.checked === true) {
                    if (id === SELECT_ALL) {
                        chips = optionsWithAll.map<SelectChip>(chip => ({
                            id: chip.id.toString(),
                            isSelected: true,
                            label: chip.label,
                            isHidden: chip.id === SELECT_ALL
                        }));
                    } else {
                        const chipsWithoutSelectAll = chips.filter(chip => chip.id !== SELECT_ALL);
                        chips = [
                            {
                                id: SELECT_ALL,
                                isSelected: false,
                                label: SELECT_ALL_CHIP.label,
                                isHidden: true
                            },
                            ...chipsWithoutSelectAll,
                            {
                                id,
                                label,
                                isSelected: true,
                                isHidden: false
                            }
                        ];
                    }
                } else {
                    chips = id === SELECT_ALL ? [] : chips.filter(chip => chip.id !== id);
                }

                setInputText(chips);
                changeEventWithActionButtons(chips);
                if (option.onClick) option.onClick(event);
            },
            [SELECT_ALL_CHIP.label, changeEventWithActionButtons, inputText, optionsWithAll]
        );

        const textFieldInput = useMemo(() => {
            const handleOnChange = (event?: ChangeEvent<HTMLInputElement>) => {
                onInputChange(event);

                if (!event) {
                    handleSingleSelectItem();
                }
            };

            const handleClick = (event: SyntheticEvent) => {
                onClick(event);

                if (!expanded) {
                    setSavedInputValueText(inputText);
                }

                setExpanded(!expanded);
            };

            const handleOnChipChange = (chips: Chip[]) => {
                setInputText(
                    chips.map<SelectChip>(chip => ({
                        ...chip,
                        isSelected: true
                    }))
                );

                changeEventWithActionButtons(chips);
            };

            const valueWithFormat = () => {
                if (typeof formatLabel === 'function') {
                    const labels = Array.isArray(inputText)
                        ? inputText.filter(item => item.id !== SELECT_ALL).map(chip => chip.label)
                        : inputText
                        ? [inputText]
                        : [];

                    return formatLabel(labels);
                }

                switch (formatLabel) {
                    case 'count': {
                        const itemCount =
                            selectionType === 'single' && inputText
                                ? 1
                                : inputText
                                ? (inputText as SelectChip[]).filter(item => item.id !== SELECT_ALL).length
                                : 0;

                        return `${itemCount} selected`;
                    }
                    default: {
                        return inputText as string;
                    }
                }
            };

            if (typeof formatLabel === 'function') {
                const labelOutput = valueWithFormat();

                if (React.isValidElement(labelOutput)) {
                    return (
                        <div onClick={handleClick} ref={inputRef} className="dsSelect-label-wrapper">
                            <span className="dsTextFramePopover">
                                <div
                                    className="dsTextFramePopover"
                                    style={{ display: 'flex', flexDirection: 'column', width: '100%' }}
                                >
                                    <div className="textFieldHeader">
                                        <div
                                            tabIndex={1}
                                            className="inputTextContainer"
                                            style={{ paddingBottom: '1px', position: 'relative', outline: 'none' }}
                                        >
                                            <div className="inputContainer" style={{ position: 'relative' }}>
                                                {labelOutput}
                                                <div
                                                    className="actionsContainer"
                                                    style={{
                                                        position: 'absolute',
                                                        top: '0',
                                                        right: '0',
                                                        height: '100%',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        justifyContent: 'center',
                                                        paddingRight: '12px'
                                                    }}
                                                >
                                                    <svg
                                                        width="9"
                                                        height="5"
                                                        viewBox="0 0 9 5"
                                                        fill="none"
                                                        xmlns="http://www.w3.org/2000/svg"
                                                        className="chevronIcon"
                                                    >
                                                        <path
                                                            d="M4.5 5L0.602887 0.499999L8.39711 0.5L4.5 5Z"
                                                            fill="var(--text-secondary)"
                                                        />
                                                    </svg>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </span>
                        </div>
                    );
                }
            }

            if (typeof formatLabel === 'object') {
                return (
                    <div onClick={handleClick} ref={inputRef}>
                        {formatLabel}
                    </div>
                );
            }

            return selectionType === 'single' || formatLabel !== 'chip' ? (
                <DsTextField
                    ref={inputRef}
                    value={valueWithFormat()}
                    isDisabled={isDisabled}
                    disabledReason={disabledReason}
                    isLoading={isLoading}
                    isOptional={isOptional}
                    isReadOnly={isReadOnly}
                    message={message}
                    onChange={handleOnChange}
                    onClick={handleClick}
                    placeholder={placeholder}
                    title={title}
                    tooltip={tooltip}
                    typographyVariant={typographyVariant}
                    style={style}
                    isCleanable={isCleanable}
                />
            ) : (
                <DsChipTextField
                    ref={inputRef}
                    chips={(inputText || []) as Chip[]}
                    isDisabled={isDisabled}
                    disabledReason={disabledReason}
                    isLoading={isLoading}
                    isOptional={isOptional}
                    isReadOnly={isReadOnly}
                    message={message}
                    onChange={handleOnChipChange}
                    onClick={handleClick}
                    placeholder={placeholder}
                    title={title}
                    tooltip={tooltip}
                    isWrapText={false}
                    style={style}
                    isCleanable={isCleanable}
                />
            );
        }, [
            inputText,
            isDisabled,
            isLoading,
            disabledReason,
            isCleanable,
            isOptional,
            isReadOnly,
            message,
            placeholder,
            title,
            tooltip,
            typographyVariant,
            expanded,
            selectionType,
            style,
            formatLabel,
            onClick,
            onInputChange,
            handleSingleSelectItem,
            changeEventWithActionButtons
        ]);

        const dropdownlist = useMemo((): DsDropDownListProps => {
            const OptionItem = ({ option }: { option: DsSelectItemProps }) => {
                const { id, label, className = '', isDisabled, style = {}, 'data-testid': dataTestId } = option;

                const customeLabel = () =>
                    formatOptionLabel && options.length > 0 ? formatOptionLabel(option) : label;

                if (selectionType === 'single' || options.length === 0) {
                    const isSingleItemSelected = (id: string | number) =>
                        selectedOptIds.includes(id) ? 'isSelected' : '';

                    return (
                        <DsTypography
                            key={id}
                            className={_Classes('selectItem', 'singleItem', className, isSingleItemSelected(id), {
                                isDisabled
                            })}
                            variant={typographyVariant}
                            onClick={event => {
                                handleSingleSelectItem(option, event);
                            }}
                            isDisabled={isDisabled}
                            style={style}
                            data-testid={dataTestId}
                        >
                            {customeLabel()}
                        </DsTypography>
                    );
                }
                const isSelected = (id: string) => {
                    const chipList = (inputText || []) as SelectChip[];
                    if (id === SELECT_ALL) {
                        return (
                            chipList.filter(chip => chip.id !== SELECT_ALL).length ===
                            selectOptions.filter(chip => chip.id !== SELECT_ALL).length
                        );
                    }

                    return chipList.some(chip => chip.id === id.toString());
                };

                return (
                    <DsCheckbox
                        key={id}
                        id={id.toString()}
                        title={customeLabel()}
                        onSelect={(id, event) => handleCheckSelectItem(event, id, option)}
                        isSelected={isSelected(id.toString())}
                        className={`selectItem ${className}`}
                        style={style}
                        isDisabled={isDisabled}
                        data-testid={dataTestId}
                    />
                );
            };

            const dropActions: [DsButtonProps, DsButtonProps] = [
                {
                    children: dropDown?.actions ? dropDown?.actions[0].children : 'Apply',
                    onClick: event => {
                        setExpanded(false);
                        const selectedOptions = chipsToOptions(inputText as SelectChip[]);

                        if (dropDown?.actions && dropDown.actions[0].onClick) {
                            setInputText(savedInputValueText);
                            dropDown.actions[0].onClick(
                                event,
                                selectedOptions.map(opt => opt.id)
                            );
                        } else {
                            setSelectedOptIds(selectedOptions.map(opt => opt.id));
                            onSelect(selectedOptions.filter(option => option.id !== SELECT_ALL));
                        }
                    }
                },
                {
                    children: dropDown?.actions?.length === 2 ? dropDown?.actions[1].children : 'Cancel',
                    onClick: event => {
                        setExpanded(false);
                        setInputText(savedInputValueText);

                        if (dropDown?.actions?.length === 2 && dropDown.actions[1].onClick) {
                            const selectedOptions = chipsToOptions(inputText as SelectChip[]);
                            dropDown.actions[1].onClick(
                                event,
                                selectedOptions.map(opt => opt.id)
                            );
                        }
                    }
                }
            ];

            return {
                // @ts-ignore
                boundariesRef: inputRef,
                offsetX,
                maxHeight: dropDown?.maxHeight,
                onExpandChange: isExpanded => {
                    setExpanded(isExpanded);
                    onExpandChange(isExpanded);
                },
                onClickOutside: () => {
                    if (dropDown?.isCloseOnClickOutside && isWithActions && expanded) {
                        setExpanded(false);
                        setInputText(savedInputValueText);
                    }
                },
                options: selectOptions.map<DsDropDownListItemProps>(option => {
                    const { id, childItems, label, className, onClick, style, isDisabled, disabledReason } = option;

                    return {
                        id,
                        label,
                        childItems,
                        searchByKey: option.label,
                        className,
                        onClick,
                        style,
                        typographyVariant,
                        isDisabled,
                        disabledReason
                    };
                }),
                isExpanded: isExpanded !== undefined ? isExpanded : expanded,
                actions:
                    isWithActions && selectionType === 'multi'
                        ? (dropActions.slice(0, dropDown?.actions ? dropDown.actions.length : 2) as SelectActions)
                        : undefined,
                isCloseOnClickOutside: dropDown?.isCloseOnClickOutside || !isWithActions,
                searchMethod: options.length > 0 ? searchMethod : undefined,
                formatOptionLabel: ({ id }) => {
                    const customeOption = selectOptions.find(option => option.id === id);
                    return customeOption ? <OptionItem option={customeOption!} /> : <></>;
                },
                autoPosition: dropDown?.autoPosition === undefined ? true : dropDown?.autoPosition
            };
        }, [
            chipsToOptions,
            isExpanded,
            offsetX,
            expanded,
            formatOptionLabel,
            handleCheckSelectItem,
            handleSingleSelectItem,
            inputText,
            isWithActions,
            onExpandChange,
            onSelect,
            options.length,
            savedInputValueText,
            searchMethod,
            selectOptions,
            selectedOptIds,
            selectionType,
            typographyVariant,
            dropDown
        ]);

        return (
            <div
                className={`dsSelect ${className} ${expanded ? 'isExpanded' : ''} ${isDisabled ? 'isDisabled' : ''} ${
                    isLoading ? 'isLoading' : ''
                } ${isOptional ? 'isOptional' : ''} ${isReadOnly ? 'isReadOnly' : ''} ${variant} ${selectionType}`}
                ref={ref}
                {...rest}
            >
                {tooltip && variant === 'underline' && (
                    <DsTooltipInfo {...tooltip} title={undefined} trigger="hover" className="underlineTooltip" />
                )}
                {textFieldInput}
                <DsDropDownList
                    {...dropdownlist}
                    style={{
                        width:
                            typeof formatLabel === 'object'
                                ? `${dropDown?.widthPixels || DEFAULT_DROPDOWN_WIDTH}px`
                                : inputRef.current?.clientWidth
                    }}
                />
            </div>
        );
    }
);
