
import React, { useState, useRef } from 'react';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import { getErrorMessage } from '../../utils/sanitization';
import { toCamelCase, toSnakeCase } from '../../services/api';

// Helper to deep replace values AND KEYS in an object/array (for ID remapping during restore)
const deepReplace = (obj: any, oldVal: string, newVal: string): any => {
    if (obj === null || typeof obj !== 'object') {
        return obj === oldVal ? newVal : obj;
    }
    
    if (Array.isArray(obj)) {
        return obj.map(v => deepReplace(v, oldVal, newVal));
    }
    
    const newObj: any = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            // Replace KEY if it matches (Critical for JSONB dictionaries like flightHoursByAircraft)
            const newKey = key === oldVal ? newVal : key;
            
            // Recursively replace VALUE
            const val = obj[key];
            newObj[newKey] = deepReplace(val, oldVal, newVal);
        }
    }
    return newObj;
};

// Helper to validate UUID format
const isValidUuid = (id: any) => {
    if (typeof id !== 'string') return false;
    const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return regex.test(id);
};

const BackupTab: React.FC = () => {
    const { user } = useAuth();
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const [isRestoring, setIsRestoring] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [restoreLogs, setRestoreLogs] = useState<string[]>([]);
    const [progress, setProgress] = useState(0);

    const log = (msg: string) => {
        setRestoreLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
    };

    // Generic fetcher for raw table data
    const fetchTable = async (table: string) => {
        const { data, error } = await supabase.from(table).select('*');
        if (error) throw new Error(`Failed to fetch ${table}: ${error.message}`);
        return toCamelCase(data || []);
    };

    const handleExport = async () => {
        setIsExporting(true);
        try {
            // Parallel fetch for speed
            // We fetch EVERYTHING directly from DB to ensure no windowing/filtering limits apply
            const [
                staff, departments, roles,
                departmentSettings, leaveTypes, publicHolidays, customFieldDefs,
                validationRuleSets, rosterViewTemplates, qualificationTypes,
                aircraftTypes, licenseTypes, specialQualifications,
                checklistTemplates, leaveRequests, leaveTransactions,
                fsiDocuments, fsiAcks, exams, questions, examAttempts,
                flightLogRecords, flightHoursAdjustments,
                rosters, rosterMetadata, dutySwaps,
                employeeGoals, performanceTemplates, performanceReviews,
                lunchMenus, lunchOrders
            ] = await Promise.all([
                fetchTable('staff'), fetchTable('departments'), fetchTable('roles'),
                fetchTable('department_settings'), fetchTable('leave_types'), fetchTable('public_holidays'), fetchTable('custom_field_definitions'),
                fetchTable('validation_rule_sets'), fetchTable('roster_view_templates'), fetchTable('qualification_types'),
                fetchTable('aircraft_types'), fetchTable('license_types'), fetchTable('special_qualifications'),
                fetchTable('checklist_templates'), fetchTable('leave_requests'), fetchTable('leave_transactions'),
                fetchTable('fsi_documents'), fetchTable('fsi_acknowledgments'), fetchTable('exams'), fetchTable('questions'), fetchTable('exam_attempts'),
                fetchTable('flight_log_records'), fetchTable('flight_hours_adjustments'),
                fetchTable('rosters'), fetchTable('roster_metadata'), fetchTable('duty_swaps'),
                fetchTable('employee_goals'), fetchTable('performance_templates'), fetchTable('performance_reviews'),
                fetchTable('lunch_menus'), fetchTable('lunch_orders')
            ]);

            const backupPayload = {
                timestamp: new Date().toISOString(),
                version: "1.8", // Version 1.8 indicates direct-DB fetch structure
                exportedBy: user?.email || "Admin",
                data: {
                    // Identity
                    staff, departments, roles,
                    // Settings
                    departmentSettings, leaveTypes, publicHolidays, customFieldDefs,
                    validationRuleSets, rosterViewTemplates, qualificationTypes, 
                    aircraftTypes, licenseTypes, specialQualifications,
                    // Modules
                    checklistTemplates, leaveRequests, leaveTransactions,
                    fsiDocuments, fsiAcks, exams, questions, examAttempts,
                    flightLogRecords, flightHoursAdjustments, 
                    rosters, rosterMetadata, dutySwaps,
                    employeeGoals, performanceTemplates, performanceReviews,
                    lunchMenus, lunchOrders,
                }
            };

            const jsonString = JSON.stringify(backupPayload, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `b4flite_backup_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

        } catch (error: any) {
            console.error(error);
            alert(`Export failed: ${error.message}`);
        } finally {
            setIsExporting(false);
        }
    };

    // List of tables where RLS failures should be warnings, not errors (System config tables)
    const SYSTEM_TABLES = [
        'roles', 'roster_view_templates', 'validation_rule_sets', 
        'custom_field_definitions', 'checklist_templates', 'public_holidays', 'leave_types',
        'qualification_types', 'aircraft_types', 'license_types', 'special_qualifications'
    ];

    // List of tables that MUST utilize UUIDs for their 'id' column
    const UUID_PK_TABLES = [
        'flight_log_records', 'exam_attempts', 'fsi_acknowledgments', 'audit_logs'
    ];

    const safeUpsert = async (table: string, data: any[]) => {
        if (!data || data.length === 0) return;
        log(`Restoring ${data.length} records to '${table}'...`);
        
        // Sanitize: Strip system timestamps that typically don't exist in the target schema
        let cleanData = data.map((item: any) => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { created_at, updated_at, ...rest } = item;
            
            // HOTFIX: Remove 'type' column from fsi_documents if present (legacy column causing restore failure)
            if (table === 'fsi_documents') {
                delete rest.type;
            }

            // HOTFIX: Clean flight_log_records
            if (table === 'flight_log_records') {
                delete rest.signature_url; // Legacy field
                // Remap deprecated 'notes' to 'remarks' if present
                if (rest.notes !== undefined) {
                    if (!rest.remarks) {
                        rest.remarks = rest.notes;
                    }
                    delete rest.notes;
                }
            }

            // UUID Sanitization: If table requires UUID PK but value is invalid (e.g. "fd_123"), remove it
            // This allows the database to auto-generate a valid UUID.
            if (UUID_PK_TABLES.includes(table)) {
                if (rest.id && !isValidUuid(rest.id)) {
                    delete rest.id;
                }
            }

            return rest;
        });
        
        // HOTFIX: Clean duty_swaps (Filter invalid dates)
        if (table === 'duty_swaps') {
            const originalCount = cleanData.length;
            cleanData = cleanData.filter((item: any) => {
                // Ensure date exists and looks like YYYY-MM-DD
                const isValidDate = item.date && /^\d{4}-\d{2}-\d{2}$/.test(item.date);
                if (!isValidDate) {
                     console.warn('Skipping invalid duty_swap record:', item);
                }
                return isValidDate;
            });
            if (cleanData.length < originalCount) {
                log(`  -> Skipped ${originalCount - cleanData.length} invalid duty_swap records (malformed date).`);
            }
        }

        // Process in chunks of 1000 to avoid payload limits
        const chunkSize = 1000;
        for (let i = 0; i < cleanData.length; i += chunkSize) {
            const chunk = cleanData.slice(i, i + chunkSize);
            const { error } = await supabase.from(table).upsert(chunk);
            if (error) {
                if (error.code === '42501') {
                    if (SYSTEM_TABLES.includes(table)) {
                        log(`⚠️ Permission denied for '${table}'. Skipping (System table).`);
                    } else {
                        log(`❌ Permission denied for critical table '${table}'. Restore will likely fail.`);
                        throw new Error(`Permission denied for ${table}. Ensure you have admin rights.`);
                    }
                } else {
                    console.error(`Error upserting ${table}:`, error);
                    if (error.message && error.message.includes("column") && error.message.includes("not found")) {
                        throw new Error(`Schema mismatch in '${table}': ${error.message}.`);
                    }
                    throw new Error(`Failed to restore ${table}: ${error.message}`);
                }
            }
        }
    };

    const remapIdInBackup = (backupData: any, oldId: string, newId: string) => {
        if (backupData.staff) {
            backupData.staff = backupData.staff.map((s: any) => s.id === oldId ? { ...s, id: newId } : s);
        }
        
        // General remapping for all other tables referencing this ID
        // Note: We use deepReplace to handle nested objects, arrays, and KEYS in JSONB
        backupData.departments = deepReplace(backupData.departments, oldId, newId);
        backupData.roles = deepReplace(backupData.roles, oldId, newId);
        backupData.leaveRequests = deepReplace(backupData.leaveRequests, oldId, newId);
        backupData.leaveTransactions = deepReplace(backupData.leaveTransactions, oldId, newId);
        backupData.flightLogRecords = deepReplace(backupData.flightLogRecords, oldId, newId);
        backupData.flightHoursAdjustments = deepReplace(backupData.flightHoursAdjustments, oldId, newId); 
        backupData.fsiDocuments = deepReplace(backupData.fsiDocuments, oldId, newId); 
        backupData.fsiAcks = deepReplace(backupData.fsiAcks, oldId, newId);
        backupData.examAttempts = deepReplace(backupData.examAttempts, oldId, newId);
        backupData.employeeGoals = deepReplace(backupData.employeeGoals, oldId, newId);
        backupData.performanceReviews = deepReplace(backupData.performanceReviews, oldId, newId);
        backupData.lunchOrders = deepReplace(backupData.lunchOrders, oldId, newId);
        backupData.lunchMenus = deepReplace(backupData.lunchMenus, oldId, newId); 
        backupData.departmentSettings = deepReplace(backupData.departmentSettings, oldId, newId);
        backupData.dutySwaps = deepReplace(backupData.dutySwaps, oldId, newId);

        // Special handling for Roster keys
        if (backupData.rosters) {
            // New format (Array) handling
            if (Array.isArray(backupData.rosters)) {
                backupData.rosters = backupData.rosters.map((r: any) => {
                    if (r.departmentId === oldId) r.departmentId = newId;
                    r.rosterData = deepReplace(r.rosterData, oldId, newId);
                    return r;
                });
            } else {
                // Legacy format (Object) handling
                Object.keys(backupData.rosters).forEach(monthKey => {
                    const monthData = backupData.rosters[monthKey];
                    // Check if oldId is a department ID key in the month object
                    if (monthData[oldId]) {
                        monthData[newId] = monthData[oldId];
                        delete monthData[oldId];
                    }
                    
                    // Recursively fix values inside the rosters
                    backupData.rosters[monthKey] = deepReplace(monthData, oldId, newId);
                });
            }
        }
    };

    const reconcileEntitiesByName = async (data: any, tableName: string, dataKey: string, nameField: string = 'name') => {
        if (!data[dataKey]) return;
        
        log(`Reconciling ${tableName}...`);
        const { data: liveEntities } = await supabase.from(tableName).select(`id, ${nameField}`);
        const liveMap = new Map();
        if (liveEntities) {
            liveEntities.forEach((e: any) => {
                if (e[nameField]) liveMap.set(e[nameField].toString().toLowerCase(), e.id);
            });
        }

        let count = 0;
        for (const backupEntity of data[dataKey]) {
            if (!backupEntity[nameField]) continue;
            const name = backupEntity[nameField].toString().toLowerCase();
            const liveId = liveMap.get(name);
            
            // If match found but IDs differ, remap EVERYTHING to the live ID
            if (liveId && liveId !== backupEntity.id) {
                // Remap this ID globally in the backup data
                remapIdInBackup(data, backupEntity.id, liveId);
                // Also update the ID in the specific entity object to ensure the upsert targets the existing row
                backupEntity.id = liveId;
                count++;
            }
        }
        if (count > 0) log(`  -> Remapped ${count} ${tableName} ID(s) to match local DB.`);
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!window.confirm("WARNING: You are about to restore data from a backup.\n\n- Matching IDs will be overwritten.\n- Staff logins will be disconnected to maintain integrity.\n\nContinue?")) {
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        setIsRestoring(true);
        setRestoreLogs([]);
        setProgress(0);

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const json = JSON.parse(event.target?.result as string);
                const data = json.data;
                
                if (!data) throw new Error("Invalid backup file format.");

                log("Analyzing backup structure & Reconciling IDs...");

                // 1. Reconcile Reference Tables by Name to avoid Unique Constraint errors
                await reconcileEntitiesByName(data, 'roles', 'roles');
                await reconcileEntitiesByName(data, 'departments', 'departments');
                await reconcileEntitiesByName(data, 'leave_types', 'leaveTypes');
                await reconcileEntitiesByName(data, 'aircraft_types', 'aircraftTypes');
                await reconcileEntitiesByName(data, 'qualification_types', 'qualificationTypes', 'code'); // Match Quals by Code
                await reconcileEntitiesByName(data, 'license_types', 'licenseTypes'); // Added in v55.11.1
                await reconcileEntitiesByName(data, 'special_qualifications', 'specialQualifications'); // Added in v55.11.1
                
                // 2. Reconcile Staff by Email
                const { data: liveStaffList } = await supabase.from('staff').select('id, email');
                const liveEmailMap = new Map();
                if (liveStaffList) {
                    liveStaffList.forEach((s: any) => {
                        if (s.email) liveEmailMap.set(s.email.toLowerCase(), s);
                    });
                }

                let remappedStaffCount = 0;
                if (data.staff) {
                    for (const backupStaff of data.staff) {
                        if (!backupStaff.email) continue;
                        const email = backupStaff.email.toLowerCase();
                        const liveStaff = liveEmailMap.get(email);
                        if (liveStaff && liveStaff.id !== backupStaff.id) {
                            remapIdInBackup(data, backupStaff.id, liveStaff.id);
                            // Explicitly update the object in the array as well
                            backupStaff.id = liveStaff.id;
                            remappedStaffCount++;
                        }
                    }
                }
                if (remappedStaffCount > 0) log(`  -> Reconciled ${remappedStaffCount} user ID(s).`);

                log("Starting restore...");

                // 3. Restore Independent Tables
                await safeUpsert('roles', toSnakeCase(data.roles));
                await safeUpsert('leave_types', toSnakeCase(data.leaveTypes));
                await safeUpsert('public_holidays', toSnakeCase(data.publicHolidays));
                await safeUpsert('custom_field_definitions', toSnakeCase(data.customFieldDefs));
                await safeUpsert('validation_rule_sets', toSnakeCase(data.validationRuleSets));
                await safeUpsert('roster_view_templates', toSnakeCase(data.rosterViewTemplates));
                await safeUpsert('checklist_templates', toSnakeCase(data.checklistTemplates));
                await safeUpsert('qualification_types', toSnakeCase(data.qualificationTypes));
                await safeUpsert('aircraft_types', toSnakeCase(data.aircraftTypes));
                await safeUpsert('license_types', toSnakeCase(data.licenseTypes));
                await safeUpsert('special_qualifications', toSnakeCase(data.specialQualifications));
                setProgress(20);

                // 4. Departments Pass 1 (Structure)
                if (data.departments) {
                    const depts = toSnakeCase(data.departments).map((d: any) => ({ ...d, manager_id: null }));
                    await safeUpsert('departments', depts);
                }

                // 5. Staff (Nullify Auth IDs for stability)
                if (data.staff) {
                    const staffData = toSnakeCase(data.staff).map((s: any) => {
                        if (user && s.id && liveEmailMap.get(user.email?.toLowerCase())?.id === s.id) {
                            return { ...s, auth_id: user.id };
                        }
                        return { ...s, auth_id: null };
                    });
                    await safeUpsert('staff', staffData);
                }
                setProgress(45);

                // 6. Departments Pass 2 (Managers)
                if (data.departments) {
                    await safeUpsert('departments', toSnakeCase(data.departments));
                }
                
                // 7. Settings
                if (data.departmentSettings) {
                    // Handle array or object structure for settings
                    let settingsList = [];
                    if (Array.isArray(data.departmentSettings)) {
                        settingsList = data.departmentSettings;
                    } else {
                        // Legacy object support
                        settingsList = Object.entries(data.departmentSettings).map(([deptId, settings]: [string, any]) => ({
                            department_id: deptId,
                            ...settings
                        }));
                    }
                    
                    const settingsRows = settingsList.map((settings: any) => {
                        const sc = toSnakeCase(settings);
                        // Ensure department_id is set (might be implicitly from key in legacy format)
                        const deptId = sc.department_id;
                        
                        return {
                            department_id: deptId,
                            roster_settings: sc.roster_settings,
                            shift_codes: sc.shift_codes,
                            max_concurrent_leave: sc.max_concurrent_leave,
                            leave_accrual_policies: sc.leave_accrual_policies,
                            pilot_roster_layout: sc.pilot_roster_layout,
                            pilot_roster_settings: sc.pilot_roster_settings
                        };
                    });
                    await safeUpsert('department_settings', settingsRows);
                }
                setProgress(60);

                // 8. Rosters
                if (data.rosters) {
                    const rosterRows: any[] = [];
                    // Check if format is nested object (Month -> Dept -> Data) or Array
                    if (Array.isArray(data.rosters)) {
                         // Modern/Direct array of rows
                         data.rosters.forEach((r: any) => rosterRows.push(toSnakeCase(r)));
                    } else {
                        // Legacy Nested Object
                        Object.entries(data.rosters).forEach(([monthKey, deptMap]: [string, any]) => {
                            Object.entries(deptMap).forEach(([deptId, rosterData]) => {
                                rosterRows.push({ month_key: monthKey, department_id: deptId, roster_data: rosterData });
                            });
                        });
                    }
                    await safeUpsert('rosters', rosterRows);
                }
                
                if (data.rosterMetadata) {
                    const metaRows = Array.isArray(data.rosterMetadata) 
                        ? toSnakeCase(data.rosterMetadata)
                        : Object.entries(data.rosterMetadata).map(([id, meta]) => ({ id, metadata: toSnakeCase(meta) }));
                    await safeUpsert('roster_metadata', metaRows);
                }
                setProgress(75);

                // 9. Operations & Logs
                await safeUpsert('flight_log_records', toSnakeCase(data.flightLogRecords));
                await safeUpsert('flight_hours_adjustments', toSnakeCase(data.flightHoursAdjustments));
                await safeUpsert('leave_requests', toSnakeCase(data.leaveRequests));
                await safeUpsert('leave_transactions', toSnakeCase(data.leaveTransactions));
                await safeUpsert('fsi_documents', toSnakeCase(data.fsiDocuments));
                await safeUpsert('fsi_acknowledgments', toSnakeCase(data.fsiAcks));
                await safeUpsert('questions', toSnakeCase(data.questions));
                await safeUpsert('exams', toSnakeCase(data.exams));
                await safeUpsert('exam_attempts', toSnakeCase(data.examAttempts));
                await safeUpsert('duty_swaps', toSnakeCase(data.dutySwaps));
                
                // 10. HR & Lunch
                await safeUpsert('employee_goals', toSnakeCase(data.employeeGoals));
                await safeUpsert('performance_templates', toSnakeCase(data.performanceTemplates));
                await safeUpsert('performance_reviews', toSnakeCase(data.performanceReviews));
                await safeUpsert('lunch_menus', toSnakeCase(data.lunchMenus));
                await safeUpsert('lunch_orders', toSnakeCase(data.lunchOrders));
                
                setProgress(100);
                log("Restore complete.");
                alert("Restore successful. The page will now reload.");
                window.location.reload();

            } catch (error: any) {
                console.error(error);
                log(`❌ ERROR: ${getErrorMessage(error)}`);
                alert(`Restore failed: ${getErrorMessage(error)}`);
            } finally {
                setIsRestoring(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        reader.readAsText(file);
    };

    return (
        <div className="space-y-8">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border dark:border-gray-700">
                <h2 className="text-xl font-bold mb-4">1. Export Snaphot</h2>
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                    Download a complete Snapshot of the database. This includes <strong>all historical data</strong> (Flight Logs, Rosters, etc.) directly from the server.
                </p>
                <button 
                    onClick={handleExport}
                    disabled={isRestoring || isExporting}
                    className="bg-brand-primary text-white font-bold py-3 px-6 rounded-md hover:bg-brand-secondary flex items-center gap-2 disabled:opacity-50"
                >
                     {isExporting ? (
                         <>
                            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            Exporting...
                         </>
                     ) : (
                         <>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            Export Full Backup (.json)
                         </>
                     )}
                </button>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-red-200 dark:border-red-900/50">
                <h2 className="text-xl font-bold mb-4 text-red-700 dark:text-red-400">2. Restore Snaphot</h2>
                <p className="text-gray-600 dark:text-gray-300 mb-6">Upload a previously exported Snapshot file.</p>

                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md mb-6 text-sm text-red-700">
                    <strong>⚠️ Danger Zone:</strong> Restoring will overwrite matching local records. ID reconciliation will be attempted for known entities (Staff, Depts, Roles).
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4">
                    <input 
                        type="file" accept=".json" ref={fileInputRef}
                        onChange={handleFileSelect} disabled={isRestoring || isExporting}
                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-red-50 file:text-red-700"
                    />
                    {isRestoring && <span className="text-sm font-bold text-blue-600 animate-pulse">Restoring... {progress}%</span>}
                </div>

                <div className="mt-6 bg-black text-green-400 font-mono text-[10px] p-4 rounded-md h-48 overflow-y-auto border border-gray-700 shadow-inner">
                    {restoreLogs.length === 0 ? "Ready..." : restoreLogs.map((log, i) => <div key={i}>{log}</div>)}
                </div>
            </div>
        </div>
    );
};

export default BackupTab;
