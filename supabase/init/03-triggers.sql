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
