const weekdaysMap = {
    0: 'Sunday',
    1: 'Monday',
    2: 'Tuesday',
    3: 'Wednesday',
    4: 'Thursday',
    5: 'Friday',
    6: 'Saturday'
};

const monthsMap = {
    1: 'January',
    2: 'February',
    3: 'March',
    4: 'April',
    5: 'May',
    6: 'June',
    7: 'July',
    8: 'August',
    9: 'September',
    10: 'October',
    11: 'November',
    12: 'December'
};

// Helper function to get ordinal suffix (1st, 2nd, 3rd, etc.)
const getOrdinalSuffix = n => {
    if (n >= 11 && n <= 13) return 'th';
    switch (n % 10) {
        case 1:
            return 'st';
        case 2:
            return 'nd';
        case 3:
            return 'rd';
        default:
            return 'th';
    }
};

export const formatCronSchedule = schedule => {
    const { minutes, hours, weekdays, days, months } = schedule.cron;
    let description = '';

    // Minutes
    if (minutes && minutes.length > 0) {
        description += `${minutes.join(', ')} min past `;
    }

    // Hours
    if (hours && hours.length > 0) {
        const formattedHours = hours.map(h =>
            h === 0 ? '12 AM' : h === 12 ? '12 PM' : h < 12 ? `${h} AM` : `${h - 12} PM`
        );
        description += `${formattedHours.join(' and ')} `;
    } else {
        description += 'every hour ';
    }

    // Days of the month
    if (days && days.length > 0) {
        const formattedDays = days.map(d => `${d}${getOrdinalSuffix(d)}`).join(' and ');
        description += `on ${formattedDays} day `;
    }

    // Months
    if (months && months.length > 0) {
        const formattedMonths = months.map(m => monthsMap[m]).join(' and ');
        description += `of ${formattedMonths} `;
    }

    // Weekdays (only if no days are specified)
    if (weekdays && weekdays.length > 0 && !days) {
        const formattedWeekdays = weekdays.map(w => weekdaysMap[w]).join(' and ');
        description += `every week on ${formattedWeekdays}`;
    } else if (!weekdays && !days && !months) {
        description += 'every day';
    }

    return description.trim();
};
