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
  is_auth boolean;
BEGIN
  -- CHECK PERMISSION: Admin or granular 'audit:view'
  SELECT (
    public.is_admin() OR 
    EXISTS (
      SELECT 1 FROM public.staff s
      LEFT JOIN public.roles r ON s.role_id = r.id
      WHERE s.auth_id = (select auth.uid())
      AND ('audit:view' = ANY(r.permissions) OR 'audit:view' = ANY(s.individual_permissions))
    )
  ) INTO is_auth;

  IF NOT is_auth THEN RAISE EXCEPTION 'Access Denied'; END IF;
  
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
  is_auth boolean;
BEGIN
  -- CHECK PERMISSION: Admin or granular 'audit:revert'
  SELECT (
    public.is_admin() OR 
    EXISTS (
      SELECT 1 FROM public.staff s
      LEFT JOIN public.roles r ON s.role_id = r.id
      WHERE s.auth_id = (select auth.uid())
      AND ('audit:revert' = ANY(r.permissions) OR 'audit:revert' = ANY(s.individual_permissions))
    )
  ) INTO is_auth;

  IF NOT is_auth THEN RAISE EXCEPTION 'Access Denied'; END IF;

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
