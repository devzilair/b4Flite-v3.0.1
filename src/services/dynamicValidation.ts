
import { RosterData, ShiftCodeDefinition, Staff, ValidationRule, ValidationRuleSet, ValidationRuleType } from '../types';

/**
 * Checks if a specific duty code represents an 'off-duty' day.
 */
const isOffDuty = (dutyCodeId: string | undefined, dutyCodes: ShiftCodeDefinition[]): boolean => {
    if (!dutyCodeId) return true; // An empty cell is considered off-duty
    const code = dutyCodes.find(dc => dc.id === dutyCodeId);
    return code?.isOffDuty || false;
};

/**
 * Replaces placeholders like {days} in an error message template with actual values from rule parameters.
 */
function formatErrorMessage(template: string, params: { [key: string]: number }): string {
    return template.replace(/{(\w+)}/g, (placeholder, key) => {
        return params[key]?.toString() || placeholder;
    });
}

/**
 * Applies a single validation rule to a staff member's roster data.
 * @returns A map of [date string -> specific error detail string]
 */
const applyRule = (
    rule: ValidationRule,
    staffMember: Staff,
    sortedDates: string[],
    roster: RosterData,
    dutyCodes: ShiftCodeDefinition[]
): { [date: string]: string } => {
    const errors: { [date: string]: string } = {};

    switch (rule.type) {
        case 'MAX_CONSECUTIVE_DUTY': {
            const maxDays = rule.params.days;
            if (!maxDays) return {};
            
            let consecutiveDuty = 0;
            for (const date of sortedDates) {
                const entry = roster[date]?.[staffMember.id];
                if (!isOffDuty(entry?.dutyCodeId, dutyCodes)) {
                    consecutiveDuty++;
                } else {
                    consecutiveDuty = 0;
                }

                if (consecutiveDuty > maxDays) {
                    errors[date] = `(Day ${consecutiveDuty} of ${maxDays})`;
                }
            }
            break;
        }

        case 'MIN_OFF_DAYS_IN_PERIOD':
        case 'MIN_CONSECUTIVE_OFF_DAYS_IN_PERIOD': {
            const period = rule.params.period;
            const requiredDays = rule.params.days;
            const requiredConsecutive = rule.params.consecutiveDays;

            if (!period || (!requiredDays && !requiredConsecutive)) return {};
            
            for (let i = 0; i < sortedDates.length; i++) {
                const currentDateStr = sortedDates[i];
                const currentDateObj = new Date(currentDateStr + 'T00:00:00Z');
                
                let offDaysInWindow = 0;
                let consecutiveOffDays = 0;
                let maxConsecutiveOffBlock = 0;

                const windowStartDate = new Date(currentDateObj);
                windowStartDate.setUTCDate(windowStartDate.getUTCDate() - (period - 1));

                for (let k = 0; k < period; k++) {
                    const checkDate = new Date(windowStartDate);
                    checkDate.setUTCDate(checkDate.getUTCDate() + k);
                    const checkDateStr = checkDate.toISOString().split('T')[0];
                    
                    const entry = roster[checkDateStr]?.[staffMember.id];
                    
                    if (isOffDuty(entry?.dutyCodeId, dutyCodes)) {
                        offDaysInWindow++;
                        consecutiveOffDays++;
                    } else {
                        maxConsecutiveOffBlock = Math.max(maxConsecutiveOffBlock, consecutiveOffDays);
                        consecutiveOffDays = 0;
                    }
                }
                maxConsecutiveOffBlock = Math.max(maxConsecutiveOffBlock, consecutiveOffDays);

                if (rule.type === 'MIN_OFF_DAYS_IN_PERIOD' && offDaysInWindow < requiredDays) {
                     errors[currentDateStr] = `(has ${offDaysInWindow} of ${requiredDays})`;
                }
                else if (rule.type === 'MIN_CONSECUTIVE_OFF_DAYS_IN_PERIOD' && maxConsecutiveOffBlock < requiredConsecutive) {
                     errors[currentDateStr] = `(longest block is ${maxConsecutiveOffBlock} of ${requiredConsecutive})`;
                }
            }
            break;
        }
    }
    return errors;
};


/**
 * Validates the roster. If targetStaffId is provided, it only re-validates that specific person
 * for improved UI performance during high-speed data entry.
 */
export const dynamicValidateRoster = (
    rosterData: RosterData,
    staff: Staff[],
    dutyCodes: ShiftCodeDefinition[],
    rules: ValidationRule[],
    targetStaffId?: string
): RosterData => {
    if (!rules || rules.length === 0) return rosterData;

    const newRosterData = JSON.parse(JSON.stringify(rosterData));
    const sortedDates = Object.keys(newRosterData).sort();
    
    // Determine the set of staff members to validate
    const staffToValidate = targetStaffId 
        ? staff.filter(s => s.id === targetStaffId)
        : staff;

    // Clear previous violations for ONLY the staff being validated
    for (const date of sortedDates) {
        staffToValidate.forEach(person => {
            if (newRosterData[date]?.[person.id]) {
                delete newRosterData[date][person.id].violation;
            }
        });
    }

    staffToValidate.forEach(person => {
        rules.forEach(rule => {
            const ruleErrors = applyRule(rule, person, sortedDates, newRosterData, dutyCodes);

            Object.entries(ruleErrors).forEach(([date, detail]) => {
                if (!newRosterData[date]) newRosterData[date] = {};
                if (!newRosterData[date][person.id]) newRosterData[date][person.id] = { dutyCodeId: '' };
                
                const entry = newRosterData[date][person.id];
                if (!entry.violation) {
                    entry.violation = formatErrorMessage(rule.errorMessage, rule.params) + ` ${detail}`;
                }
            });
        });
    });

    return newRosterData;
};
