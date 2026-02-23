-- ==============================================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- 5.0 CLEAN SLATE & GLOBAL ADMIN
DO $$ 
DECLARE 
  t text;
  p record;
BEGIN 
  FOR t IN SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    
    -- AGGRESSIVELY Drop ALL existing policies to prevent "ghost" policies (Advisor 0006)
    FOR p IN (SELECT policyname FROM pg_policies WHERE tablename = t AND schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, t);
    END LOOP;

    -- CREATE ROBUST ADMIN POLICIES (Split to avoid recursion on staff table)
    IF t = 'staff' THEN
        EXECUTE format('CREATE POLICY "Admin Insert" ON public.%I FOR INSERT TO authenticated WITH CHECK ((select public.is_admin()))', t);
        EXECUTE format('CREATE POLICY "Admin Update" ON public.%I FOR UPDATE TO authenticated USING ((select public.is_admin()))', t);
        EXECUTE format('CREATE POLICY "Admin Delete" ON public.%I FOR DELETE TO authenticated USING ((select public.is_admin()))', t);
    ELSE
        -- Split FOR ALL into CRUD + SELECT to allow Selective "Public Read" without Multiple Permissive Policies
        EXECUTE format('CREATE POLICY "Admin CRUD" ON public.%I FOR INSERT TO authenticated WITH CHECK ((select public.is_admin()))', t);
        EXECUTE format('CREATE POLICY "Admin CRUD Update" ON public.%I FOR UPDATE TO authenticated USING ((select public.is_admin()))', t);
        EXECUTE format('CREATE POLICY "Admin CRUD Delete" ON public.%I FOR DELETE TO authenticated USING ((select public.is_admin()))', t);
        
        -- Only add Admin Select if not intended for Public Read later
        IF t NOT IN ('roles', 'leave_types', 'public_holidays', 'roster_view_templates', 'custom_field_definitions', 
                     'validation_rule_sets', 'qualification_types', 'aircraft_types', 'license_types', 
                     'special_qualifications', 'departments', 'checklist_templates', 'performance_templates', 
                     'lunch_menus', 'department_settings', 'rosters', 'roster_metadata', 'fsi_documents', 
                     'fsi_acknowledgments', 'exams', 'questions') THEN
            EXECUTE format('CREATE POLICY "Admin Select" ON public.%I FOR SELECT TO authenticated USING ((select public.is_admin()))', t);
        END IF;
    END IF;
  END LOOP; 
END $$;

-- 5.1 STAFF
DROP POLICY IF EXISTS "Read Staff" ON public.staff;
CREATE POLICY "Read Staff" ON public.staff FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Update Self" ON public.staff;
CREATE POLICY "Update Self" ON public.staff FOR UPDATE TO authenticated USING (auth_id = (select auth.uid()));
DROP POLICY IF EXISTS "Update Managed Dept" ON public.staff;
CREATE POLICY "Update Managed Dept" ON public.staff FOR UPDATE TO authenticated USING (
    department_id IN (SELECT department_id FROM public.staff WHERE auth_id = (select auth.uid()) AND (role_id = 'role_manager' OR 'staff:edit' = ANY(individual_permissions)))
);

-- 5.2 CONFIG TABLES
DO $$
DECLARE t text;
BEGIN
    FOR t IN SELECT table_name FROM information_schema.tables 
             WHERE table_name IN ('roles', 'leave_types', 'public_holidays', 'roster_view_templates', 
                                 'custom_field_definitions', 'validation_rule_sets', 'qualification_types', 
                                 'aircraft_types', 'license_types', 'special_qualifications', 'departments', 
                                 'checklist_templates', 'performance_templates', 'lunch_menus') 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Public Read" ON public.%I', t);
        EXECUTE format('CREATE POLICY "Public Read" ON public.%I FOR SELECT TO authenticated USING (true)', t);
    END LOOP;

    -- Department Settings
    DROP POLICY IF EXISTS "Manage Settings" ON public.department_settings;
    CREATE POLICY "Manage Settings" ON public.department_settings FOR ALL TO authenticated USING (
        (select public.is_manager()) AND department_id = (select public.get_my_department_id())
    );
    DROP POLICY IF EXISTS "Public Read" ON public.department_settings;
    CREATE POLICY "Public Read" ON public.department_settings FOR SELECT TO authenticated USING (true);
