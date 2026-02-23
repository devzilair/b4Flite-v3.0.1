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
