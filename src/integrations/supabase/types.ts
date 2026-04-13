export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      call_reports: {
        Row: {
          ai_summary: string | null
          alert_reason: string | null
          alert_sent: boolean | null
          ate_today: boolean | null
          call_type: string | null
          called_at: string | null
          duration_seconds: number | null
          elder_id: string
          id: string
          medications_taken: boolean | null
          mood_score: number | null
          transcript: string | null
        }
        Insert: {
          ai_summary?: string | null
          alert_reason?: string | null
          alert_sent?: boolean | null
          ate_today?: boolean | null
          call_type?: string | null
          called_at?: string | null
          duration_seconds?: number | null
          elder_id: string
          id?: string
          medications_taken?: boolean | null
          mood_score?: number | null
          transcript?: string | null
        }
        Update: {
          ai_summary?: string | null
          alert_reason?: string | null
          alert_sent?: boolean | null
          ate_today?: boolean | null
          call_type?: string | null
          called_at?: string | null
          duration_seconds?: number | null
          elder_id?: string
          id?: string
          medications_taken?: boolean | null
          mood_score?: number | null
          transcript?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_reports_elder_id_fkey"
            columns: ["elder_id"]
            isOneToOne: false
            referencedRelation: "elders"
            referencedColumns: ["id"]
          },
        ]
      }
      elders: {
        Row: {
          address: string | null
          call_time_evening: string | null
          call_time_morning: string | null
          created_at: string | null
          created_by: string
          date_of_birth: string | null
          full_name: string
          id: string
          is_active: boolean | null
          notes: string | null
          phone_number: string
        }
        Insert: {
          address?: string | null
          call_time_evening?: string | null
          call_time_morning?: string | null
          created_at?: string | null
          created_by: string
          date_of_birth?: string | null
          full_name: string
          id?: string
          is_active?: boolean | null
          notes?: string | null
          phone_number: string
        }
        Update: {
          address?: string | null
          call_time_evening?: string | null
          call_time_morning?: string | null
          created_at?: string | null
          created_by?: string
          date_of_birth?: string | null
          full_name?: string
          id?: string
          is_active?: boolean | null
          notes?: string | null
          phone_number?: string
        }
        Relationships: []
      }
      family_members: {
        Row: {
          elder_id: string
          email: string | null
          full_name: string
          id: string
          phone_number: string
          receives_alerts: boolean | null
          receives_daily_report: boolean | null
          relationship: string | null
        }
        Insert: {
          elder_id: string
          email?: string | null
          full_name: string
          id?: string
          phone_number: string
          receives_alerts?: boolean | null
          receives_daily_report?: boolean | null
          relationship?: string | null
        }
        Update: {
          elder_id?: string
          email?: string | null
          full_name?: string
          id?: string
          phone_number?: string
          receives_alerts?: boolean | null
          receives_daily_report?: boolean | null
          relationship?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "family_members_elder_id_fkey"
            columns: ["elder_id"]
            isOneToOne: false
            referencedRelation: "elders"
            referencedColumns: ["id"]
          },
        ]
      }
      medications: {
        Row: {
          created_at: string | null
          dosage: string | null
          elder_id: string
          evening: boolean | null
          id: string
          instructions: string | null
          morning: boolean | null
          name: string
          noon: boolean | null
          times_per_day: number | null
        }
        Insert: {
          created_at?: string | null
          dosage?: string | null
          elder_id: string
          evening?: boolean | null
          id?: string
          instructions?: string | null
          morning?: boolean | null
          name: string
          noon?: boolean | null
          times_per_day?: number | null
        }
        Update: {
          created_at?: string | null
          dosage?: string | null
          elder_id?: string
          evening?: boolean | null
          id?: string
          instructions?: string | null
          morning?: boolean | null
          name?: string
          noon?: boolean | null
          times_per_day?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "medications_elder_id_fkey"
            columns: ["elder_id"]
            isOneToOne: false
            referencedRelation: "elders"
            referencedColumns: ["id"]
          },
        ]
      }
      reminders: {
        Row: {
          created_at: string | null
          elder_id: string
          id: string
          is_sent: boolean | null
          message: string
          method: string | null
          remind_at: string
        }
        Insert: {
          created_at?: string | null
          elder_id: string
          id?: string
          is_sent?: boolean | null
          message: string
          method?: string | null
          remind_at: string
        }
        Update: {
          created_at?: string | null
          elder_id?: string
          id?: string
          is_sent?: boolean | null
          message?: string
          method?: string | null
          remind_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminders_elder_id_fkey"
            columns: ["elder_id"]
            isOneToOne: false
            referencedRelation: "elders"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_log: {
        Row: {
          elder_id: string | null
          id: string
          message: string | null
          sent_at: string | null
          to_number: string | null
          type: string | null
        }
        Insert: {
          elder_id?: string | null
          id?: string
          message?: string | null
          sent_at?: string | null
          to_number?: string | null
          type?: string | null
        }
        Update: {
          elder_id?: string | null
          id?: string
          message?: string | null
          sent_at?: string | null
          to_number?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_log_elder_id_fkey"
            columns: ["elder_id"]
            isOneToOne: false
            referencedRelation: "elders"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
