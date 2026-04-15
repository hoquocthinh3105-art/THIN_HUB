export type Role = 'teacher' | 'officer' | 'student';

export interface User {
  id: number;
  username: string;
  full_name: string;
  role: Role;
  class_name: string;
  school_name: string;
  position?: string;
  student_code?: string;
  default_password?: string;
  is_pro?: number;
  xp?: number;
  level?: number;
}

export interface Attendance {
  id: number;
  student_id: number;
  student_name: string;
  date: string;
  status: 'present' | 'absent_permission' | 'absent_no_permission' | 'late';
  note?: string;
  is_verified?: number;
}

export interface DisciplineRecord {
  id: number;
  student_id: number;
  student_name?: string;
  week_start_date: string;
  points: number;
  reason: string;
  created_by: number;
  creator_name?: string;
  created_at: string;
}

export interface Material {
  id: number;
  title: string;
  subject: string;
  file_path: string;
  created_at: string;
  is_saved?: number;
}

export interface Assignment {
  id: number;
  title: string;
  description: string;
  deadline: string;
  subject: string;
  file_path?: string;
  teacher_name?: string;
}

export interface Submission {
  id: number;
  assignment_id: number;
  student_id: number;
  student_name: string;
  file_path?: string;
  content?: string;
  grade?: string;
  feedback?: string;
  submitted_at: string;
}

export interface Announcement {
  id: number;
  title: string;
  content: string;
  created_at: string;
}

export interface LeaveRequest {
  id: number;
  student_id: number;
  student_name?: string;
  reason: string;
  period: string;
  status: 'pending' | 'approved' | 'rejected';
  approved_by?: number;
  teacher_name?: string;
  created_at: string;
  updated_at: string;
}

export interface TimetableSlot {
  id: number;
  day_of_week: number;
  period: number;
  subject: string;
  teacher_name: string;
  start_time: string;
  end_time: string;
  class_name: string;
}
