'use client';

import React from 'react';
import { usePermissions } from '@/hooks/usePermissions';

const Table: React.FC<{ headers: string[], data: (string | number)[][], fullWidth?: boolean }> = ({ headers, data, fullWidth = false }) => (
    <div className="overflow-x-auto my-4">
        <table className={`min-w-full divide-y divide-gray-200 dark:divide-gray-600 border border-gray-300 dark:border-gray-600 ${fullWidth ? 'w-full' : ''}`}>
            <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                    {headers.map((header, i) => (
                        <th key={i} scope="col" className="px-4 py-2 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider border-b border-gray-300 dark:border-gray-600">
                            {header}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-600">
                {data.map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        {row.map((cell, j) => (
                            <td key={j} className="px-4 py-2 whitespace-nowrap text-sm text-gray-800 dark:text-gray-200 border-r border-gray-200 dark:border-gray-600 last:border-r-0">
                                {cell}
                            </td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);

const Note: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="my-4 p-4 bg-yellow-100 dark:bg-yellow-900/30 border-l-4 border-yellow-500 text-yellow-800 dark:text-yellow-200">
        <p className="font-bold">Note:</p>
        <div className="text-sm">{children}</div>
    </div>
);

const CalculationLogicPage: React.FC = () => {
    const { currentUser, can } = usePermissions();
    const canAccess = can('roster:view:all') || currentUser?.departmentId === 'dept_pilots';

    if (!canAccess) {
        return (
            <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-xl text-center">
                <h1 className="text-2xl font-bold text-status-danger">Access Denied</h1>
                <p className="mt-2 text-gray-600 dark:text-gray-300">
                    This page is only available to pilots and administrators.
                </p>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-gray-800 p-6 sm:p-8 rounded-lg shadow-xl max-w-5xl mx-auto">
            <h1 className="text-4xl font-bold text-center mb-2 text-brand-primary dark:text-brand-light">Zil Air Operations Manual</h1>
            <p className="text-center text-lg text-gray-600 dark:text-gray-400 mb-8">Part A: System Implementation</p>

            <section className="mb-8">
                <h2 className="text-2xl font-bold border-b-2 border-brand-primary pb-2 mb-4">1.0 General Principles</h2>
                <p>The system validates duty records against a set of rules based on the pilot's primary category (Helicopter or Aeroplane) and the duty start time. If a rule is broken, a warning icon appears next to the entry.</p>
                <ul className="list-disc pl-6 mt-2 space-y-1">
                    <li><span className="font-semibold text-status-warning">🔺 for minor violations</span> (e.g., exceeding 7-day FDP).</li>
                    <li><span className="font-semibold text-status-danger">🔺 for major violations</span> (e.g., exceeding daily flight time).</li>
                </ul>
                <p className="mt-2">Entries can be saved with violations, but they are flagged for review. All validations are recalculated whenever the flight log is loaded or a record is modified.</p>
            </section>

            <section className="mb-8">
                <h2 className="text-2xl font-bold border-b-2 border-brand-primary pb-2 mb-4">2.0 Daily Limitations</h2>

                <h3 className="text-xl font-semibold mt-6 mb-2">2.1 Helicopter (Rotor Wing) Daily Rules</h3>
                <p>The following tables outline the maximum Flight Duty Period (FDP) and Flight Time based on the local time of duty start and crew composition.</p>
                <h4 className="font-bold mt-4">Table C: Two-Pilot Operations</h4>
                <Table headers={["Local Time of Start", "Max. FDP (Hours)", "Max. Flight Time (Hours)"]} data={[
                    ["06:00 - 06:59", 10, 7],
                    ["07:00 - 07:59", 11, 8],
                    ["08:00 - 13:59", 12, 8],
                    ["14:00 - 21:59", 11, 7],
                    ["22:00 - 05:59", 9, 6],
                ]} />
                <h4 className="font-bold mt-4">Table C: Single-Pilot Operations</h4>
                <Table headers={["Local Time of Start", "Max. FDP (Hours)", "Max. Flight Time (Hours)"]} data={[
                    ["06:00 - 06:59", 9, 6],
                    ["07:00 - 07:59", 10, 7],
                    ["08:00 - 13:59", 10, 7],
                    ["14:00 - 21:59", 9, 6],
                    ["22:00 - 05:59", 8, 5],
                ]} />

                <h3 className="text-xl font-semibold mt-8 mb-2">2.2 Aeroplane (Fixed Wing) Daily Rules</h3>
                <p>Maximum FDP is determined by the duty start time and number of sectors flown, as shown below.</p>
                <h4 className="font-bold mt-4">Table A: Two Flight Crew - Acclimatised (Max FDP in Hours)</h4>
                <Table fullWidth headers={["Local time of start", "1 Sector", "2", "3", "4", "5", "6", "7", "8+"]} data={[
                    ["06:00 - 06:59", 13, "12 ¾", "12 ½", "11 ¾", "10 ½", "9 ½", 9, 9],
                    ["07:00 - 12:59", 14, "13 ¼", "12 ½", "11 ½", 11, "10 ½", 10, "9 ½"],
                    ["13:00 - 17:59", 13, "12 ¾", "11 ½", "10 ¾", "10", "9 ½", 9, 9],
                    ["18:00 - 21:59", 12, "11 ¾", "10 ½", "9 ¾", 9, 9, 9, 9],
                    ["22:00 - 05:59", 11, "10 ¾", "9 ½", 9, 9, 9, 9, 9],
                ]} />
                <h4 className="font-bold mt-4">Table: Single-Pilot Operations (Max FDP in Hours)</h4>
                <Table headers={["Local time of start", "Up to 4 Sectors", "5", "6", "7", "8 or more"]} data={[
                    ["06:00 - 06:59", 10, "9 ½", "8 ½", 8, 8],
                    ["07:00 - 12:59", 11, "10", "9 ½", "8 ¾", 8],
                    ["13:00 - 17:59", 10, 9, "8 ¾", 8, 8],
                    ["18:00 - 21:59", 9, "8 ¾", "8 ½", 8, 8],
                    ["22:00 - 05:59", 8, 8, 8, 8, 8],
                ]} />
            </section>

            <section className="mb-8">
                <h2 className="text-2xl font-bold border-b-2 border-brand-primary pb-2 mb-4">3.0 Special Duty Considerations</h2>
                <Note>
                    <p><span className="font-bold">On FDP Calculation:</span> For split duties, the total FDP is calculated from the start of the first FDP segment to the end of the last FDP segment, inclusive of the break period.</p>
                </Note>

                <h3 className="text-xl font-semibold mt-6 mb-2">3.1 Extension of FDP by Split Duty (Helicopter)</h3>
                <p>A helicopter FDP may be extended if a break is taken on the ground. At least one sector must be flown before the extension is permitted. The extension is calculated as follows:</p>
                <Table headers={["Consecutive Hours Rest", "Maximum Extension of the FDP"]} data={[
                    ["Less than 2", "Nil"],
                    ["2 to 3 hours", "1 hour"],
                    ["Greater than 3 hours", "A period equal to half of the consecutive hours rest taken."],
                ]} />
                <Note>The rest period used for calculation shall not include the minimum total of <span className="font-bold">30 minutes allowed</span> for immediate post-flight and pre-flight duties.</Note>

                <h3 className="text-xl font-semibold mt-6 mb-2">3.2 Extension of FDP by Split Duty (Aeroplane)</h3>
                <p>When an FDP consists of two or more sectors and is separated by a break of less than a minimum rest period, the FDP may be extended as follows:</p>
                <Table headers={["Consecutive Hours Rest", "Maximum Extension of the FDP"]} data={[
                    ["Less than 3", "Nil"],
                    ["3 hours or more", "A period equal to half the consecutive hours rest taken."],
                ]} />
                <Note>The rest period used for calculation shall not include the time allowed for post-flight and pre-flight duties (a minimum total of 30 minutes is subtracted from the break). For example, a 4-hour break on the ground provides a 3.5-hour effective rest, yielding a 1.75-hour FDP extension.</Note>

                <h3 className="text-xl font-semibold mt-6 mb-2">3.3 Disruptive Duties (Helicopter Only)</h3>
                <p>To prevent fatigue from working during the Window of Circadian Low (WOCL), defined as <span className="font-bold">01:00 to 06:59 local time</span>, the following rules apply to any duty that touches this period:</p>
                <ul className="list-disc pl-6 mt-2 space-y-1">
                    <li>Not more than <span className="font-bold">3 consecutive</span> disruptive duties can be undertaken.</li>
                    <li>Not more than <span className="font-bold">4 such duties</span> may occur in any 7 consecutive days.</li>
                    <li>A run of consecutive disruptive duties can only be broken by a period of at least <span className="font-bold">34 consecutive hours</span> free from such duties. This 34-hour period may include a normal duty that is not disruptive.</li>
                </ul>

                <h3 className="text-xl font-semibold mt-6 mb-2">3.4 Standby Limitations</h3>
                <p>The system treats Standby duties according to Home Standby provisions.</p>
                <ul className="list-disc pl-6 mt-2 space-y-1">
                    <li>**Max Duration:** A single standby period cannot exceed **12 hours**.</li>
                    <li>**Call Out:** If called out for flight duty, the Maximum FDP limit is derived using the **Standby Start Time** as the reference start time in the FDP tables. However, the FDP duration itself counts from the Report Time.</li>
                    <li>**Cumulative Totals:** Standby hours count as **50%** towards weekly and monthly cumulative duty limits (e.g. 12 hours of standby adds 6 hours to your 7-day total).</li>
                </ul>
            </section>

            <section className="mb-8">
                <h2 className="text-2xl font-bold border-b-2 border-brand-primary pb-2 mb-4">4.0 Days Off & Rest Scheme</h2>
                <p>The system performs a series of checks on rest days and duty cycles. These checks look at historical data to ensure compliance over time.</p>

                <h3 className="text-xl font-semibold mt-6 mb-2">4.1 General Rules (Both Categories)</h3>
                <ul className="list-disc pl-6 mt-2 space-y-1">
                    <li><span className="font-bold">Minimum Rest Period:</span> The rest period between consecutive duties must be at least <span className="font-bold">12 hours</span>, or the length of the preceding duty period, whichever is greater.</li>
                    <li><span className="font-bold">Maximum Consecutive Duty:</span> A pilot must not be on duty for more than <span className="font-bold">7 consecutive days</span> between days off.</li>
                </ul>

                <h3 className="text-xl font-semibold mt-6 mb-2">4.2 Helicopter Specifics</h3>
                <ul className="list-disc pl-6 mt-2 space-y-1">
                    <li>A single day off must last at least <span className="font-bold">36 hours</span> and include two local nights.</li>
                    <li>Following <span className="font-bold">7 consecutive days</span> of duty, a pilot must have at least <span className="font-bold">2 consecutive days off</span>. A single day off is not permitted.</li>
                    <li>In any 14 consecutive days, a pilot must have at least <span className="font-bold">3 days off</span>, which must include a block of at least <span className="font-bold">2 consecutive days off</span>.</li>
                    <li>In any 28 consecutive days, a pilot must have a minimum of <span className="font-bold">7 days off</span>.</li>
                    <li>Over any 12-week period, a pilot must have an average of at least <span className="font-bold">8 days off</span> in each 4-week period.</li>
                </ul>

                <h3 className="text-xl font-semibold mt-6 mb-2">4.3 Aeroplane Specifics</h3>
                <ul className="list-disc pl-6 mt-2 space-y-1">
                    <li>A single day off must last at least <span className="font-bold">34 hours</span> and include two local nights.</li>
                    <li>In any 14 consecutive days following a previous block of 2 days off, a pilot must have at least <span className="font-bold">2 consecutive days off</span>.</li>
                    <li>In any 28 consecutive days, a pilot must have a minimum of <span className="font-bold">7 days off</span>.</li>
                    <li>Over any 12-week period, a pilot must have an average of at least <span className="font-bold">8 days off</span> in each 4-week period.</li>
                </ul>
            </section>

            <section>
                <h2 className="text-2xl font-bold border-b-2 border-brand-primary pb-2 mb-4">5.0 Cumulative & Rolling Totals</h2>
                <p>These totals are calculated automatically for each log entry by summing up the relevant values over the preceding period.</p>

                <h3 className="text-xl font-semibold mt-6 mb-2">5.1 Absolute limits on flying hours</h3>
                <h4 className="font-bold mt-2">Aeroplanes</h4>
                <ul className="list-disc pl-6 mt-2 space-y-1">
                    <li><span className="font-bold">100 hours</span> in any 28 consecutive days.</li>
                    <li><span className="font-bold">900 hours</span> in any 12 consecutive months.</li>
                </ul>
                <h4 className="font-bold mt-2">Helicopters</h4>
                <ul className="list-disc pl-6 mt-2 space-y-1">
                    <li><span className="font-bold">90 hours</span> in any 28 consecutive days.</li>
                    <li><span className="font-bold">800 hours</span> in any 12 consecutive months.</li>
                    <li><span className="font-bold">18 hours</span> in any 3 consecutive days.</li>
                    <li><span className="font-bold">30 hours</span> in any 7 consecutive days.</li>
                    <li><span className="font-bold">240 hours</span> in any 3 consecutive 28-day periods.</li>
                </ul>

                <h3 className="text-xl font-semibold mt-6 mb-2">5.2 Cumulative duty hours</h3>
                <h4 className="font-bold mt-2">Aeroplanes</h4>
                <ul className="list-disc pl-6 mt-2 space-y-1">
                    <li><span className="font-bold">55 hours</span> in any 7 consecutive days.</li>
                    <li><span className="font-bold">95 hours</span> in any 14 consecutive days.</li>
                    <li><span className="font-bold">190 hours</span> in any 28 consecutive days.</li>
                </ul>
                <h4 className="font-bold mt-2">Helicopters</h4>
                <ul className="list-disc pl-6 mt-2 space-y-1">
                    <li><span className="font-bold">60 hours</span> in any 7 consecutive days.</li>
                    <li><span className="font-bold">190 hours</span> in any 28 consecutive days.</li>
                </ul>
            </section>
            <div className="mt-8 text-center border-t pt-4 dark:border-gray-600">
                <a href="#/duty" className="text-brand-primary hover:underline">&larr; Back to Duty Log</a>
            </div>
        </div>
    );
};

export default CalculationLogicPage;
