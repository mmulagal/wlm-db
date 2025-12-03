import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { ReactComponent as DatePickerIcon } from '../../assets/datepicker.svg';
import styles from './Datepicker.module.scss';
import { DsTypography } from '@tlveng/wlm-ds';
import { DsButton } from '@netapp/design-system';

interface DatePickerProps {
    value?: Date;
    onChange: (date: Date) => void;
}

const Datepicker: React.FC<DatePickerProps> = ({ value, onChange }) => {
    const normalize = (d: Date) => {
        const nd = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        return nd;
    };

    const today = normalize(new Date());

    const [isOpen, setIsOpen] = useState(false);
    const initial = normalize(value ?? today);
    const [tempDate, setTempDate] = useState(initial);
    const [selectedDate, setSelectedDate] = useState(initial);
    const [viewDate, setViewDate] = useState(initial);
    const [showYears, setShowYears] = useState(false);

    const wrapperRef = useRef<HTMLDivElement>(null);
    const popupRef = useRef<HTMLDivElement>(null);
    const [popupPos, setPopupPos] = useState({ top: 0, left: 0, width: 0 });

    useEffect(() => {
        if (value) {
            const normalized = normalize(value);
            setSelectedDate(normalized);
            if (!isOpen) {
                setTempDate(normalized);
                setViewDate(normalized);
            }
        }
    }, [value, isOpen]);

    useEffect(() => {
        if (isOpen) {
            setTempDate(selectedDate);
            setViewDate(selectedDate);
        }
    }, [isOpen, selectedDate]);

    // Position popup under input
    useEffect(() => {
        if (isOpen && wrapperRef.current) {
            const rect = wrapperRef.current.getBoundingClientRect();
            setPopupPos({
                top: rect.top + rect.height + window.scrollY + 2,
                left: rect.left + window.scrollX,
                width: rect.width
            });
        }
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;

        const handlePointerDown = (e: MouseEvent) => {
            const target = e.target as Node;
            const wrapperContains = wrapperRef.current?.contains(target);
            const popupContains = popupRef.current?.contains(target);
            if (!wrapperContains && !popupContains) {
                setIsOpen(false);
            }
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen]);

    const resetDisabled = tempDate.getTime() === today.getTime();
    const rightArrowDisabled =
        viewDate.getMonth() === today.getMonth() && viewDate.getFullYear() === today.getFullYear();

    // Year range
    const startYear = 2015;
    const endYear = 2035;
    const years = Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i);

    const applyDateLabel = selectedDate.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    });

    const getCalendarMeta = () => {
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();
        return {
            firstDay: new Date(year, month, 1).getDay(),
            days: new Date(year, month + 1, 0).getDate()
        };
    };

    const handleDayClick = (day: number) => {
        const newDate = normalize(new Date(viewDate.getFullYear(), viewDate.getMonth(), day));
        if (newDate > today) return; // Disable future days
        setTempDate(newDate);
    };

    const handleReset = () => {
        setTempDate(today);
    };

    const handleApply = () => {
        setSelectedDate(tempDate);
        onChange(tempDate);
        setIsOpen(false);
    };

    // Close year dropdown
    const monthYearRef = useRef<HTMLDivElement>(null);
    const handleInternalPopupClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (showYears && monthYearRef.current && !monthYearRef.current.contains(e.target as Node)) {
            setShowYears(false);
        }
    };

    const popup = (
        <div
            ref={popupRef}
            className={styles.popup}
            onClick={handleInternalPopupClick}
            style={{ top: popupPos.top, left: popupPos.left, width: popupPos.width, position: 'absolute' }}
        >
            {/* Header */}
            <div className={styles.header}>
                <button
                    className={styles.arrow}
                    onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1))}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="9" height="19" viewBox="0 0 9 19" fill="none">
                        <path
                            d="M8.09933 0.435293L8.29716 0.282436C8.43056 0.455086 8.50293 0.667104 8.50293 0.885288C8.50293 1.10347 8.43056 1.31549 8.29716 1.48814L8.2919 1.49496L1.84598 9.26844L8.3018 17.0688L8.31013 17.0819C8.41972 17.2538 8.47353 17.4553 8.46418 17.6589C8.45486 17.862 8.3832 18.0572 8.25896 18.2181C8.19756 18.2993 8.11952 18.3664 8.03006 18.4149C7.94004 18.4637 7.84058 18.4926 7.7384 18.4996C7.63623 18.5067 7.53375 18.4916 7.43791 18.4555C7.34207 18.4194 7.25512 18.3631 7.18295 18.2905L7.17504 18.2825L0.220882 9.89505C0.0763574 9.72261 -0.00223964 9.50347 0.000337195 9.2785C0.000971398 9.05818 0.0764395 8.8446 0.21439 8.67277L0.216844 8.66972L7.15804 0.296562C7.22177 0.210488 7.30362 0.139392 7.39785 0.08832C7.4948 0.0357715 7.60237 0.00577082 7.71254 0.00056609L7.72452 -3.40253e-08C7.83441 8.14205e-05 7.94285 0.0253963 8.04166 0.0734807C8.14047 0.121565 8.22708 0.191454 8.29495 0.277877L8.09833 0.432295C8.09832 0.432292 8.09833 0.432299 8.09833 0.432295L8.09933 0.435293Z"
                            fill="#1C1C1C"
                        />
                    </svg>
                </button>

                <div ref={monthYearRef} className={styles.monthYearContainer} onClick={() => setShowYears(!showYears)}>
                    <DsTypography variant="Semibold_16" className={styles.monthYear}>
                        {viewDate.toLocaleString('default', { month: 'long' })} {viewDate.getFullYear()}
                    </DsTypography>

                    <svg
                        className={`${styles.chevron} ${showYears ? styles.chevronOpen : ''}`}
                        xmlns="http://www.w3.org/2000/svg"
                        width="10"
                        height="5"
                        viewBox="0 0 10 5"
                        fill="none"
                    >
                        <path d="M5 5L0 0H10L5 5Z" fill="#1C1C1C" />
                    </svg>

                    {showYears && (
                        <div className={styles.yearSelect}>
                            {years.map(year => {
                                const isCurrent = year === viewDate.getFullYear();
                                return (
                                    <div
                                        key={year}
                                        className={`${styles.yearOption} ${isCurrent ? styles.currentYear : ''}`}
                                        onClick={() => {
                                            setViewDate(new Date(year, viewDate.getMonth(), 1));
                                            setShowYears(false);
                                        }}
                                    >
                                        {year}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <button
                    className={`${styles.arrow} ${rightArrowDisabled ? styles.disabled : ''}`}
                    disabled={rightArrowDisabled}
                    onClick={() =>
                        !rightArrowDisabled && setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1))
                    }
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="9" height="19" viewBox="0 0 9 19" fill="none">
                        <path
                            d="M0.403599 18.0659L0.205766 18.2188C0.0723678 18.0461 8.74801e-08 17.8341 1.16091e-07 17.6159C1.44703e-07 17.3977 0.0723675 17.1857 0.205766 17.0131L0.211034 17.0063L6.65696 9.23278L0.201127 1.4324L0.192801 1.41934C0.0832108 1.24746 0.029406 1.04592 0.0387492 0.842297C0.0480667 0.639227 0.119732 0.443979 0.243969 0.283114C0.305368 0.20196 0.383409 0.134859 0.47287 0.0863209C0.562887 0.0374814 0.662356 0.00857743 0.764526 0.00157176C0.8667 -0.00543392 0.969183 0.0096227 1.06502 0.0457174C1.16086 0.0818101 1.24781 0.138098 1.31998 0.210766L1.32789 0.218727L8.28205 8.60617C8.42657 8.77861 8.50517 8.99776 8.50259 9.22272C8.50196 9.44304 8.42649 9.65663 8.28854 9.82845L8.28609 9.8315L1.34489 18.2047C1.28116 18.2907 1.19931 18.3618 1.10508 18.4129C1.00813 18.4654 0.90056 18.4954 0.790392 18.5007L0.778409 18.5012C0.668519 18.5011 0.560081 18.4758 0.46127 18.4277C0.362459 18.3797 0.275853 18.3098 0.20798 18.2233L0.404603 18.0689C0.404606 18.0689 0.4046 18.0689 0.404603 18.0689L0.403599 18.0659Z"
                            fill="#1C1C1C"
                        />
                    </svg>
                </button>
            </div>

            {/* Year dropdown moved inside monthYearContainer for positioning */}

            {/* Calendar grid */}
            <div className={styles.daysGrid}>
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, index) => (
                    <DsTypography variant="Regular_14" key={`day-${index}`} className={styles.dayName}>
                        {d}
                    </DsTypography>
                ))}

                {Array(getCalendarMeta().firstDay)
                    .fill(null)
                    .map((_, i) => (
                        <div key={`empty-${i}`} />
                    ))}

                {Array.from({ length: getCalendarMeta().days }, (_, i) => i + 1).map(day => {
                    const date = normalize(new Date(viewDate.getFullYear(), viewDate.getMonth(), day));
                    const isSelected = date.getTime() === tempDate.getTime();
                    const isToday = date.getTime() === today.getTime();
                    const isFuture = date > today;

                    return (
                        <DsTypography
                            variant="Regular_14"
                            key={day}
                            className={`${styles.day} ${isSelected ? styles.selected : ''} ${
                                isToday ? styles.today : ''
                            } ${isFuture ? styles.disabledDay : ''}`}
                            onClick={() => !isFuture && handleDayClick(day)}
                        >
                            {day}
                        </DsTypography>
                    );
                })}
            </div>

            {/* Footer */}
            <div className={styles.footer}>
                <DsButton type="text" isDisabled={tempDate.getTime() === today.getTime()} onClick={handleReset}>
                    Reset
                </DsButton>

                <div className={styles.rightSide}>
                    <DsButton type="text" onClick={() => setIsOpen(false)}>
                        Cancel
                    </DsButton>

                    <DsButton type="text" onClick={handleApply}>
                        Apply
                    </DsButton>
                </div>
            </div>
        </div>
    );

    return (
        <div ref={wrapperRef} className={styles.wrapper}>
            <DsTypography variant="Regular_14" className={styles.label}>
                Start date
            </DsTypography>
            <div className={`${styles.input} ${isOpen ? styles.inputOpen : ''}`} onClick={() => setIsOpen(true)}>
                <DsTypography variant="Regular_14">{applyDateLabel}</DsTypography>
                <DatePickerIcon className={styles.calendarIcon} />
            </div>

            {isOpen && ReactDOM.createPortal(popup, document.body)}
        </div>
    );
};

export default Datepicker;
