export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Stage = 'group' | 'round_of_32' | 'round_of_16' | 'quarter' | 'semi' | 'third_place' | 'final'
export type Side = 'home' | 'away'

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      bonus_predictions: {
        Row: { answer: string; bonus_id: string; created_at: string; id: string; updated_at: string; user_id: string }
        Insert: { answer: string; bonus_id: string; created_at?: string; id?: string; updated_at?: string; user_id: string }
        Update: { answer?: string; bonus_id?: string; created_at?: string; id?: string; updated_at?: string; user_id?: string }
        Relationships: []
      }
      group_members: {
        Row: { group_id: string; joined_at: string; user_id: string }
        Insert: { group_id: string; joined_at?: string; user_id: string }
        Update: { group_id?: string; joined_at?: string; user_id?: string }
        Relationships: []
      }
      groups: {
        Row: { avatar_url: string | null; created_at: string; created_by: string | null; id: string; invite_code: string; max_players: number; name: string; region: string | null }
        Insert: { avatar_url?: string | null; created_at?: string; created_by?: string | null; id?: string; invite_code: string; max_players?: number; name: string; region?: string | null }
        Update: { avatar_url?: string | null; created_at?: string; created_by?: string | null; id?: string; invite_code?: string; max_players?: number; name?: string; region?: string | null }
        Relationships: []
      }
      matches: {
        Row: { away_code: string | null; away_score: number | null; away_team: string; created_at: string; force_open: boolean; home_code: string | null; home_score: number | null; home_team: string; id: string; is_knockout: boolean; kickoff_at: string; match_no: number | null; penalty_winner: string | null; predictions_locked: boolean; result_final: boolean; stage: string }
        Insert: { away_code?: string | null; away_score?: number | null; away_team: string; created_at?: string; force_open?: boolean; home_code?: string | null; home_score?: number | null; home_team: string; id?: string; is_knockout?: boolean; kickoff_at: string; match_no?: number | null; penalty_winner?: string | null; predictions_locked?: boolean; result_final?: boolean; stage: string }
        Update: { away_code?: string | null; away_score?: number | null; away_team?: string; created_at?: string; force_open?: boolean; home_code?: string | null; home_score?: number | null; home_team?: string; id?: string; is_knockout?: boolean; kickoff_at?: string; match_no?: number | null; penalty_winner?: string | null; predictions_locked?: boolean; result_final?: boolean; stage?: string }
        Relationships: []
      }
      news_items: {
        Row: { id: string; image_url: string; caption: string | null; sort_order: number; created_at: string }
        Insert: { id?: string; image_url: string; caption?: string | null; sort_order?: number; created_at?: string }
        Update: { id?: string; image_url?: string; caption?: string | null; sort_order?: number; created_at?: string }
        Relationships: []
      }
      phase_deadlines: {
        Row: { lock_at: string; stage: string }
        Insert: { lock_at: string; stage: string }
        Update: { lock_at?: string; stage?: string }
        Relationships: []
      }
      predictions: {
        Row: { created_at: string; id: string; match_id: string; pred_advancer: string | null; pred_away: number; pred_home: number; updated_at: string; user_id: string }
        Insert: { created_at?: string; id?: string; match_id: string; pred_advancer?: string | null; pred_away: number; pred_home: number; updated_at?: string; user_id: string }
        Update: { created_at?: string; id?: string; match_id?: string; pred_advancer?: string | null; pred_away?: number; pred_home?: number; updated_at?: string; user_id?: string }
        Relationships: []
      }
      profiles: {
        Row: { created_at: string; display_name: string; id: string; is_admin: boolean }
        Insert: { created_at?: string; display_name: string; id: string; is_admin?: boolean }
        Update: { created_at?: string; display_name?: string; id?: string; is_admin?: boolean }
        Relationships: []
      }
      tournament_bonuses: {
        Row: { correct_answer: string | null; created_at: string; id: string; is_active: boolean; key: string; label: string; lock_at: string | null; locked: boolean; points: number }
        Insert: { correct_answer?: string | null; created_at?: string; id?: string; is_active?: boolean; key: string; label: string; lock_at?: string | null; locked?: boolean; points?: number }
        Update: { correct_answer?: string | null; created_at?: string; id?: string; is_active?: boolean; key?: string; label?: string; lock_at?: string | null; locked?: boolean; points?: number }
        Relationships: []
      }
    }
    Views: {
      bonus_scores: { Row: { bonus_id: string | null; points: number | null; user_id: string | null }; Relationships: [] }
      leaderboard: { Row: { display_name: string | null; exact_hits: number | null; partial_hits: number | null; total_points: number | null; user_id: string | null }; Relationships: [] }
      prediction_scores: { Row: { away_score: number | null; home_score: number | null; id: string | null; is_knockout: boolean | null; match_id: string | null; penalty_winner: string | null; points: number | null; pred_advancer: string | null; pred_away: number | null; pred_home: number | null; result_final: boolean | null; stage: string | null; user_id: string | null }; Relationships: [] }
    }
    Functions: {
      create_group: { Args: { p_name: string; p_region?: string }; Returns: Database['public']['Tables']['groups']['Row'] }
      group_leaderboard: { Args: { p_group: string }; Returns: { display_name: string; exact_hits: number; partial_hits: number; total_points: number; user_id: string }[] }
      is_admin: { Args: Record<never, never>; Returns: boolean }
      join_group: { Args: { p_code: string }; Returns: Database['public']['Tables']['groups']['Row'] }
      match_open: { Args: { p_match_id: string }; Returns: boolean }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}

// Convenience row types
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Match = Database['public']['Tables']['matches']['Row']
export type Prediction = Database['public']['Tables']['predictions']['Row']
export type PhaseDeadline = Database['public']['Tables']['phase_deadlines']['Row']
export type TournamentBonus = Database['public']['Tables']['tournament_bonuses']['Row']
export type BonusPrediction = Database['public']['Tables']['bonus_predictions']['Row']
export type Group = Database['public']['Tables']['groups']['Row']
export type GroupMember = Database['public']['Tables']['group_members']['Row']
export type PredictionScore = Database['public']['Views']['prediction_scores']['Row']
export type LeaderboardRow = Database['public']['Views']['leaderboard']['Row']
