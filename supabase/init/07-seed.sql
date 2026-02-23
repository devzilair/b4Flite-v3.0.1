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
