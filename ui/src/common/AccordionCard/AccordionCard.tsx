import React, {
    FunctionComponent,
    ReactNode,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState
} from 'react';
import classNames from 'classnames';
import { UnmountClosed } from 'react-collapse';
import { v4 as uuidv4 } from 'uuid';
import _isArray from 'lodash/isArray';

import { DsFlashingDotsLoader, DsTypography } from '@netapp/design-system';
import { ReactComponent as ChevronIcon } from '@netapp/icons/ic_card_arrow_expand.svg';
import styles from './AccordionCard.module.scss';
import { HashTable } from '../../utils/utilityFunctions';
import { TransitionChevron } from '../TransitionChevron/TransitionChevron';

const AccordionContext = React.createContext<AccordionContextProps>(null);

export type AccordionContextProps = {
    openChildren: HashTable<boolean> | null;
    toggleOpenChild: (childID: string) => void;
    setOpenChildren: React.Dispatch<React.SetStateAction<HashTable<boolean> | null>>;
    id: string;
    closeAll: () => void;
} | null;

export const useAccordionContext = () => useContext(AccordionContext);

export interface AccordionControllerProps {
    /** Are the accordion card have a separation between each other? */
    isGrouped: boolean;
    /** Accordion cards */
    children: ReactNode;
    /** Custom ID */
    id?: string;
}

export const AccordionController = React.memo(({ children, isGrouped, id }: AccordionControllerProps) => {
    const [openChildren, setOpenChildren] = useState<HashTable<boolean> | null>(null);
    const idRef = useRef(id || uuidv4());

    const toggleOpenChild = useCallback(
        (childId: string) =>
            setOpenChildren(prev => {
                if (prev?.[childId]) {
                    return {
                        ...prev,
                        [childId]: false
                    };
                }
                return {
                    [childId]: true
                };
            }),
        [setOpenChildren]
    );

    const controller = useMemo(
        () => ({
            openChildren,
            toggleOpenChild,
            setOpenChildren,
            id: idRef.current,
            closeAll: () => {
                setOpenChildren(null);
            }
        }),
        [openChildren, toggleOpenChild, idRef, setOpenChildren]
    );

    return (
        <AccordionContext.Provider value={controller}>
            <AccordionTable isGrouped={isGrouped}>{children}</AccordionTable>
        </AccordionContext.Provider>
    );
});

export interface AccordionTableProps {
    /** Are the accordion card have a separation between each other? */
    isGrouped?: boolean;
    /** Accordion cards */
    children: ReactNode;
}

export const AccordionTable = React.memo(({ children, isGrouped = false }: AccordionTableProps) => {
    const context = useAccordionContext();
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const accordionTableHeaderStyle = window.document.createElement('style');
        accordionTableHeaderStyle.type = 'text/css';

        window.document.head.appendChild(accordionTableHeaderStyle);

        if (context?.id && ref?.current) {
            let max = 0;
            for (const card of ref.current.getElementsByClassName(`at-${context.id}`)) {
                max = Math.max(card.clientWidth, max);
            }
            // accordionTableHeaderStyle.innerHTML = `.${styles.header}.ah-${context.id} {
            //       grid-template-columns: minmax(${max}px, max-content) 1fr max-content max-content max-content;
            //   }`;

            // Use textContent instead of innerHTML
            const styleContent = `
            .${styles.header}.ah-${context.id} {
                grid-template-columns: minmax(${max}px, max-content) 1fr max-content max-content max-content;
            }
        `;
            accordionTableHeaderStyle.appendChild(document.createTextNode(styleContent));
        }

        return () => {
            window.document.head.removeChild(accordionTableHeaderStyle);
        };
    }, [context?.id]);

    return (
        <div ref={ref} className={classNames(styles['accordion-table'], { [styles['is-grouped']]: isGrouped })}>
            {children}
        </div>
    );
});

export interface AccordionCardContentProps {
    className?: string;
    style?: React.CSSProperties;
    children?: ReactNode;
}

export const AccordionCardContent = React.memo(({ children, className, style }: AccordionCardContentProps) => (
    <div className={classNames(styles['accordion-card-content'], className)} style={style}>
        {children}
    </div>
));

export interface AccordionValueProps {
    value?: string | string[];
    // @ts-ignore
    ValueContent?: ({ isDisabled }: { isDisabled: boolean }) => JSX.Element;
    isDisabled?: boolean;
    isHideMultiValueTooltip?: boolean;
}

const AccordionValue = React.memo(
    ({ value, ValueContent, isDisabled, isHideMultiValueTooltip }: AccordionValueProps) => {
        if (_isArray(value)) {
            const values = value.filter(value => !!value);
            return (
                <div className={styles['multi-value']}>
                    {values.map((value, index) => (
                        <DsTypography
                            Component="span"
                            variant="Regular_14"
                            color={isDisabled ? 'var(--text-disabled)' : undefined}
                            key={index}
                        >
                            {value}
                        </DsTypography>
                    ))}
                    {/* {isHideMultiValueTooltip && <TooltipInfo>{values.join(', ')}</TooltipInfo>} */}
                </div>
            );
        }
        if (ValueContent) {
            return <ValueContent isDisabled={isDisabled || false} />;
        }
        return (
            <DsTypography variant="Regular_14" color={isDisabled ? 'var(--text-disabled)' : undefined}>
                {value}
            </DsTypography>
        );
    }
);

