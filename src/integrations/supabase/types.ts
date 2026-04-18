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
      book_chapters: {
        Row: {
          chapter_number: number
          content_markdown: string | null
          created_at: string | null
          elder_id: string
          id: string
          last_edited_at: string | null
          last_generated_at: string | null
          life_stage: string
          prose_generated_at: string | null
          prose_source_notes_version: number | null
          status: string | null
          title: string
          version: number | null
          word_count: number | null
        }
        Insert: {
          chapter_number: number
          content_markdown?: string | null
          created_at?: string | null
          elder_id: string
          id?: string
          last_edited_at?: string | null
          last_generated_at?: string | null
          life_stage: string
          prose_generated_at?: string | null
          prose_source_notes_version?: number | null
          status?: string | null
          title: string
          version?: number | null
          word_count?: number | null
        }
        Update: {
          chapter_number?: number
          content_markdown?: string | null
          created_at?: string | null
          elder_id?: string
          id?: string
          last_edited_at?: string | null
          last_generated_at?: string | null
          life_stage?: string
          prose_generated_at?: string | null
          prose_source_notes_version?: number | null
          status?: string | null
          title?: string
          version?: number | null
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "book_chapters_elder_id_fkey"
            columns: ["elder_id"]
            isOneToOne: false
            referencedRelation: "elders"
            referencedColumns: ["id"]
          },
        ]
      }
      call_reports: {
        Row: {
          ai_summary: string | null
          alert_reason: string | null
          alert_sent: boolean | null
          ate_today: boolean | null
          audio_url: string | null
          call_type: string | null
          called_at: string | null
          duration_seconds: number | null
          elder_id: string
          hume_all_emotions: Json | null
          hume_anger: number | null
          hume_anxiety: number | null
          hume_confusion: number | null
          hume_distress_score: number | null
          hume_joy: number | null
          hume_raw: Json | null
          hume_sadness: number | null
          hume_social_score: number | null
          hume_tiredness: number | null
          hume_top_emotions: Json | null
          hume_wellbeing_score: number | null
          id: string
          medications_taken: boolean | null
          mood_score: number | null
          mood_source: string | null
          processed_at: string | null
          transcript: string | null
          vapi_call_id: string | null
        }
        Insert: {
          ai_summary?: string | null
          alert_reason?: string | null
          alert_sent?: boolean | null
          ate_today?: boolean | null
          audio_url?: string | null
          call_type?: string | null
          called_at?: string | null
          duration_seconds?: number | null
          elder_id: string
          hume_all_emotions?: Json | null
          hume_anger?: number | null
          hume_anxiety?: number | null
          hume_confusion?: number | null
          hume_distress_score?: number | null
          hume_joy?: number | null
          hume_raw?: Json | null
          hume_sadness?: number | null
          hume_social_score?: number | null
          hume_tiredness?: number | null
          hume_top_emotions?: Json | null
          hume_wellbeing_score?: number | null
          id?: string
          medications_taken?: boolean | null
          mood_score?: number | null
          mood_source?: string | null
          processed_at?: string | null
          transcript?: string | null
          vapi_call_id?: string | null
        }
        Update: {
          ai_summary?: string | null
          alert_reason?: string | null
          alert_sent?: boolean | null
          ate_today?: boolean | null
          audio_url?: string | null
          call_type?: string | null
          called_at?: string | null
          duration_seconds?: number | null
          elder_id?: string
          hume_all_emotions?: Json | null
          hume_anger?: number | null
          hume_anxiety?: number | null
          hume_confusion?: number | null
          hume_distress_score?: number | null
          hume_joy?: number | null
          hume_raw?: Json | null
          hume_sadness?: number | null
          hume_social_score?: number | null
          hume_tiredness?: number | null
          hume_top_emotions?: Json | null
          hume_wellbeing_score?: number | null
          id?: string
          medications_taken?: boolean | null
          mood_score?: number | null
          mood_source?: string | null
          processed_at?: string | null
          transcript?: string | null
          vapi_call_id?: string | null
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
      chapter_notes: {
        Row: {
          chapter_id: string | null
          created_at: string | null
          elder_id: string
          id: string
          last_updated_at: string | null
          life_stage: string
          notes_markdown: string | null
          word_count: number | null
        }
        Insert: {
          chapter_id?: string | null
          created_at?: string | null
          elder_id: string
          id?: string
          last_updated_at?: string | null
          life_stage: string
          notes_markdown?: string | null
          word_count?: number | null
        }
        Update: {
          chapter_id?: string | null
          created_at?: string | null
          elder_id?: string
          id?: string
          last_updated_at?: string | null
          life_stage?: string
          notes_markdown?: string | null
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "chapter_notes_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "book_chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chapter_notes_elder_id_fkey"
            columns: ["elder_id"]
            isOneToOne: false
            referencedRelation: "elders"
            referencedColumns: ["id"]
          },
        ]
      }
      chapter_revisions: {
        Row: {
          ai_model_used: string | null
          change_reason: string | null
          chapter_id: string
          content_markdown: string
          created_at: string | null
          created_by_ai: boolean | null
          id: string
          prompt_version: string | null
          word_count: number | null
        }
        Insert: {
          ai_model_used?: string | null
          change_reason?: string | null
          chapter_id: string
          content_markdown: string
          created_at?: string | null
          created_by_ai?: boolean | null
          id?: string
          prompt_version?: string | null
          word_count?: number | null
        }
        Update: {
          ai_model_used?: string | null
          change_reason?: string | null
          chapter_id?: string
          content_markdown?: string
          created_at?: string | null
          created_by_ai?: boolean | null
          id?: string
          prompt_version?: string | null
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "chapter_revisions_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "book_chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      cognitive_assessments: {
        Row: {
          assessed_at: string | null
          call_report_id: string | null
          created_at: string | null
          elder_id: string
          flags: string[] | null
          fluency_score: number | null
          id: string
          memory_score: number | null
          observations: string | null
          orientation_score: number | null
          overall_impression: string | null
        }
        Insert: {
          assessed_at?: string | null
          call_report_id?: string | null
          created_at?: string | null
          elder_id: string
          flags?: string[] | null
          fluency_score?: number | null
          id?: string
          memory_score?: number | null
          observations?: string | null
          orientation_score?: number | null
          overall_impression?: string | null
        }
        Update: {
          assessed_at?: string | null
          call_report_id?: string | null
          created_at?: string | null
          elder_id?: string
          flags?: string[] | null
          fluency_score?: number | null
          id?: string
          memory_score?: number | null
          observations?: string | null
          orientation_score?: number | null
          overall_impression?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cognitive_assessments_call_report_id_fkey"
            columns: ["call_report_id"]
            isOneToOne: false
            referencedRelation: "call_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cognitive_assessments_elder_id_fkey"
            columns: ["elder_id"]
            isOneToOne: false
            referencedRelation: "elders"
            referencedColumns: ["id"]
          },
        ]
      }
      coverage_map: {
        Row: {
          created_at: string | null
          depth_score: number | null
          elder_id: string
          id: string
          is_sensitive: boolean | null
          last_discussed: string | null
          life_stage: string
          priority: number | null
          questions_asked: number | null
          requires_trust_first: boolean | null
          status: string | null
          theme: string | null
        }
        Insert: {
          created_at?: string | null
          depth_score?: number | null
          elder_id: string
          id?: string
          is_sensitive?: boolean | null
          last_discussed?: string | null
          life_stage: string
          priority?: number | null
          questions_asked?: number | null
          requires_trust_first?: boolean | null
          status?: string | null
          theme?: string | null
        }
        Update: {
          created_at?: string | null
          depth_score?: number | null
          elder_id?: string
          id?: string
          is_sensitive?: boolean | null
          last_discussed?: string | null
          life_stage?: string
          priority?: number | null
          questions_asked?: number | null
          requires_trust_first?: boolean | null
          status?: string | null
          theme?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coverage_map_elder_id_fkey"
            columns: ["elder_id"]
            isOneToOne: false
            referencedRelation: "elders"
            referencedColumns: ["id"]
          },
        ]
      }
      elder_memory: {
        Row: {
          content: string
          created_at: string | null
          elder_id: string
          id: string
          memory_type: string
          updated_at: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          elder_id: string
          id?: string
          memory_type: string
          updated_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          elder_id?: string
          id?: string
          memory_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "elder_memory_elder_id_fkey"
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
          cognitive_tracking_enabled: boolean | null
          created_at: string | null
          created_by: string
          date_of_birth: string | null
          full_name: string
          id: string
          is_active: boolean | null
          notes: string | null
          phone_number: string
          postal_code: string | null
        }
        Insert: {
          address?: string | null
          call_time_evening?: string | null
          call_time_morning?: string | null
          cognitive_tracking_enabled?: boolean | null
          created_at?: string | null
          created_by: string
          date_of_birth?: string | null
          full_name: string
          id?: string
          is_active?: boolean | null
          notes?: string | null
          phone_number: string
          postal_code?: string | null
        }
        Update: {
          address?: string | null
          call_time_evening?: string | null
          call_time_morning?: string | null
          cognitive_tracking_enabled?: boolean | null
          created_at?: string | null
          created_by?: string
          date_of_birth?: string | null
          full_name?: string
          id?: string
          is_active?: boolean | null
          notes?: string | null
          phone_number?: string
          postal_code?: string | null
        }
        Relationships: []
      }
      emergency_alerts: {
        Row: {
          alert_reason: string | null
          alert_time: string | null
          alert_type: string | null
          elder_id: string
          followup_attempt: number | null
          followup_call_at: string | null
          followup_done: boolean | null
          id: string
          notes: string | null
          omainen_notified: boolean | null
          resolved: boolean | null
          resolved_at: string | null
          resolved_by: string | null
        }
        Insert: {
          alert_reason?: string | null
          alert_time?: string | null
          alert_type?: string | null
          elder_id: string
          followup_attempt?: number | null
          followup_call_at?: string | null
          followup_done?: boolean | null
          id?: string
          notes?: string | null
          omainen_notified?: boolean | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Update: {
          alert_reason?: string | null
          alert_time?: string | null
          alert_type?: string | null
          elder_id?: string
          followup_attempt?: number | null
          followup_call_at?: string | null
          followup_done?: boolean | null
          id?: string
          notes?: string | null
          omainen_notified?: boolean | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "emergency_alerts_elder_id_fkey"
            columns: ["elder_id"]
            isOneToOne: false
            referencedRelation: "elders"
            referencedColumns: ["id"]
          },
        ]
      }
      emergency_settings: {
        Row: {
          alert_email: string | null
          alert_method: string | null
          alert_primary_phone: string | null
          alert_secondary_phone: string | null
          auto_end_call: boolean | null
          custom_keywords: string | null
          detect_confusion: boolean | null
          detect_fall: boolean | null
          detect_loneliness: boolean | null
          detect_pain: boolean | null
          elder_id: string
          followup_call_enabled: boolean | null
          followup_delay_minutes: number | null
          followup_max_attempts: number | null
          id: string
          reassurance_message: string | null
          speak_reassurance: boolean | null
          updated_at: string | null
        }
        Insert: {
          alert_email?: string | null
          alert_method?: string | null
          alert_primary_phone?: string | null
          alert_secondary_phone?: string | null
          auto_end_call?: boolean | null
          custom_keywords?: string | null
          detect_confusion?: boolean | null
          detect_fall?: boolean | null
          detect_loneliness?: boolean | null
          detect_pain?: boolean | null
          elder_id: string
          followup_call_enabled?: boolean | null
          followup_delay_minutes?: number | null
          followup_max_attempts?: number | null
          id?: string
          reassurance_message?: string | null
          speak_reassurance?: boolean | null
          updated_at?: string | null
        }
        Update: {
          alert_email?: string | null
          alert_method?: string | null
          alert_primary_phone?: string | null
          alert_secondary_phone?: string | null
          auto_end_call?: boolean | null
          custom_keywords?: string | null
          detect_confusion?: boolean | null
          detect_fall?: boolean | null
          detect_loneliness?: boolean | null
          detect_pain?: boolean | null
          elder_id?: string
          followup_call_enabled?: boolean | null
          followup_delay_minutes?: number | null
          followup_max_attempts?: number | null
          id?: string
          reassurance_message?: string | null
          speak_reassurance?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "emergency_settings_elder_id_fkey"
            columns: ["elder_id"]
            isOneToOne: true
            referencedRelation: "elders"
            referencedColumns: ["id"]
          },
        ]
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
      legacy_highlights: {
        Row: {
          context: string | null
          created_at: string | null
          elder_id: string
          id: string
          quote: string
          target_chapter: string | null
          week_start: string
        }
        Insert: {
          context?: string | null
          created_at?: string | null
          elder_id: string
          id?: string
          quote: string
          target_chapter?: string | null
          week_start: string
        }
        Update: {
          context?: string | null
          created_at?: string | null
          elder_id?: string
          id?: string
          quote?: string
          target_chapter?: string | null
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "legacy_highlights_elder_id_fkey"
            columns: ["elder_id"]
            isOneToOne: false
            referencedRelation: "elders"
            referencedColumns: ["id"]
          },
        ]
      }
      legacy_observations: {
        Row: {
          created_at: string | null
          description: string | null
          elder_id: string
          id: string
          read_by_family: boolean | null
          title: string
          type: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          elder_id: string
          id?: string
          read_by_family?: boolean | null
          title: string
          type?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          elder_id?: string
          id?: string
          read_by_family?: boolean | null
          title?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "legacy_observations_elder_id_fkey"
            columns: ["elder_id"]
            isOneToOne: false
            referencedRelation: "elders"
            referencedColumns: ["id"]
          },
        ]
      }
      legacy_profile: {
        Row: {
          birth_place: string | null
          birth_year: number | null
          children_info: Json | null
          created_at: string | null
          dialect_region: string | null
          elder_id: string
          favorite_topics: string | null
          health_notes: string | null
          hobbies: string | null
          id: string
          marital_status: string | null
          onboarding_completed: boolean | null
          parents_info: Json | null
          profession: string | null
          sensitive_topics: string | null
          special_notes: string | null
          spouse_info: Json | null
        }
        Insert: {
          birth_place?: string | null
          birth_year?: number | null
          children_info?: Json | null
          created_at?: string | null
          dialect_region?: string | null
          elder_id: string
          favorite_topics?: string | null
          health_notes?: string | null
          hobbies?: string | null
          id?: string
          marital_status?: string | null
          onboarding_completed?: boolean | null
          parents_info?: Json | null
          profession?: string | null
          sensitive_topics?: string | null
          special_notes?: string | null
          spouse_info?: Json | null
        }
        Update: {
          birth_place?: string | null
          birth_year?: number | null
          children_info?: Json | null
          created_at?: string | null
          dialect_region?: string | null
          elder_id?: string
          favorite_topics?: string | null
          health_notes?: string | null
          hobbies?: string | null
          id?: string
          marital_status?: string | null
          onboarding_completed?: boolean | null
          parents_info?: Json | null
          profession?: string | null
          sensitive_topics?: string | null
          special_notes?: string | null
          spouse_info?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "legacy_profile_elder_id_fkey"
            columns: ["elder_id"]
            isOneToOne: true
            referencedRelation: "elders"
            referencedColumns: ["id"]
          },
        ]
      }
      legacy_subscriptions: {
        Row: {
          book_target_chapters: number | null
          created_at: string | null
          elder_id: string
          id: string
          started_at: string | null
          status: string | null
          target_completion_date: string | null
          weekly_call_count: number | null
        }
        Insert: {
          book_target_chapters?: number | null
          created_at?: string | null
          elder_id: string
          id?: string
          started_at?: string | null
          status?: string | null
          target_completion_date?: string | null
          weekly_call_count?: number | null
        }
        Update: {
          book_target_chapters?: number | null
          created_at?: string | null
          elder_id?: string
          id?: string
          started_at?: string | null
          status?: string | null
          target_completion_date?: string | null
          weekly_call_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "legacy_subscriptions_elder_id_fkey"
            columns: ["elder_id"]
            isOneToOne: true
            referencedRelation: "elders"
            referencedColumns: ["id"]
          },
        ]
      }
      legacy_topic_requests: {
        Row: {
          created_at: string | null
          elder_id: string
          id: string
          note: string | null
          requested_by: string
          status: string | null
          topic: string
        }
        Insert: {
          created_at?: string | null
          elder_id: string
          id?: string
          note?: string | null
          requested_by: string
          status?: string | null
          topic: string
        }
        Update: {
          created_at?: string | null
          elder_id?: string
          id?: string
          note?: string | null
          requested_by?: string
          status?: string | null
          topic?: string
        }
        Relationships: [
          {
            foreignKeyName: "legacy_topic_requests_elder_id_fkey"
            columns: ["elder_id"]
            isOneToOne: false
            referencedRelation: "elders"
            referencedColumns: ["id"]
          },
        ]
      }
      medication_logs: {
        Row: {
          call_report_id: string | null
          confirmed_by: string | null
          elder_id: string
          id: string
          log_date: string | null
          medication_id: string
          medication_name: string
          not_taken: boolean | null
          notes: string | null
          scheduled_time: string
          taken: boolean | null
          taken_at: string | null
        }
        Insert: {
          call_report_id?: string | null
          confirmed_by?: string | null
          elder_id: string
          id?: string
          log_date?: string | null
          medication_id: string
          medication_name: string
          not_taken?: boolean | null
          notes?: string | null
          scheduled_time: string
          taken?: boolean | null
          taken_at?: string | null
        }
        Update: {
          call_report_id?: string | null
          confirmed_by?: string | null
          elder_id?: string
          id?: string
          log_date?: string | null
          medication_id?: string
          medication_name?: string
          not_taken?: boolean | null
          notes?: string | null
          scheduled_time?: string
          taken?: boolean | null
          taken_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "medication_logs_call_report_id_fkey"
            columns: ["call_report_id"]
            isOneToOne: false
            referencedRelation: "call_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medication_logs_elder_id_fkey"
            columns: ["elder_id"]
            isOneToOne: false
            referencedRelation: "elders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medication_logs_medication_id_fkey"
            columns: ["medication_id"]
            isOneToOne: false
            referencedRelation: "medications"
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
          has_dosette: boolean | null
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
          has_dosette?: boolean | null
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
          has_dosette?: boolean | null
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
      missed_call_retries: {
        Row: {
          alert_sent: boolean | null
          attempt_number: number | null
          created_at: string | null
          elder_id: string
          id: string
          is_resolved: boolean | null
          max_attempts: number | null
          next_retry_at: string | null
          retry_interval_minutes: number | null
        }
        Insert: {
          alert_sent?: boolean | null
          attempt_number?: number | null
          created_at?: string | null
          elder_id: string
          id?: string
          is_resolved?: boolean | null
          max_attempts?: number | null
          next_retry_at?: string | null
          retry_interval_minutes?: number | null
        }
        Update: {
          alert_sent?: boolean | null
          attempt_number?: number | null
          created_at?: string | null
          elder_id?: string
          id?: string
          is_resolved?: boolean | null
          max_attempts?: number | null
          next_retry_at?: string | null
          retry_interval_minutes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "missed_call_retries_elder_id_fkey"
            columns: ["elder_id"]
            isOneToOne: false
            referencedRelation: "elders"
            referencedColumns: ["id"]
          },
        ]
      }
      nightly_batch_log: {
        Row: {
          calls_failed: number | null
          calls_processed: number | null
          chapters_failed: number | null
          chapters_generated: number | null
          duration_ms: number | null
          errors: string[] | null
          estimated_cost_usd: number | null
          id: string
          ran_at: string | null
          total_tokens_in: number | null
          total_tokens_out: number | null
        }
        Insert: {
          calls_failed?: number | null
          calls_processed?: number | null
          chapters_failed?: number | null
          chapters_generated?: number | null
          duration_ms?: number | null
          errors?: string[] | null
          estimated_cost_usd?: number | null
          id?: string
          ran_at?: string | null
          total_tokens_in?: number | null
          total_tokens_out?: number | null
        }
        Update: {
          calls_failed?: number | null
          calls_processed?: number | null
          chapters_failed?: number | null
          chapters_generated?: number | null
          duration_ms?: number | null
          errors?: string[] | null
          estimated_cost_usd?: number | null
          id?: string
          ran_at?: string | null
          total_tokens_in?: number | null
          total_tokens_out?: number | null
        }
        Relationships: []
      }
      profile_summary: {
        Row: {
          created_at: string | null
          elder_id: string
          id: string
          key_themes: string | null
          last_updated: string | null
          personality_notes: string | null
          recurring_people: string | null
          sensitive_areas_learned: string | null
          speaking_style: string | null
        }
        Insert: {
          created_at?: string | null
          elder_id: string
          id?: string
          key_themes?: string | null
          last_updated?: string | null
          personality_notes?: string | null
          recurring_people?: string | null
          sensitive_areas_learned?: string | null
          speaking_style?: string | null
        }
        Update: {
          created_at?: string | null
          elder_id?: string
          id?: string
          key_themes?: string | null
          last_updated?: string | null
          personality_notes?: string | null
          recurring_people?: string | null
          sensitive_areas_learned?: string | null
          speaking_style?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profile_summary_elder_id_fkey"
            columns: ["elder_id"]
            isOneToOne: true
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
      retry_settings: {
        Row: {
          alert_after_attempts: number | null
          alert_method: string | null
          id: string
          max_attempts: number | null
          retry_enabled: boolean | null
          retry_interval_minutes: number | null
          updated_at: string | null
          weekend_calls: boolean | null
        }
        Insert: {
          alert_after_attempts?: number | null
          alert_method?: string | null
          id?: string
          max_attempts?: number | null
          retry_enabled?: boolean | null
          retry_interval_minutes?: number | null
          updated_at?: string | null
          weekend_calls?: boolean | null
        }
        Update: {
          alert_after_attempts?: number | null
          alert_method?: string | null
          id?: string
          max_attempts?: number | null
          retry_enabled?: boolean | null
          retry_interval_minutes?: number | null
          updated_at?: string | null
          weekend_calls?: boolean | null
        }
        Relationships: []
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
      find_elder_by_phone: {
        Args: { p_phone: string }
        Returns: {
          full_name: string
          id: string
        }[]
      }
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
