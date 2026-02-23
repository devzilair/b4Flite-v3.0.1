
import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../services/api';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { Staff, Department, Role } from '../types';
import { getErrorMessage } from '../utils/sanitization';

export const useStaff = () => {
    const { session } = useAuth();
    const queryClient = useQueryClient();
    const enabled = !!session;

    // --- QUERIES ---
    const rolesQuery = useQuery({ queryKey: ['roles'], queryFn: api.getRoles, staleTime: 1000 * 60 * 5, enabled });
    const departmentsQuery = useQuery({ queryKey: ['departments'], queryFn: api.getDepartments, staleTime: 1000 * 60 * 5, enabled });
    const staffQuery = useQuery({ queryKey: ['staff'], queryFn: api.getStaff, staleTime: 1000 * 60 * 5, enabled });

    // --- REAL-TIME SUBSCRIPTIONS ---
    useEffect(() => {
        if (!enabled) return;

        // Listen for changes to the 'staff' table to update the directory in real-time
        const channel = supabase.channel('realtime-staff')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'staff' },
                () => queryClient.invalidateQueries({ queryKey: ['staff'] })
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [queryClient, enabled]);

    // --- MUTATIONS ---
    const staffMutation = useMutation({ 
        mutationFn: api.updateStaff, 
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['staff'] }) 
    });
    const addStaffMutation = useMutation({ 
        mutationFn: api.insertStaff, 
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['staff'] }) 
    });
    const deleteStaffMutation = useMutation({ 
        mutationFn: api.deleteStaff, 
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['staff'] }) 
    });
    
    const deptMutation = useMutation({ 
        mutationFn: api.upsertDepartment, 
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['departments'] }) 
    });
    const deleteDeptMutation = useMutation({ 
        mutationFn: api.deleteDepartment, 
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['departments'] }) 
    });
    
    const roleMutation = useMutation({ 
        mutationFn: api.upsertRole, 
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['roles'] }) 
    });
    const deleteRoleMutation = useMutation({ 
        mutationFn: api.deleteRole, 
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['roles'] }) 
    });

    const loading = rolesQuery.isLoading || departmentsQuery.isLoading || staffQuery.isLoading;
    
    const error = rolesQuery.error || departmentsQuery.error || staffQuery.error 
        ? getErrorMessage(rolesQuery.error || departmentsQuery.error || staffQuery.error) 
        : null;

    return {
        loading,
        error,
        staff: (staffQuery.data || []) as Staff[],
        departments: (departmentsQuery.data || []) as Department[],
        roles: (rolesQuery.data || []) as Role[],

        updateStaff: (s: Staff) => staffMutation.mutateAsync(s),
        addStaff: (s: Partial<Staff>) => addStaffMutation.mutateAsync(s),
        deleteStaff: (id: string) => deleteStaffMutation.mutateAsync(id),
        
        // Special Profile Actions
        createMyProfile: async (p: Partial<Staff>) => {
            const res = await addStaffMutation.mutateAsync(p as any);
            queryClient.invalidateQueries({ queryKey: ['staff'] });
            return res;
        },
        claimProfile: async () => {
            const success = await api.claimProfile();
            if (success) queryClient.invalidateQueries({ queryKey: ['staff'] });
            return success;
        },

        updateDepartment: (d: Department) => deptMutation.mutateAsync(d),
        addDepartment: async (d: Omit<Department, 'id'>) => {
            const res = await deptMutation.mutateAsync(d as any);
            queryClient.invalidateQueries({ queryKey: ['departments'] });
            return res;
        },
        deleteDepartment: (id: string) => deleteDeptMutation.mutateAsync(id),
        
        upsertRole: (r: Role) => roleMutation.mutateAsync(r),
        deleteRole: (id: string) => deleteRoleMutation.mutateAsync(id),
    };
};
