CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- ==============================================================================
-- 2. CORE TABLE DEFINITIONS
-- ==============================================================================

-- 2.1 Identity
CREATE TABLE IF NOT EXISTS public.roles (
    id text PRIMARY KEY,
    name text NOT NULL,
    permissions text[] DEFAULT '{}'::text[]
);

CREATE TABLE IF NOT EXISTS public.departments (
    id text PRIMARY KEY,
    name text NOT NULL,
    manager_id uuid,
    sub_departments text[] DEFAULT '{}'::text[],
    roster_view_template_id text,
    validation_rule_set_id text
);

CREATE TABLE IF NOT EXISTS public.staff (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_id uuid UNIQUE,
    name text NOT NULL,
    email text UNIQUE,
    phone text,
    role_id text DEFAULT 'role_staff',
    department_id text REFERENCES public.departments(id),
    sub_departments text[] DEFAULT '{}'::text[],
    managed_sub_departments text[] DEFAULT '{}'::text[],
    account_status text DEFAULT 'active' CHECK (account_status IN ('active', 'disabled', 'archived')),
    individual_permissions text[] DEFAULT '{}'::text[],
    roster_permissions jsonb DEFAULT '[]'::jsonb,
    has_hr_rights boolean DEFAULT false,
    next_of_kin jsonb DEFAULT '[]'::jsonb,
    custom_fields jsonb DEFAULT '{}'::jsonb,
    pilot_data jsonb DEFAULT '{}'::jsonb,
    hr_data jsonb DEFAULT '{}'::jsonb,
    lifecycle_data jsonb DEFAULT '{}'::jsonb,
    documents jsonb DEFAULT '[]'::jsonb
);

-- Fix Circular Dependency
ALTER TABLE public.departments DROP CONSTRAINT IF EXISTS departments_manager_id_fkey;
ALTER TABLE public.departments ADD CONSTRAINT departments_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.staff(id) ON DELETE SET NULL;

