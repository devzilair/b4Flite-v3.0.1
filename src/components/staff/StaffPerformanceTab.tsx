
import React from 'react';
import { Staff } from '../../types';
import GoalsWidget from './GoalsWidget.tsx';
import ReviewListWidget from './ReviewListWidget.tsx';
import { usePermissions } from '../../hooks/usePermissions.ts';

interface StaffPerformanceTabProps {
    staff: Staff;
}

const StaffPerformanceTab: React.FC<StaffPerformanceTabProps> = ({ staff }) => {
    const { currentUser, can } = usePermissions();

    const isOwnProfile = currentUser?.id === staff.id;
    // Use permission-based check for management rights
    const isManager = can('staff:view:own_department') && currentUser?.departmentId === staff.departmentId;
    const isAdmin = can('staff:edit') || can('admin:edit_hr_settings'); 

    const canEditGoals = isOwnProfile || isManager || isAdmin;
    const canManageReviews = isManager || isAdmin;

    return (
        <div>
             <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">Performance Management</h2>
                <p className="text-sm text-gray-500">Track goals, objectives, and periodic performance appraisals.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                    <GoalsWidget staffId={staff.id} canEdit={canEditGoals} />
                </div>
                
                <div className="lg:col-span-2">
                    <ReviewListWidget staffId={staff.id} staffName={staff.name} canManage={canManageReviews} />
                </div>
            </div>
        </div>
    );
};

export default StaffPerformanceTab;
