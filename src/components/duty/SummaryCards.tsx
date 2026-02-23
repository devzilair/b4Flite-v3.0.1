
import React from 'react';
import { FTLMetrics, FTL_LIMITS } from '@/services/ftlCalculations';

interface SummaryCardsProps {
    monthlyDutyHours: number;
    monthlyFlightHours: number;
    endOfMonthTotals: FTLMetrics | null;
}

const SummaryCard: React.FC<{ title: string; value: string; progress?: number; limit?: number }> = ({ title, value, progress, limit }) => (
    <div className="bg-gray-50 dark:bg-gray-700/50 p-2 sm:p-4 rounded-lg shadow min-w-[140px] sm:min-w-[200px] flex-shrink-0 md:min-w-0 md:flex-shrink snap-start border border-gray-100 dark:border-gray-600">
        <h3 className="text-[10px] sm:text-sm font-medium text-gray-500 dark:text-gray-400 truncate uppercase tracking-wider">{title}</h3>
        <div className="flex items-end gap-1 mt-0.5 sm:mt-1">
            <p className="text-xl sm:text-3xl font-semibold text-gray-900 dark:text-white leading-none">{value}</p>
            {limit !== undefined && <span className="text-[10px] sm:text-xs text-gray-400 mb-0.5">/ {limit}</span>}
        </div>
        {progress !== undefined && limit !== undefined && (
            <div className="w-full bg-gray-200 rounded-full h-1.5 sm:h-2.5 dark:bg-gray-600 mt-1.5 sm:mt-2">
                <div
                    className={`${progress >= 100 ? 'bg-status-danger' : progress >= 80 ? 'bg-status-warning' : 'bg-brand-primary'} h-1.5 sm:h-2.5 rounded-full transition-all duration-500`}
                    style={{ width: `${Math.min(progress, 100)}%` }}
                ></div>
            </div>
        )}
    </div>
);


const SummaryCards: React.FC<SummaryCardsProps> = ({ monthlyDutyHours, monthlyFlightHours, endOfMonthTotals }) => {

    const dutyLimit28 = {
        value: endOfMonthTotals?.dutyTime28d || 0,
        limit: FTL_LIMITS.dutyTime28d,
        percentage: endOfMonthTotals ? (endOfMonthTotals.dutyTime28d / FTL_LIMITS.dutyTime28d * 100) : 0,
    };

    const flightLimit28 = {
        value: endOfMonthTotals?.flightTime28d || 0,
        limit: FTL_LIMITS.flightTime28d,
        percentage: endOfMonthTotals ? (endOfMonthTotals.flightTime28d / FTL_LIMITS.flightTime28d * 100) : 0,
    };

    return (
        <div className="flex overflow-x-auto pb-1 sm:pb-2 gap-2 sm:gap-4 md:grid md:grid-cols-2 lg:grid-cols-4 md:gap-6 mb-1 sm:mb-4 snap-x snap-mandatory scrollbar-hide">
            <SummaryCard
                title="Duty (Month)"
                value={monthlyDutyHours.toFixed(1)}
            />
            <SummaryCard
                title="Flight (Month)"
                value={monthlyFlightHours.toFixed(1)}
            />
            <SummaryCard
                title="28D Duty"
                value={dutyLimit28.value.toFixed(1)}
                progress={dutyLimit28.percentage}
                limit={dutyLimit28.limit}
            />
            <SummaryCard
                title="28D Flight"
                value={flightLimit28.value.toFixed(1)}
                progress={flightLimit28.percentage}
                limit={flightLimit28.limit}
            />
        </div>
    );
};

export default SummaryCards;