END $$;

-- 5.3 ROSTERS & MODULES
DROP POLICY IF EXISTS "Manage Rosters" ON public.rosters;
CREATE POLICY "Manage Rosters" ON public.rosters FOR ALL TO authenticated USING ((select public.can_manage_roster_by_dept(department_id)));
DROP POLICY IF EXISTS "Read Rosters" ON public.rosters;
CREATE POLICY "Read Rosters" ON public.rosters FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Manage Metadata" ON public.roster_metadata;
CREATE POLICY "Manage Metadata" ON public.roster_metadata FOR ALL TO authenticated USING ((select public.can_manage_roster_metadata(id)));
DROP POLICY IF EXISTS "View Metadata" ON public.roster_metadata;
CREATE POLICY "View Metadata" ON public.roster_metadata FOR SELECT TO authenticated USING (true);

-- 5.4 OPERATIONS
DROP POLICY IF EXISTS "Read Flight Logs" ON public.flight_log_records;
CREATE POLICY "Read Flight Logs" ON public.flight_log_records FOR SELECT TO authenticated USING (
    staff_id IN (SELECT id FROM public.staff WHERE auth_id = (select auth.uid())) OR
    (select public.is_manager()) OR 
    EXISTS (SELECT 1 FROM public.staff WHERE auth_id = (select auth.uid()) AND 'duty_log:view_all' = ANY(individual_permissions))
);
DROP POLICY IF EXISTS "Manage Own Logs" ON public.flight_log_records;
CREATE POLICY "Manage Own Logs" ON public.flight_log_records FOR ALL TO authenticated USING (
    staff_id IN (SELECT id FROM public.staff WHERE auth_id = (select auth.uid())) OR (select public.is_manager())
);
DROP POLICY IF EXISTS "View Adj" ON public.flight_hours_adjustments;
CREATE POLICY "View Adj" ON public.flight_hours_adjustments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Manage Adj" ON public.flight_hours_adjustments;
CREATE POLICY "Manage Adj" ON public.flight_hours_adjustments FOR ALL TO authenticated USING (
    staff_id IN (SELECT id FROM public.staff WHERE auth_id = (select auth.uid())) OR (select public.is_manager())
);

DROP POLICY IF EXISTS "Read Leave" ON public.leave_requests;
CREATE POLICY "Read Leave" ON public.leave_requests FOR SELECT TO authenticated USING (
    staff_id IN (SELECT id FROM public.staff WHERE auth_id = (select auth.uid())) OR (select public.is_manager())
);
DROP POLICY IF EXISTS "Manage Leave" ON public.leave_requests;
CREATE POLICY "Manage Leave" ON public.leave_requests FOR ALL TO authenticated USING (
    staff_id IN (SELECT id FROM public.staff WHERE auth_id = (select auth.uid())) OR (select public.is_manager())
);
DROP POLICY IF EXISTS "View Trans" ON public.leave_transactions;
CREATE POLICY "View Trans" ON public.leave_transactions FOR SELECT TO authenticated USING (
    staff_id IN (SELECT id FROM public.staff WHERE auth_id = (select auth.uid())) OR (select public.is_manager())
);
DROP POLICY IF EXISTS "Manage Trans" ON public.leave_transactions;
CREATE POLICY "Manage Trans" ON public.leave_transactions FOR ALL TO authenticated USING ((select public.is_manager()));

