
import React from 'react';
import { Staff, MajorType, AircraftType, LicenseType, SpecialQualification, QualificationType } from '@/types';

interface StaffPilotDataTabProps {
    staff: Partial<Staff>;
    isNew: boolean;
    aircraftTypes: AircraftType[];
    licenseTypes: LicenseType[];
    specialQualifications: SpecialQualification[];
    qualificationTypes: QualificationType[];
    handlePilotDataChange: (field: string, value: any) => void;
    handleAircraftCategoryToggle: (cat: MajorType) => void;
    handleSpecialQualToggle: (qualId: string) => void;
    handleAircraftTypeToggle: (typeId: string) => void;
}

const StaffPilotDataTab: React.FC<StaffPilotDataTabProps> = ({
    staff,
    isNew,
    aircraftTypes,
    licenseTypes,
    specialQualifications,
    qualificationTypes,
    handlePilotDataChange,
    handleAircraftCategoryToggle,
    handleSpecialQualToggle,
    handleAircraftTypeToggle
}) => {
    return (
        <div className="max-w-2xl space-y-8 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                    <h3 className="font-bold text-gray-700 dark:text-gray-200 mb-2 uppercase text-xs tracking-wider">Flight Category</h3>
                    <div className="flex gap-4">
                        <label className="flex items-center space-x-2 border p-3 rounded cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 flex-1">
                            <input type="checkbox" checked={(staff.pilotData?.aircraftCategory || []).includes('Fixed Wing')} onChange={() => handleAircraftCategoryToggle('Fixed Wing')} className="form-checkbox h-5 w-5" />
                            <span className="text-sm">Fixed Wing</span>
                        </label>
                        <label className="flex items-center space-x-2 border p-3 rounded cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 flex-1">
                            <input type="checkbox" checked={(staff.pilotData?.aircraftCategory || []).includes('Helicopter')} onChange={() => handleAircraftCategoryToggle('Helicopter')} className="form-checkbox h-5 w-5" />
                            <span className="text-sm">Helicopter</span>
                        </label>
                    </div>
                </div>
                <div>
                    <h3 className="font-bold text-gray-700 dark:text-gray-200 mb-2 uppercase text-xs tracking-wider">Primary Licence</h3>
                    <select value={staff.pilotData?.licenseType || ''} onChange={(e) => handlePilotDataChange('licenseType', e.target.value)} className="w-full form-input">
                        <option value="">-- Select License --</option>
                        {[...(licenseTypes || [])].sort((a, b) => a.name.localeCompare(b.name)).map(lt => (
                            <option key={lt.id} value={lt.id}>{lt.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="p-4 border rounded-lg bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800">
                <h3 className="font-bold text-blue-800 dark:text-blue-300 mb-4 uppercase text-xs tracking-wider">Instructional & Examiner Ratings</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {specialQualifications.map(sq => (
                        <label key={sq.id} className="flex items-center space-x-2 p-2 rounded bg-white dark:bg-gray-800 border dark:border-gray-700 cursor-pointer hover:shadow-sm">
                            <input
                                type="checkbox"
                                checked={(staff.pilotData?.specialQualifications || []).includes(sq.id)}
                                onChange={() => handleSpecialQualToggle(sq.id)}
                                className="form-checkbox rounded text-brand-primary"
                            />
                            <span className="text-xs font-bold">{sq.name}</span>
                        </label>
                    ))}
                    {specialQualifications.length === 0 && <p className="col-span-full text-xs text-gray-500 italic">No special ratings defined in settings.</p>}
                </div>
            </div>

            <div>
                <h3 className="font-bold text-gray-700 dark:text-gray-200 mb-2 uppercase text-xs tracking-wider">Aircraft Type Ratings</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {aircraftTypes.map(at => (
                        <label key={at.id} className="flex items-center space-x-2 p-2 border rounded bg-gray-50 dark:bg-gray-700/30 cursor-pointer">
                            <input type="checkbox" checked={(staff.pilotData?.aircraftTypes || []).includes(at.id)} onChange={() => handleAircraftTypeToggle(at.id)} className="form-checkbox rounded text-brand-primary" />
                            <span className="text-xs">{at.name}</span>
                        </label>
                    ))}
                </div>
            </div>

            {/* Qualifications Status Summary */}
            {!isNew && (
                <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-800 dark:border-gray-700">
                    <h3 className="font-bold text-gray-700 dark:text-gray-200 mb-4 uppercase text-xs tracking-wider">Qualifications Status</h3>
                    <div className="grid grid-cols-2 gap-4">
                        {qualificationTypes.filter(q => !q.departmentId || q.departmentId === staff.departmentId).map(qt => {
                            const doc = staff.documents?.find(d => d.qualificationTypeId === qt.id);
                            let status = 'Missing';
                            let color = 'text-red-500';
                            let date = '';

                            if (doc) {
                                if (!doc.expiryDate) {
                                    status = 'Valid (Perm)';
                                    color = 'text-blue-500';
                                } else {
                                    const expiry = new Date(doc.expiryDate);
                                    const now = new Date();
                                    const days = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                                    date = expiry.toLocaleDateString();

                                    if (days < 0) {
                                        status = 'Expired';
                                        color = 'text-red-600 font-bold';
                                    } else if (days < 60) {
                                        status = `Expiring (${days}d)`;
                                        color = 'text-yellow-600 font-bold';
                                    } else {
                                        status = 'Valid';
                                        color = 'text-green-600';
                                    }
                                }
                            }

                            return (
                                <div key={qt.id} className="flex justify-between items-center text-sm border-b pb-1 dark:border-gray-700 last:border-0">
                                    <span className="text-gray-600 dark:text-gray-300">{qt.name}</span>
                                    <div className="text-right">
                                        <span className={`block ${color}`}>{status}</span>
                                        {date && <span className="text-xs text-gray-400">{date}</span>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default StaffPilotDataTab;
