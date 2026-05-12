export type Choice = 'A' | 'B' | 'C' | 'D';

export type Room = {
  id: string;
  question_id: string;
  question_text: string;
  choice_a: string;
  choice_b: string;
  choice_c: string;
  choice_d: string;
  correct_choice: Choice | null;
  status: 'waiting' | 'open' | 'closed';
  updated_at: string;
};

export type Answer = {
  room_id: string;
  question_id: string;
  name: string;
  selected_choice: Choice;
  submitted_at: string;
};

export type Score = {
  room_id: string;
  name: string;
  correct_count: number;
  updated_at: string;
};