DROP POLICY IF EXISTS "Manage Lunch Orders" ON public.lunch_orders;
CREATE POLICY "Manage Lunch Orders" ON public.lunch_orders FOR ALL TO authenticated USING (
    staff_id IN (SELECT id FROM public.staff WHERE auth_id = (select auth.uid())) OR 
    EXISTS (
        SELECT 1 FROM public.staff s
        LEFT JOIN public.roles r ON s.role_id = r.id
        WHERE s.auth_id = (select auth.uid())
        AND ('lunch:manage' = ANY(r.permissions) OR 'lunch:manage' = ANY(s.individual_permissions))
    )
);

-- 5.5 TRAINING
DROP POLICY IF EXISTS "View FSI" ON public.fsi_documents;
CREATE POLICY "View FSI" ON public.fsi_documents FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Manage FSI" ON public.fsi_documents;
CREATE POLICY "Manage FSI" ON public.fsi_documents FOR ALL TO authenticated USING ((select public.is_manager()));
DROP POLICY IF EXISTS "View Acks" ON public.fsi_acknowledgments;
CREATE POLICY "View Acks" ON public.fsi_acknowledgments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Create Ack" ON public.fsi_acknowledgments;
CREATE POLICY "Create Ack" ON public.fsi_acknowledgments FOR INSERT TO authenticated WITH CHECK (
    (select auth.uid()) IN (SELECT auth_id FROM public.staff WHERE id = staff_id)
);

DROP POLICY IF EXISTS "View Exams" ON public.exams;
CREATE POLICY "View Exams" ON public.exams FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Manage Exams" ON public.exams;
CREATE POLICY "Manage Exams" ON public.exams FOR ALL TO authenticated USING ((select public.is_manager()));
DROP POLICY IF EXISTS "View Questions" ON public.questions;
CREATE POLICY "View Questions" ON public.questions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Manage Questions" ON public.questions;
CREATE POLICY "Manage Questions" ON public.questions FOR ALL TO authenticated USING ((select public.is_manager()));

DROP POLICY IF EXISTS "View Attempts" ON public.exam_attempts;
CREATE POLICY "View Attempts" ON public.exam_attempts FOR SELECT TO authenticated USING (
    staff_id IN (SELECT id FROM public.staff WHERE auth_id = (select auth.uid())) OR (select public.is_manager())
);
DROP POLICY IF EXISTS "Manage Attempts" ON public.exam_attempts;
CREATE POLICY "Manage Attempts" ON public.exam_attempts FOR ALL TO authenticated USING (
    staff_id IN (SELECT id FROM public.staff WHERE auth_id = (select auth.uid())) OR (select public.is_manager())
);

-- 5.6 HR & AUDIT
DROP POLICY IF EXISTS "Manage Swaps" ON public.duty_swaps;
CREATE POLICY "Manage Swaps" ON public.duty_swaps FOR ALL TO authenticated USING (
    requester_staff_id IN (SELECT id FROM public.staff WHERE auth_id = (select auth.uid())) 
    OR target_staff_id IN (SELECT id FROM public.staff WHERE auth_id = (select auth.uid()))
    OR (select public.is_manager())
);
-- Audit permissions are handled specifically to allow 'audit:view'
DROP POLICY IF EXISTS "Admin CRUD Delete" ON public.audit_logs;
CREATE POLICY "Admin CRUD Delete" ON public.audit_logs FOR DELETE TO authenticated USING ((select public.is_admin()));
DROP POLICY IF EXISTS "Admin Read Audit" ON public.audit_logs;
CREATE POLICY "Admin Read Audit" ON public.audit_logs FOR SELECT TO authenticated USING (
    (select public.is_admin()) OR 
    EXISTS (
        SELECT 1 FROM public.staff s
        LEFT JOIN public.roles r ON s.role_id = r.id
        WHERE s.auth_id = (select auth.uid())
        AND ('audit:view' = ANY(r.permissions) OR 'audit:view' = ANY(s.individual_permissions))
    )
);
