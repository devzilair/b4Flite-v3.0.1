
import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { 
    DepartmentSettings, LeaveType, PublicHoliday, CustomFieldDefinition, 
    ValidationRuleSet, RosterViewTemplate, QualificationType, AircraftType, 
    LicenseType, SpecialQualification 
} from '../types';

export const useSettings = () => {
    const { session } = useAuth();
    const queryClient = useQueryClient();
    const enabled = !!session;

    // --- QUERIES ---
    const deptSettingsQuery = useQuery({ queryKey: ['department_settings'], queryFn: api.getDepartmentSettings, staleTime: 1000 * 60 * 5, enabled });
    const leaveTypesQuery = useQuery({ queryKey: ['leave_types'], queryFn: api.getLeaveTypes, staleTime: 1000 * 60 * 5, enabled });
    const holidaysQuery = useQuery({ queryKey: ['public_holidays'], queryFn: api.getPublicHolidays, staleTime: 1000 * 60 * 5, enabled });
    const fieldDefsQuery = useQuery({ queryKey: ['custom_field_definitions'], queryFn: api.getCustomFieldDefs, staleTime: 1000 * 60 * 5, enabled });
    const validationQuery = useQuery({ queryKey: ['validation_rule_sets'], queryFn: api.getValidationRuleSets, staleTime: 1000 * 60 * 5, enabled });
    const rosterTemplatesQuery = useQuery({ queryKey: ['roster_view_templates'], queryFn: api.getRosterViewTemplates, staleTime: 1000 * 60 * 5, enabled });
    const aircraftTypesQuery = useQuery({ queryKey: ['aircraft_types'], queryFn: api.getAircraftTypes, staleTime: 1000 * 60 * 5, enabled });
    const licenseTypesQuery = useQuery({ queryKey: ['license_types'], queryFn: api.getLicenseTypes, staleTime: 1000 * 60 * 5, enabled });
    const specialQualsQuery = useQuery({ queryKey: ['special_qualifications'], queryFn: api.getSpecialQualifications, staleTime: 1000 * 60 * 5, enabled });
    const qualificationQuery = useQuery({ queryKey: ['qualification_types'], queryFn: api.getQualificationTypes, staleTime: 1000 * 60 * 5, enabled });

    // --- MUTATIONS ---
    const deptSettingsMutation = useMutation({
        mutationFn: (args: { settings: DepartmentSettings, deptId: string }) => api.upsertDepartmentSettings(args.settings, args.deptId),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['department_settings'] })
    });

    const leaveTypeMutation = useMutation({ mutationFn: api.upsertLeaveType, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leave_types'] }) });
    const deleteLeaveTypeMutation = useMutation({ mutationFn: api.deleteLeaveType, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leave_types'] }) });
    const holidayMutation = useMutation({ mutationFn: api.upsertPublicHoliday, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['public_holidays'] }) });
    const deleteHolidayMutation = useMutation({ mutationFn: api.deletePublicHoliday, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['public_holidays'] }) });
    const fieldDefMutation = useMutation({ mutationFn: api.upsertCustomFieldDef, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['custom_field_definitions'] }) });
    const deleteFieldDefMutation = useMutation({ mutationFn: api.deleteCustomFieldDef, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['custom_field_definitions'] }) });
    const validationMutation = useMutation({ mutationFn: api.upsertValidationRuleSet, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['validation_rule_sets'] }) });
    const deleteValidationMutation = useMutation({ mutationFn: api.deleteValidationRuleSet, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['validation_rule_sets'] }) });
    const qualTypeMutation = useMutation({ mutationFn: api.upsertQualificationType, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['qualification_types'] }) });
    const deleteQualTypeMutation = useMutation({ mutationFn: api.deleteQualificationType, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['qualification_types'] }) });
    const aircraftTypeMutation = useMutation({ mutationFn: api.upsertAircraftType, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['aircraft_types'] }) });
    const deleteAircraftTypeMutation = useMutation({ mutationFn: api.deleteAircraftType, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['aircraft_types'] }) });
    const licenseTypeMutation = useMutation({ mutationFn: api.upsertLicenseType, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['license_types'] }) });
    const deleteLicenseTypeMutation = useMutation({ mutationFn: api.deleteLicenseType, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['license_types'] }) });
    const specialQualMutation = useMutation({ mutationFn: api.upsertSpecialQualification, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['special_qualifications'] }) });
    const deleteSpecialQualMutation = useMutation({ mutationFn: api.deleteSpecialQualification, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['special_qualifications'] }) });

    const loading = 
        deptSettingsQuery.isLoading || leaveTypesQuery.isLoading || holidaysQuery.isLoading || 
        fieldDefsQuery.isLoading || validationQuery.isLoading || rosterTemplatesQuery.isLoading || 
        aircraftTypesQuery.isLoading || licenseTypesQuery.isLoading || specialQualsQuery.isLoading || 
        qualificationQuery.isLoading;

    const error = 
        deptSettingsQuery.error || leaveTypesQuery.error || holidaysQuery.error || 
        fieldDefsQuery.error || validationQuery.error || rosterTemplatesQuery.error || 
        aircraftTypesQuery.error || licenseTypesQuery.error || specialQualsQuery.error || 
        qualificationQuery.error;

    return {
        loading,
        error,
        departmentSettings: (deptSettingsQuery.data || {}) as { [key: string]: DepartmentSettings },
        leaveTypes: (leaveTypesQuery.data || []) as LeaveType[],
        publicHolidays: (holidaysQuery.data || []) as PublicHoliday[],
        customFieldDefs: (fieldDefsQuery.data || []) as CustomFieldDefinition[],
        validationRuleSets: (validationQuery.data || []) as ValidationRuleSet[],
        rosterViewTemplates: (rosterTemplatesQuery.data || []) as RosterViewTemplate[],
        qualificationTypes: (qualificationQuery.data || []) as QualificationType[],
        aircraftTypes: (aircraftTypesQuery.data || []) as AircraftType[],
        licenseTypes: (licenseTypesQuery.data || []) as LicenseType[],
        specialQualifications: (specialQualsQuery.data || []) as SpecialQualification[],

        updateDepartmentSettings: (s: DepartmentSettings, id: string) => deptSettingsMutation.mutateAsync({ settings: s, deptId: id }),
        upsertLeaveType: leaveTypeMutation.mutateAsync,
        deleteLeaveType: deleteLeaveTypeMutation.mutateAsync,
        upsertPublicHoliday: holidayMutation.mutateAsync,
        deletePublicHoliday: deleteHolidayMutation.mutateAsync,
        upsertCustomFieldDef: fieldDefMutation.mutateAsync,
        deleteCustomFieldDef: deleteFieldDefMutation.mutateAsync,
        upsertValidationRuleSet: validationMutation.mutateAsync,
        deleteValidationRuleSet: deleteValidationMutation.mutateAsync,
        upsertQualificationType: qualTypeMutation.mutateAsync,
        deleteQualificationType: deleteQualTypeMutation.mutateAsync,
        upsertAircraftType: aircraftTypeMutation.mutateAsync,
        deleteAircraftType: deleteAircraftTypeMutation.mutateAsync,
        upsertLicenseType: licenseTypeMutation.mutateAsync,
        deleteLicenseType: deleteLicenseTypeMutation.mutateAsync,
        upsertSpecialQualification: specialQualMutation.mutateAsync,
        deleteSpecialQualification: deleteSpecialQualMutation.mutateAsync,
    };
};
