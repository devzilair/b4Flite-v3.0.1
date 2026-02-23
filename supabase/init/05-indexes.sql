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

-- Clean up duplicate indexes (Advisor 0009)
DROP INDEX IF EXISTS idx_leave_transactions_date;
CREATE INDEX IF NOT EXISTS idx_leave_trans_date ON public.leave_transactions(date);

DROP INDEX IF EXISTS idx_fsi_acks_staff_id;
CREATE INDEX IF NOT EXISTS idx_fsi_acknowledgments_staff ON public.fsi_acknowledgments(staff_id);

DROP INDEX IF EXISTS idx_fsi_acks_doc_id;
CREATE INDEX IF NOT EXISTS idx_fsi_acknowledgments_doc ON public.fsi_acknowledgments(document_id);

CREATE INDEX IF NOT EXISTS idx_exams_department_id ON public.exams(department_id);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_exam_id ON public.exam_attempts(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_staff_id ON public.exam_attempts(staff_id);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_completed ON public.exam_attempts(completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_questions_department_id ON public.questions(department_id);

DROP INDEX IF EXISTS idx_performance_reviews_staff_id;
CREATE INDEX IF NOT EXISTS idx_performance_reviews_staff ON public.performance_reviews(staff_id);

DROP INDEX IF EXISTS idx_performance_reviews_manager;
CREATE INDEX IF NOT EXISTS idx_perf_reviews_manager_id ON public.performance_reviews(manager_id);

CREATE INDEX IF NOT EXISTS idx_duty_swaps_requester ON public.duty_swaps(requester_staff_id);
CREATE INDEX IF NOT EXISTS idx_duty_swaps_target ON public.duty_swaps(target_staff_id);
CREATE INDEX IF NOT EXISTS idx_duty_swaps_date ON public.duty_swaps(date);

CREATE INDEX IF NOT EXISTS idx_audit_table_name ON public.audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_record_id ON public.audit_logs(record_id);
CREATE INDEX IF NOT EXISTS idx_audit_changed_at ON public.audit_logs(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_changed_by ON public.audit_logs(changed_by);

ANALYZE;