export interface AccordionCardProps {
    /** Accordion card title, the text that will be presented when closed */
    title?: ReactNode;
    /** summarized of the accordion selected values,the text that will be presented when closed */
    value?: string | string[];
    /** if needed, a component that will render the value of the accordion */
    // @ts-ignore
    ValueContent?: ({ isDisabled }: { isDisabled: boolean }) => JSX.Element;
    /** Is the accordion loading? */
    isLoading?: boolean;
    /** Nodes that will be rendered left of the chevron */
    LeftWidget?: FunctionComponent;
    /** Nodes that will be rendered left of the chevron */
    RightWidget?: FunctionComponent;
    /** Accordion content, will be shown when expanded */
    children?: ReactNode;
    /** custom classname for the accordion card */
    className?: string;
    /** custom styles for the accordion card */
    style?: React.CSSProperties;
    /** custom classname for the card header */
    headerClassName?: string;
    /** Custom styles for the card header */
    headerStyle?: React.CSSProperties;
    /** affects value/title appearance and prevents selection but does not prevent expand */
    isDisabled?: boolean;
    /** Is the expanding button disabled */
    isExpandDisabled?: boolean;
    /** Is the accordion selected */
    isSelected?: boolean;
    /** A callback that will be called when selecting a card */
    onSelect?: (id: string, e: React.FormEvent<HTMLInputElement>) => void;
    /** The id of the card is not shown, used for identification purposes and for opening programmaticly */
    id?: string;
    /** If value is array, should the value tooltip be hidden? */
    isHideMultiValueTooltip?: boolean;
    /** PDF capture: render static chevron (not a button) and keep accordion expanded */
    printState?: boolean;
}

/**
 * If an AccordionCard can be expanded, and it doesnt have select option or left/right widgets, then click on the header will expand
 * If the card is selectable or has left/right widgets, only click on arrow will expand
 */
export const AccordionCard = React.memo(
    ({
        title,
        value,
        ValueContent,
        isLoading,
        LeftWidget,
        RightWidget,
        children,
        className,
        style,
        headerClassName,
        headerStyle,
        isDisabled: _isDisabled,
        isExpandDisabled: _isExpandDisabled,
        isSelected,
        onSelect,
        isHideMultiValueTooltip = false,
        id: _id,
        printState = false
    }: AccordionCardProps) => {
        const context = useAccordionContext();
        const { openChildren, toggleOpenChild } = context || {};

        const isExpandDisabled = _isExpandDisabled || isLoading;
        const isDisabled = _isDisabled || isLoading;
        const id = useRef(_id || uuidv4());
        const isOpen = openChildren?.[id.current];
        const hasInnerContent = !!children;
        const showValue = (value || ValueContent) && !isOpen && !isLoading;

        return (
            <div className={classNames(styles.base, className)} style={style}>
                <div
                    className={classNames(styles.header, headerClassName, `ah-${context?.id}`, {
                        [styles.hoverable]: !isOpen && !isDisabled,
                        [styles.disabled]: isDisabled,
                        [styles.clickable]: !isDisabled
                    })}
                    style={headerStyle}
                    onClick={() => !printState && !isDisabled && toggleOpenChild && toggleOpenChild(id.current)}
                >
                    <div className={classNames(styles.title, `at-${context?.id}`)}>
                        {/* {onSelect && (
                            <CheckButton
                                className={styles.selection}
                                isChecked={isSelected || false}
                                onChange={(newValue: boolean, e: React.FormEvent<HTMLInputElement>) =>
                                    onSelect(id.current, e)
                                }
                                isDisabled={isDisabled}
                            />
                        )} */}
                        <DsTypography variant="Semibold_14" color={isDisabled ? 'var(--text-disabled)' : undefined}>
                            {title}
                        </DsTypography>
                    </div>
                    {showValue && (
                        <AccordionValue
                            value={value}
                            ValueContent={ValueContent}
                            isDisabled={isDisabled}
                            isHideMultiValueTooltip={isHideMultiValueTooltip}
                        />
                    )}
                    {!showValue && !isLoading && <div />}
                    {isLoading && (
                        <div className={styles.loader}>
                            <DsFlashingDotsLoader />
                            <DsTypography color="var(--text-disabled)">Loading data</DsTypography>
                        </div>
                    )}
                    {LeftWidget ? <LeftWidget /> : <div />}
                    {RightWidget ? <RightWidget /> : <div />}
                    {hasInnerContent &&
                        (printState ? (
                            <span className={styles.printChevron} aria-hidden>
                                <ChevronIcon
                                    className={classNames({
                                        [styles['is-expanded']]: isOpen
                                    })}
                                />
                            </span>
                        ) : (
                            <TransitionChevron
                                className={styles.accordionChevron}
                                isDisabled={isExpandDisabled}
                                isExpanded={isOpen || false}
                            />
                        ))}
                    {!hasInnerContent && <div />}
                </div>
                <UnmountClosed isOpened={isOpen || false} theme={{ collapse: styles.animation }}>
                    {children}
                </UnmountClosed>
            </div>
        );
    }
);