-- 2.2 Settings & Config
CREATE TABLE IF NOT EXISTS public.department_settings (
    department_id text PRIMARY KEY REFERENCES public.departments(id) ON DELETE CASCADE,
    roster_settings jsonb DEFAULT '{}'::jsonb,
    shift_codes jsonb DEFAULT '[]'::jsonb,
    max_concurrent_leave integer,
    leave_accrual_policies jsonb DEFAULT '[]'::jsonb,
    pilot_roster_layout jsonb DEFAULT '[]'::jsonb,
    pilot_roster_settings jsonb DEFAULT '{}'::jsonb,
    sub_department_rules jsonb DEFAULT '[]'::jsonb,
    email_settings jsonb DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.leave_types (
    id text PRIMARY KEY,
    name text NOT NULL UNIQUE,
    color text
);

CREATE TABLE IF NOT EXISTS public.public_holidays (
    date date PRIMARY KEY,
    name text NOT NULL,
    is_recurring boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.custom_field_definitions (
    id text PRIMARY KEY,
    name text NOT NULL,
    type text CHECK (type IN ('text', 'number', 'date'))
);

CREATE TABLE IF NOT EXISTS public.validation_rule_sets (
    id text PRIMARY KEY,
    name text NOT NULL,
    rules jsonb DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS public.roster_view_templates (
    id text PRIMARY KEY,
    name text NOT NULL,
    type text CHECK (type IN ('standard', 'pilot'))
);

CREATE TABLE IF NOT EXISTS public.aircraft_types (
    id text PRIMARY KEY,
    name text NOT NULL UNIQUE,
    category text CHECK (category IN ('Helicopter', 'Fixed Wing')),
    is_turbine boolean DEFAULT false,
    is_multi_engine boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.license_types (
    id text PRIMARY KEY,
    name text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS public.special_qualifications (
    id text PRIMARY KEY,
    name text NOT NULL UNIQUE,
    description text
);

CREATE TABLE IF NOT EXISTS public.qualification_types (
    id text PRIMARY KEY,
    name text NOT NULL,
    code text NOT NULL,
    department_id text REFERENCES public.departments(id),
    validity_months integer DEFAULT 12,
    warning_days integer DEFAULT 90
);

-- 2.3 Operations
CREATE TABLE IF NOT EXISTS public.rosters (
    month_key text NOT NULL,
    department_id text NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
    roster_data jsonb DEFAULT '{}'::jsonb,
    PRIMARY KEY (month_key, department_id)
);

CREATE TABLE IF NOT EXISTS public.roster_metadata (
    id text PRIMARY KEY,
    metadata jsonb DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.flight_log_records (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    staff_id uuid REFERENCES public.staff(id) ON DELETE CASCADE,
    date date NOT NULL,
    duty_start text,
    duty_end text,
    fdp_start text,
    fdp_end text,
    break_start text,
    break_end text,
    standby_on text,
    standby_off text,
    flight_on text,
    flight_off text,
    aircraft_type text,
    sectors integer,
    is_two_pilot_operation boolean DEFAULT false,
    is_split_duty boolean DEFAULT false,
    flight_hours_by_aircraft jsonb DEFAULT '{}'::jsonb,
    remarks text,
    UNIQUE(staff_id, date)
);

CREATE TABLE IF NOT EXISTS public.flight_hours_adjustments (
    id text PRIMARY KEY,
    staff_id uuid REFERENCES public.staff(id) ON DELETE CASCADE,
    date date NOT NULL,
    hours numeric(10, 2) NOT NULL,
    description text,
    category text,
    aircraft_type_id text,
    is_turbine boolean DEFAULT false,
    is_multi_engine boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.leave_requests (
    id text PRIMARY KEY,
    staff_id uuid REFERENCES public.staff(id) ON DELETE CASCADE,
    leave_type_id text REFERENCES public.leave_types(id),
    start_date date NOT NULL,
    end_date date NOT NULL,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
    notes text,
    destination text,
    contact_number text,
    justification text,
    ph_days_applied integer DEFAULT 0,
    ph_position text DEFAULT 'start' CHECK (ph_position IN ('start', 'end')),
    signatures jsonb DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.leave_transactions (
    id text PRIMARY KEY,
    staff_id uuid REFERENCES public.staff(id) ON DELETE CASCADE,
    leave_type_id text REFERENCES public.leave_types(id),
    transaction_type text CHECK (transaction_type IN ('accrual', 'leave_taken', 'adjustment')),
    date date NOT NULL,
    amount numeric(5,2) NOT NULL,
    notes text,
    related_leave_request_id text REFERENCES public.leave_requests(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.duty_swaps (
    id text PRIMARY KEY,
    requester_staff_id uuid REFERENCES public.staff(id),
    target_staff_id uuid REFERENCES public.staff(id),
    date date NOT NULL,
    status text DEFAULT 'pending_peer' CHECK (status IN ('pending_peer', 'pending_manager', 'approved', 'rejected')),
    created_at timestamptz DEFAULT now(),
    manager_id uuid REFERENCES public.staff(id),
    notes text,
    department_id text REFERENCES public.departments(id)
);

-- 2.4 Safety & Training
CREATE TABLE IF NOT EXISTS public.fsi_documents (
    id text PRIMARY KEY,
    title text NOT NULL,
    document_number text,
    revision integer DEFAULT 1,
    issue_date date NOT NULL,
    content text,
    status text DEFAULT 'draft',
    assigned_to text DEFAULT 'all_in_department',
    department_id text REFERENCES public.departments(id),
    document_url text,
    priority text DEFAULT 'normal',
    category text DEFAULT 'General'
);

CREATE TABLE IF NOT EXISTS public.fsi_acknowledgments (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id text REFERENCES public.fsi_documents(id) ON DELETE CASCADE,
    staff_id uuid REFERENCES public.staff(id) ON DELETE CASCADE,
    acknowledged_at timestamptz DEFAULT now(),
    UNIQUE(document_id, staff_id)
);

CREATE TABLE IF NOT EXISTS public.exams (
    id text PRIMARY KEY,
    title text NOT NULL,
    question_ids text[] DEFAULT '{}'::text[],
    time_limit_minutes integer DEFAULT 30,
    pass_mark_percentage integer DEFAULT 80,
    assigned_aircraft_type text,
    department_id text REFERENCES public.departments(id),
    randomize_questions boolean DEFAULT false,
    questions_per_exam integer DEFAULT 0,
    validity_months integer DEFAULT 12,
    show_review boolean DEFAULT true,
    time_limit_per_question integer DEFAULT 0,
    cool_down_minutes integer DEFAULT 0,
    reference_material_url text,
    assigned_to text DEFAULT 'all_in_department',
    status text DEFAULT 'active',
    due_date date,
    category_rules jsonb DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.questions (
    id text PRIMARY KEY,
    text text NOT NULL,
    type text CHECK (type IN ('mcq', 'true_false')),
    options text[] DEFAULT '{}'::text[],
    correct_answer text NOT NULL,
    category text,
    department_id text REFERENCES public.departments(id),
    image_url text
);

CREATE TABLE IF NOT EXISTS public.exam_attempts (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    exam_id text REFERENCES public.exams(id) ON DELETE CASCADE,
    staff_id uuid REFERENCES public.staff(id) ON DELETE CASCADE,
    status text CHECK (status IN ('passed', 'failed', 'pending')),
    score integer NOT NULL,
    category_scores jsonb DEFAULT '{}'::jsonb,
    completed_at timestamptz DEFAULT now(),
    expiry_date date,
    answers jsonb DEFAULT '{}'::jsonb
);

-- 2.5 HR & Lunch
CREATE TABLE IF NOT EXISTS public.checklist_templates (
    id text PRIMARY KEY,
    name text NOT NULL,
    type text CHECK (type IN ('onboarding', 'offboarding')),
    items jsonb DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS public.employee_goals (
    id text PRIMARY KEY,
    staff_id uuid REFERENCES public.staff(id) ON DELETE CASCADE,
    title text NOT NULL,
    description text,
    status text DEFAULT 'pending',
    progress integer DEFAULT 0,
    due_date date
);

CREATE TABLE IF NOT EXISTS public.performance_templates (
    id text PRIMARY KEY,
    name text NOT NULL,
    sections jsonb DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS public.performance_reviews (
    id text PRIMARY KEY,
    staff_id uuid REFERENCES public.staff(id) ON DELETE CASCADE,
    template_id text REFERENCES public.performance_templates(id),
    template_name text,
    status text DEFAULT 'draft',
    period_start date,
    period_end date,
    self_responses jsonb DEFAULT '{}'::jsonb,
    manager_responses jsonb DEFAULT '{}'::jsonb,
    overall_rating numeric(3,1),
    final_comments text,
    manager_id uuid REFERENCES public.staff(id),
    completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.lunch_menus (
    date date PRIMARY KEY,
    cutoff_time timestamptz NOT NULL,
    options jsonb DEFAULT '[]'::jsonb,
    manual_eligible_staff text[] DEFAULT '{}'::text[]
);

CREATE TABLE IF NOT EXISTS public.lunch_orders (
    date date NOT NULL REFERENCES public.lunch_menus(date) ON DELETE CASCADE,
    staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
    option_id text NOT NULL,
    notes text,
    selected_condiments text[] DEFAULT '{}'::text[],
    PRIMARY KEY (date, staff_id)
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    changed_at timestamptz DEFAULT now(),
    changed_by uuid, -- Staff ID
    table_name text NOT NULL,
    record_id text NOT NULL,
    operation text NOT NULL,
    old_data jsonb,
    new_data jsonb
);

-- Cleanup Migrations
DO $$
BEGIN
    ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS auth_id uuid UNIQUE;
    ALTER TABLE public.lunch_orders ADD COLUMN IF NOT EXISTS selected_condiments text[] DEFAULT '{}'::text[];
    ALTER TABLE public.flight_log_records ADD COLUMN IF NOT EXISTS flight_hours_by_aircraft jsonb DEFAULT '{}'::jsonb;
    ALTER TABLE public.flight_log_records ADD COLUMN IF NOT EXISTS aircraft_type text;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rosters' AND column_name = 'id') THEN
        ALTER TABLE public.rosters DROP COLUMN id CASCADE;
    END IF;
    ALTER TABLE public.department_settings ADD COLUMN IF NOT EXISTS sub_department_rules jsonb DEFAULT '[]'::jsonb;
END $$;
-- ==============================================================================
-- 3. HELPER FUNCTIONS
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.staff
    WHERE auth_id = (select auth.uid())
    AND role_id IN ('role_admin', 'role_super_admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.staff
    WHERE auth_id = (select auth.uid())
    AND role_id = 'role_manager'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.get_my_department_id()
RETURNS text AS $$
DECLARE
  dept_id text;
BEGIN
  SELECT department_id INTO dept_id
  FROM public.staff
  WHERE auth_id = (select auth.uid());
  RETURN dept_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.can_manage_roster_by_dept(target_dept_id text)
RETURNS boolean AS $$
BEGIN
  IF (SELECT public.is_admin()) OR (SELECT public.is_manager()) THEN RETURN true; END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.staff
    WHERE auth_id = (select auth.uid())
    AND roster_permissions @> jsonb_build_array(jsonb_build_object('department_id', target_dept_id, 'level', 'edit'))
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.can_manage_roster_metadata(meta_id text)
RETURNS boolean AS $$
DECLARE
  user_perms jsonb;
  perm jsonb;
  dept_id text;
BEGIN
  IF (SELECT public.is_admin()) OR (SELECT public.is_manager()) THEN RETURN true; END IF;
  SELECT roster_permissions INTO user_perms FROM public.staff WHERE auth_id = (select auth.uid());
  IF user_perms IS NULL THEN RETURN false; END IF;
  FOR perm IN SELECT * FROM jsonb_array_elements(user_perms) LOOP
    IF perm->>'level' = 'edit' THEN
        dept_id := perm->>'department_id';
        IF meta_id LIKE (dept_id || '_%') THEN RETURN true; END IF;
    END IF;
  END LOOP;
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- Audit Log Helpers
CREATE OR REPLACE FUNCTION public.get_audit_logs(
  page_num int,
  page_size int,
  search_term text DEFAULT NULL,
  table_filter text DEFAULT 'all',
  op_filter text DEFAULT 'all'
)
RETURNS TABLE (
  id uuid,
  table_name text,
  record_id text,
  operation text,
  changed_by uuid,
  changed_at timestamptz,
  old_data jsonb,
  new_data jsonb,
  total_count bigint
) 
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  sensitive_keys text[] := ARRAY['password', 'encrypted_password', 'token', 'secret', 'hr_data', 'next_of_kin', 'documents', 'signatures', 'answers', 'pilot_data'];
  start_offset int;
BEGIN
  IF NOT (SELECT public.is_admin()) THEN RAISE EXCEPTION 'Access Denied'; END IF;
  start_offset := (page_num - 1) * page_size;
  RETURN QUERY
  WITH filtered_data AS (
    SELECT al.* FROM public.audit_logs al
    WHERE (table_filter IS NULL OR table_filter = 'all' OR al.table_name = table_filter)
      AND (op_filter IS NULL OR op_filter = 'all' OR al.operation = op_filter)
      AND (search_term IS NULL OR search_term = '' OR al.record_id ILIKE '%' || search_term || '%' OR al.table_name ILIKE '%' || search_term || '%')
  ),
  counted_data AS (
    SELECT *, count(*) OVER() as full_count FROM filtered_data ORDER BY changed_at DESC LIMIT page_size OFFSET start_offset
  )
  SELECT cd.id, cd.table_name, cd.record_id, cd.operation, cd.changed_by, cd.changed_at,
    CASE WHEN cd.old_data IS NULL THEN NULL ELSE (SELECT jsonb_object_agg(key, value) FROM jsonb_each(cd.old_data) WHERE key <> ALL(sensitive_keys)) END,
    CASE WHEN cd.new_data IS NULL THEN NULL ELSE (SELECT jsonb_object_agg(key, value) FROM jsonb_each(cd.new_data) WHERE key <> ALL(sensitive_keys)) END,
    cd.full_count
  FROM counted_data cd;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.revert_audit_log(target_log_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  log_record record;
  query text;
  pk_col text := 'id';
  pairs text[]; key text; val jsonb;
BEGIN
  IF NOT (SELECT public.is_admin()) THEN RAISE EXCEPTION 'Access Denied'; END IF;
  SELECT * INTO log_record FROM public.audit_logs WHERE id = target_log_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Audit log record not found.'; END IF;
  
  IF log_record.table_name = 'rosters' THEN pk_col := 'month_key'; END IF;

  IF log_record.operation = 'INSERT' THEN
    query := format('DELETE FROM %I WHERE %I = %L', log_record.table_name, pk_col, log_record.record_id);
    EXECUTE query;
  ELSIF log_record.operation = 'DELETE' THEN
    query := format('INSERT INTO %I SELECT * FROM jsonb_populate_record(NULL::%I, %L)', log_record.table_name, log_record.table_name, log_record.old_data);
    EXECUTE query;
  ELSIF log_record.operation = 'UPDATE' THEN
    FOR key, val IN SELECT * FROM jsonb_each(log_record.old_data) LOOP
        pairs := pairs || format('%I = %L', key, val #>> '{}');
    END LOOP;
    query := format('UPDATE %I SET %s WHERE %I = %L', log_record.table_name, array_to_string(pairs, ', '), pk_col, log_record.record_id);
    EXECUTE query;
  END IF;
  RETURN true;
END;
$$;

-- Profile Helper
CREATE OR REPLACE FUNCTION public.claim_profile_by_email()
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    u_email text;
    u_id uuid;
BEGIN
    u_id := (select auth.uid());
    SELECT email INTO u_email FROM auth.users WHERE id = u_id;
    IF u_email IS NULL THEN RETURN false; END IF;
    
    UPDATE public.staff 
    SET auth_id = u_id 
    WHERE lower(email) = lower(u_email) AND auth_id IS NULL;
    
    RETURN FOUND;
END;
$$;

-- Login Check Helper
CREATE OR REPLACE FUNCTION public.is_portal_setup()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.staff);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;
-- ==============================================================================
-- 4. TRIGGERS
-- ==============================================================================

-- 4.1 User Link
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.staff WHERE lower(email) = lower(NEW.email)) THEN
    UPDATE public.staff SET auth_id = NEW.id WHERE lower(email) = lower(NEW.email);
  ELSE
    INSERT INTO public.staff (auth_id, name, email, role_id)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', 'New User'), NEW.email, 'role_staff');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4.2 Security
CREATE OR REPLACE FUNCTION public.protect_critical_staff_columns()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT (SELECT public.is_admin()) THEN
      IF NEW.role_id IS DISTINCT FROM OLD.role_id THEN RAISE EXCEPTION 'Unauthorized: Role change.'; END IF;
      IF NEW.has_hr_rights IS DISTINCT FROM OLD.has_hr_rights THEN RAISE EXCEPTION 'Unauthorized: HR rights.'; END IF;
      IF NEW.roster_permissions IS DISTINCT FROM OLD.roster_permissions THEN RAISE EXCEPTION 'Unauthorized: Roster perms.'; END IF;
      IF NEW.individual_permissions IS DISTINCT FROM OLD.individual_permissions THEN RAISE EXCEPTION 'Unauthorized: Indiv perms.'; END IF;
      IF NEW.account_status IS DISTINCT FROM OLD.account_status THEN RAISE EXCEPTION 'Unauthorized: Status.'; END IF;
      IF NEW.department_id IS DISTINCT FROM OLD.department_id THEN RAISE EXCEPTION 'Unauthorized: Dept.'; END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS protect_staff_columns_trigger ON public.staff;
CREATE TRIGGER protect_staff_columns_trigger BEFORE UPDATE ON public.staff FOR EACH ROW EXECUTE FUNCTION public.protect_critical_staff_columns();

-- 4.3 Audit
CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id uuid;
    v_staff_id uuid;
    v_record_id text;
    v_old_data jsonb;
    v_new_data jsonb;
BEGIN
    v_user_id := (select auth.uid());
    
    -- Get staff profile ID (explicitly as UUID)
    SELECT id INTO v_staff_id FROM public.staff WHERE auth_id = v_user_id;

    -- Safely capture JSON payloads based on operation
    IF TG_OP = 'INSERT' THEN v_new_data := to_jsonb(NEW);
    ELSIF TG_OP = 'UPDATE' THEN v_old_data := to_jsonb(OLD); v_new_data := to_jsonb(NEW);
    ELSIF TG_OP = 'DELETE' THEN v_old_data := to_jsonb(OLD); END IF;

    -- DEFENSIVE ID RESOLVER: Uses JSONB to avoid "no field" crashes on tables with custom keys
    IF TG_TABLE_NAME IN ('public_holidays', 'lunch_menus') THEN 
        v_record_id := COALESCE(v_new_data->>'date', v_old_data->>'date');
    ELSIF TG_TABLE_NAME = 'department_settings' THEN 
        v_record_id := COALESCE(v_new_data->>'department_id', v_old_data->>'department_id');
    ELSIF TG_TABLE_NAME = 'rosters' THEN 
        v_record_id := COALESCE(v_new_data->>'month_key', v_old_data->>'month_key') || '_' || COALESCE(v_new_data->>'department_id', v_old_data->>'department_id');
    ELSIF TG_TABLE_NAME = 'lunch_orders' THEN 
        v_record_id := COALESCE(v_new_data->>'date', v_old_data->>'date') || '_' || COALESCE(v_new_data->>'staff_id', v_old_data->>'staff_id');
    ELSE 
        v_record_id := COALESCE(v_new_data->>'id', v_old_data->>'id', 'unknown');
    END IF;

    INSERT INTO public.audit_logs (changed_by, table_name, record_id, operation, old_data, new_data)
    VALUES (
        v_staff_id,
        TG_TABLE_NAME, 
        v_record_id, 
        TG_OP, 
        v_old_data, 
        v_new_data
    );

    RETURN (CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DO $$
DECLARE
    t text;
    tables text[] := ARRAY['staff', 'rosters', 'leave_requests', 'flight_log_records', 'exams', 'fsi_documents', 'performance_reviews', 'department_settings', 'lunch_menus', 'lunch_orders', 'aircraft_types', 'duty_swaps', 'public_holidays'];
BEGIN
    FOR t IN SELECT unnest(tables) LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS audit_trigger ON public.%I', t);
        EXECUTE format('CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.log_audit_event()', t);
    END LOOP;
END $$;
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
    
    FOR p IN (SELECT policyname FROM pg_policies WHERE tablename = t AND schemaname = 'public') LOOP
        IF p.policyname IN ('Enable all for admins', 'Public Read', 'Admin Write', 'Admin Delete', 'Manage ...', 'Support Legacy Upsert', 'View Staff', 'Read Staff', 'Update Self', 'Update Managed Dept') 
           OR p.policyname ILIKE 'Admin %' 
           OR p.policyname ILIKE '% Legacy %' 
        THEN
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, t);
        END IF;
    END LOOP;
    -- RE-CREATE SINGLE ROBUST ADMIN POLICY (Split FOR ALL to avoid recursion on staff table)
    IF t = 'staff' THEN
        EXECUTE format('CREATE POLICY "Enable all for admins" ON public.%I FOR INSERT, UPDATE, DELETE TO authenticated USING ((select public.is_admin()))', t);
    ELSE
        EXECUTE format('CREATE POLICY "Enable all for admins" ON public.%I FOR ALL TO authenticated USING ((select public.is_admin()))', t);
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
    FOREACH t IN ARRAY ARRAY['roles', 'leave_types', 'public_holidays', 'roster_view_templates', 'custom_field_definitions', 'validation_rule_sets', 'qualification_types', 'aircraft_types', 'license_types', 'special_qualifications', 'departments', 'checklist_templates', 'performance_templates', 'lunch_menus'] LOOP
        DROP POLICY IF EXISTS "Public Read" ON public.staff;
        EXECUTE format('DROP POLICY IF EXISTS "Public Read" ON %I', t);
        EXECUTE format('CREATE POLICY "Public Read" ON %I FOR SELECT TO authenticated USING (true)', t);
    END LOOP;

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
DROP POLICY IF EXISTS "Admin Delete Audit" ON public.audit_logs;
CREATE POLICY "Admin Delete Audit" ON public.audit_logs FOR DELETE TO authenticated USING ((select public.is_admin()));
DROP POLICY IF EXISTS "Admin Read Audit" ON public.audit_logs;
CREATE POLICY "Admin Read Audit" ON public.audit_logs FOR SELECT TO authenticated USING ((select public.is_admin()));
-- ==============================================================================
-- 6. PERFORMANCE INDEXES
-- ==============================================================================

CREATE INDEX IF NOT EXISTS idx_staff_auth_id ON public.staff(auth_id);
CREATE INDEX IF NOT EXISTS idx_staff_department_id ON public.staff(department_id);
CREATE INDEX IF NOT EXISTS idx_staff_role_id ON public.staff(role_id);
CREATE INDEX IF NOT EXISTS idx_departments_manager_id ON public.departments(manager_id);

CREATE INDEX IF NOT EXISTS idx_rosters_month_key ON public.rosters(month_key);
CREATE INDEX IF NOT EXISTS idx_rosters_department_id ON public.rosters(department_id);
CREATE INDEX IF NOT EXISTS idx_flight_log_date ON public.flight_log_records(date);
CREATE INDEX IF NOT EXISTS idx_flight_log_staff_id ON public.flight_log_records(staff_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_staff_id ON public.leave_requests(staff_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_dates ON public.leave_requests(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON public.leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_transactions_staff_id ON public.leave_transactions(staff_id);
CREATE INDEX IF NOT EXISTS idx_leave_transactions_date ON public.leave_transactions(date);

CREATE INDEX IF NOT EXISTS idx_fsi_acknowledgments_staff ON public.fsi_acknowledgments(staff_id);
CREATE INDEX IF NOT EXISTS idx_fsi_acknowledgments_doc ON public.fsi_acknowledgments(document_id);
CREATE INDEX IF NOT EXISTS idx_exams_department_id ON public.exams(department_id);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_exam_id ON public.exam_attempts(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_staff_id ON public.exam_attempts(staff_id);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_completed ON public.exam_attempts(completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_questions_department_id ON public.questions(department_id);

CREATE INDEX IF NOT EXISTS idx_performance_reviews_staff ON public.performance_reviews(staff_id);
CREATE INDEX IF NOT EXISTS idx_performance_reviews_manager ON public.performance_reviews(manager_id);
CREATE INDEX IF NOT EXISTS idx_duty_swaps_requester ON public.duty_swaps(requester_staff_id);
CREATE INDEX IF NOT EXISTS idx_duty_swaps_target ON public.duty_swaps(target_staff_id);
CREATE INDEX IF NOT EXISTS idx_duty_swaps_date ON public.duty_swaps(date);

CREATE INDEX IF NOT EXISTS idx_audit_table_name ON public.audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_record_id ON public.audit_logs(record_id);
CREATE INDEX IF NOT EXISTS idx_audit_changed_at ON public.audit_logs(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_changed_by ON public.audit_logs(changed_by);

ANALYZE;
-- ==============================================================================
-- 7. STORAGE SETUP
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('portal-uploads', 'portal-uploads', true) ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access" ON storage.objects FOR SELECT TO public USING ( bucket_id = 'portal-uploads' );
DROP POLICY IF EXISTS "Authenticated Upload" ON storage.objects;
CREATE POLICY "Authenticated Upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK ( bucket_id = 'portal-uploads' );
DROP POLICY IF EXISTS "Owner Update" ON storage.objects;
CREATE POLICY "Owner Update" ON storage.objects FOR UPDATE TO authenticated USING ( bucket_id = 'portal-uploads' AND (select auth.uid()) = owner );
DROP POLICY IF EXISTS "Owner Delete" ON storage.objects;
CREATE POLICY "Owner Delete" ON storage.objects FOR DELETE TO authenticated USING ( bucket_id = 'portal-uploads' AND (select auth.uid()) = owner );
-- ==============================================================================
-- 8. SEED DATA (BOOTSTRAPPING)
-- ==============================================================================

-- Ensure standard roles exist
INSERT INTO public.roles (id, name, permissions) VALUES
('role_super_admin', 'Super Admin', '{}'),
('role_admin', 'Administrator', '{}'),
('role_manager', 'Manager', '{}'),
('role_staff', 'Staff', '{}')
ON CONFLICT (id) DO NOTHING;

-- Ensure default departments exist
INSERT INTO public.departments (id, name) VALUES
('dept_pilots', 'Flight Operations'),
('all', 'System-Wide (All Departments)')
ON CONFLICT (id) DO NOTHING;
