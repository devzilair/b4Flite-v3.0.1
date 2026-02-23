
import { z } from 'zod';

// Helper for Boolean null-to-false coercion
const boolCoerce = z.preprocess((val) => val === null ? false : val, z.boolean().default(false));

// Helper for Number coercion that handles empty strings/nulls gracefully
const numberCoerce = z.preprocess(
  (val) => (val === '' || val === null || val === undefined ? null : Number(val)),
  z.number().optional().nullable()
);

// Helper for Integer coercion
const intCoerce = z.preprocess(
  (val) => (val === '' || val === null || val === undefined ? null : parseInt(String(val), 10)),
  z.number().int().optional().nullable()
);

export const StaffSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address").or(z.literal("")).or(z.null()),
  phone: z.string().optional(),
  roleId: z.string().min(1, "Role is required"),
  departmentId: z.string().min(1, "Department is required"),
  accountStatus: z.enum(['active', 'disabled', 'archived']),
  subDepartments: z.array(z.string()).default([]),
  individualPermissions: z.array(z.string()).default([]),
  managedSubDepartments: z.array(z.string()).default([]),
  hasHrRights: z.boolean().optional().default(false),
}).passthrough();

export type StaffInput = z.infer<typeof StaffSchema>;

export const LeaveRequestSchema = z.object({
  leaveTypeId: z.string().min(1, "Leave type is required"),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid start date"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid end date"),
  destination: z.enum(['local', 'overseas']).optional(),
  contactNumber: z.string().optional(),
  justification: z.string().optional(),
  notes: z.string().optional(),
  phDaysApplied: numberCoerce, // Robust coercion
}).refine(data => new Date(data.startDate) <= new Date(data.endDate), {
  message: "End date cannot be before start date",
  path: ["endDate"]
});

export type LeaveRequestInput = z.infer<typeof LeaveRequestSchema>;

export const QuestionSchema = z.object({
  id: z.string().optional(),
  text: z.string().min(5, "Question text must be at least 5 characters"),
  type: z.enum(['mcq', 'true_false']),
  options: z.array(z.string()).optional(),
  correctAnswer: z.string().min(1, "Correct answer is required"),
  category: z.string().min(2, "Category is required"),
  departmentId: z.string().optional().nullable(),
  imageUrl: z.string().url("Invalid image URL").or(z.literal("")).or(z.null()).optional(),
}).refine(data => {
  if (data.type === 'mcq') {
    return data.options && data.options.length >= 2;
  }
  return true;
}, {
  message: "Multiple choice questions must have at least 2 options",
  path: ["options"]
}).refine(data => {
  if (data.type === 'mcq' && data.options) {
    return data.options.includes(data.correctAnswer);
  }
  return true;
}, {
  message: "The correct answer must be one of the provided options",
  path: ["correctAnswer"]
});

export const ExamSchema = z.object({
  title: z.string().min(3, "Title is required"),
  timeLimitMinutes: intCoerce, // Robust coercion
  passMarkPercentage: numberCoerce, // Robust coercion
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid due date format").optional().nullable(),
  categoryRules: z.record(z.number().min(0)).optional(),
}).passthrough();

export const StaffDocumentSchema = z.object({
  name: z.string().min(3, "Document name is required"),
  documentUrl: z.string().optional().default(""), // Allow empty for manual records
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid issue date"),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid expiry date").or(z.literal("")).or(z.null()).optional(),
  qualificationTypeId: z.string().optional().nullable(),
  restrictions: z.string().optional(),
}).refine(data => {
  if (!data.expiryDate) return true;
  return new Date(data.expiryDate) > new Date(data.issueDate);
}, {
  message: "Expiry date must be after the issue date",
  path: ["expiryDate"]
});

export const DutyRecordSchema = z.object({
  date: z.string().min(10, "Date is required"),
  dutyStart: z.string().optional().nullable(),
  dutyEnd: z.string().optional().nullable(),
  fdpStart: z.string().optional().nullable(),
  fdpEnd: z.string().optional().nullable(),
  breakStart: z.string().optional().nullable(),
  breakEnd: z.string().optional().nullable(),
  standbyOn: z.string().optional().nullable(),
  standbyOff: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
  sectors: intCoerce,
  isTwoPilotOperation: boolCoerce,
  isSplitDuty: boolCoerce,
  aircraftType: z.string().optional().nullable(),
  // Ensure flight hours map values are numbers
  flightHoursByAircraft: z.preprocess(
    (val) => (val === null || val === undefined ? {} : val),
    z.record(z.string(), z.preprocess((v) => Number(v), z.number()))
  ).optional().nullable(),
}).passthrough();

export type DutyRecordInput = z.infer<typeof DutyRecordSchema>;
