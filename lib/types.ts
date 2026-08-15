export type CompetitionStatus =
  | "draft"
  | "ready"
  | "live"
  | "paused"
  | "team_stage_finished"
  | "knockout"
  | "finished";

export type QuestionType =
  | "multiple_choice"
  | "true_false"
  | "short_answer"
  | "oral"
  | "image"
  | "audio"
  | "video";

export type Phase = "idle" | "question" | "judging" | "break" | "knockout" | "finished";

export interface Settings {
  question_seconds: number;
  default_points: number;
  answer_seconds: number;
  break_seconds: number;
  teams_count: number;
  distribution: "auto" | "manual";
  knockout_seeding: "ranked" | "random";
  knockout_odd_handling: "bye" | "play_in";
  tiebreaker: string;
  show_student_points: boolean;
  show_student_names: boolean;
  buzzer_enabled: boolean;
  allow_retry: boolean;
  max_attempts_per_question: number;
  wrong_answer_penalty: number;
  sounds_enabled: boolean;
  single_device_per_code: boolean;
}

export interface Competition {
  id: string;
  name: string;
  event_date: string | null;
  status: CompetitionStatus;
  is_demo: boolean;
  settings: Settings;
  created_at: string;
  finished_at: string | null;
}

export interface Team {
  id: string;
  competition_id: string;
  name: string;
  color: string;
  emoji: string;
  logo_url: string | null;
  score: number;
  sort_order: number;
}

export interface Student {
  id: string;
  competition_id: string;
  team_id: string | null;
  name: string;
  is_captain: boolean;
  points: number;
  correct_count: number;
  wrong_count: number;
  buzz_count: number;
  total_reaction_ms: number;
  active: boolean;
}

export interface Question {
  id: string;
  competition_id: string;
  order_index: number;
  type: QuestionType;
  text: string;
  media_url: string | null;
  correct_answer: string | null;
  points: number;
  time_limit: number;
  is_golden: boolean;
  asked: boolean;
}

export interface QuestionOption {
  id: string;
  question_id: string;
  label: string;
  is_correct: boolean;
  order_index: number;
}

export interface PublicQuestion {
  number: number;
  text: string;
  type: QuestionType;
  media_url: string | null;
  options: { id: string; label: string }[];
  points: number;
  started_at: string;
  ends_at: string;
  seconds: number;
}

export interface FirstBuzz {
  buzz_id: string;
  student_id: string;
  student_name: string;
  team_id: string;
  team_name: string;
  team_emoji: string;
  team_color: string;
  reaction_ms: number;
}

export interface CompetitionState {
  competition_id: string;
  phase: Phase;
  session_id: string | null;
  question_public: PublicQuestion | null;
  buzzer_open: boolean;
  first_buzz: FirstBuzz | null;
  banner: string | null;
  updated_at: string;
}

export interface Powerup {
  id: string;
  competition_id: string;
  key: string;
  name: string;
  description: string;
  icon: string;
  unlock_points: number;
  max_uses: number;
  requires_approval: boolean;
  applies_to: "next" | "current";
  enabled: boolean;
  sort_order: number;
}

export interface TeamPowerup {
  id: string;
  team_id: string;
  powerup_id: string;
  uses_left: number;
  unlocked: boolean;
  armed: boolean;
  used_count: number;
}

export interface PowerupRequest {
  id: string;
  competition_id: string;
  team_id: string;
  powerup_id: string;
  requested_by: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
}

export interface Round {
  id: string;
  competition_id: string;
  name: string;
  round_index: number;
  status: string;
}

export interface Match {
  id: string;
  round_id: string;
  match_index: number;
  student_a: string | null;
  student_b: string | null;
  winner_id: string | null;
  is_bye: boolean;
  status: "pending" | "live" | "finished";
  next_match_id: string | null;
  next_slot: "a" | "b" | null;
}

export interface LiveEvent {
  id: string;
  competition_id: string;
  actor_type: "system" | "supervisor" | "student";
  actor_name: string | null;
  type: string;
  message: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface StudentSession {
  sid: string;
  cid: string;
  epoch: number;
  exp: number;
}
