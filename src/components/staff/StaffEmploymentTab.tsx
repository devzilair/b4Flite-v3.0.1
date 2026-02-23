
import React from 'react';
import { Staff } from '@/types';

interface StaffEmploymentTabProps {
    staff: Partial<Staff>;
    handleHRChange: (section: 'personal' | 'contract' | 'immigration' | 'banking', field: string, value: any) => void;
}

const StaffEmploymentTab: React.FC<StaffEmploymentTabProps> = ({ staff, handleHRChange }) => {
    return (
        <div className="space-y-8 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-700/30 dark:border-gray-600">
                    <h3 className="font-bold text-gray-700 dark:text-gray-200 mb-4">Personal Information</h3>
                    <div className="space-y-3">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Date of Birth</label>
                            <input
                                type="date"
                                value={staff.hrData?.personal?.dob || ''}
                                onChange={(e) => handleHRChange('personal', 'dob', e.target.value)}
                                className="w-full form-input text-sm"
                            />
                        </div>
                    </div>
                </div>
                <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-700/30 dark:border-gray-600">
                    <h3 className="font-bold text-gray-700 dark:text-gray-200 mb-4">Contract Details</h3>
                    <div className="space-y-3">
                        <input type="text" value={staff.hrData?.contract?.jobTitle || ''} onChange={(e) => handleHRChange('contract', 'jobTitle', e.target.value)} className="w-full form-input text-sm" placeholder="Job Title" />
                        <select value={staff.hrData?.contract?.type || 'full_time'} onChange={(e) => handleHRChange('contract', 'type', e.target.value)} className="w-full form-input text-sm">
                            <option value="full_time">Full Time</option><option value="part_time">Part Time</option><option value="contractor">Contractor</option><option value="probation">Probation</option>
                        </select>
                        <div className="grid grid-cols-2 gap-2">
                            <input type="date" value={staff.hrData?.contract?.startDate || ''} onChange={(e) => handleHRChange('contract', 'startDate', e.target.value)} className="w-full form-input text-sm" />
                            <input type="date" value={staff.hrData?.contract?.endDate || ''} onChange={(e) => handleHRChange('contract', 'endDate', e.target.value)} className="w-full form-input text-sm" />
                        </div>
                    </div>
                </div>
                <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-700/30 dark:border-gray-600">
                    <h3 className="font-bold text-gray-700 dark:text-gray-200 mb-4">Immigration & ID</h3>
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                            <input type="text" value={staff.hrData?.immigration?.passportNumber || ''} onChange={(e) => handleHRChange('immigration', 'passportNumber', e.target.value)} className="w-full form-input text-sm" placeholder="Passport No" />
                            <input type="date" value={staff.hrData?.immigration?.passportExpiry || ''} onChange={(e) => handleHRChange('immigration', 'passportExpiry', e.target.value)} className="w-full form-input text-sm" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <input type="text" value={staff.hrData?.immigration?.visaNumber || ''} onChange={(e) => handleHRChange('immigration', 'visaNumber', e.target.value)} className="w-full form-input text-sm" placeholder="Visa/Permit" />
                            <input type="date" value={staff.hrData?.immigration?.visaExpiry || ''} onChange={(e) => handleHRChange('immigration', 'visaExpiry', e.target.value)} className="w-full form-input text-sm" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StaffEmploymentTab;
