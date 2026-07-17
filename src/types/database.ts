// Auto-généré via Supabase gen types — ne pas éditer manuellement.
// Régénérer après chaque migration (MCP generate_typescript_types).

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
      artist_suggestions: {
        Row: {
          agency: string | null
          color_hex: string | null
          created_at: string
          debut_date: string | null
          fandom_name: string | null
          id: string
          image_url: string | null
          kind: string
          members: Json
          name: string
          reviewed_at: string | null
          reviewed_by: string | null
          source_url: string | null
          status: Database["public"]["Enums"]["suggestion_status"]
          user_id: string
        }
        Insert: {
          agency?: string | null
          color_hex?: string | null
          created_at?: string
          debut_date?: string | null
          fandom_name?: string | null
          id?: string
          image_url?: string | null
          kind: string
          members?: Json
          name: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_url?: string | null
          status?: Database["public"]["Enums"]["suggestion_status"]
          user_id: string
        }
        Update: {
          agency?: string | null
          color_hex?: string | null
          created_at?: string
          debut_date?: string | null
          fandom_name?: string | null
          id?: string
          image_url?: string | null
          kind?: string
          members?: Json
          name?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_url?: string | null
          status?: Database["public"]["Enums"]["suggestion_status"]
          user_id?: string
        }
        Relationships: []
      }
      calendar_feeds: {
        Row: {
          created_at: string
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          token?: string
          user_id: string
        }
        Update: {
          created_at?: string
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      comment_edit_history: {
        Row: {
          comment_id: string
          edited_at: string
          id: string
          previous_body: string
          user_id: string
        }
        Insert: {
          comment_id: string
          edited_at?: string
          id?: string
          previous_body: string
          user_id: string
        }
        Update: {
          comment_id?: string
          edited_at?: string
          id?: string
          previous_body?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_edit_history_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
        ]
      }
      comment_report: {
        Row: {
          comment_id: string
          created_at: string
          id: string
          reason: string | null
          reporter_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          id?: string
          reason?: string | null
          reporter_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          id?: string
          reason?: string | null
          reporter_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_report_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
        ]
      }
      comment_votes: {
        Row: {
          comment_id: string
          created_at: string
          user_id: string
          value: number
        }
        Insert: {
          comment_id: string
          created_at?: string
          user_id: string
          value: number
        }
        Update: {
          comment_id?: string
          created_at?: string
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "comment_votes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          body: string
          created_at: string
          deleted_at: string | null
          event_id: string
          id: string
          parent_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          deleted_at?: string | null
          event_id: string
          id?: string
          parent_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          deleted_at?: string | null
          event_id?: string
          id?: string
          parent_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
        ]
      }
      event_notifications: {
        Row: {
          event_id: string
          id: string
          kind: string
          sent_at: string
          user_id: string
        }
        Insert: {
          event_id: string
          id?: string
          kind: string
          sent_at?: string
          user_id: string
        }
        Update: {
          event_id?: string
          id?: string
          kind?: string
          sent_at?: string
          user_id?: string
        }
        Relationships: []
      }
      event_ratings: {
        Row: {
          created_at: string
          event_id: string
          id: string
          score: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          score: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          score?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_ratings_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_suggestions: {
        Row: {
          created_at: string
          description: string | null
          group_id: string
          id: string
          kind: string
          reviewed_at: string | null
          reviewed_by: string | null
          source_url: string | null
          start_at: string
          status: Database["public"]["Enums"]["suggestion_status"]
          target_event_id: string | null
          title: string
          type: Database["public"]["Enums"]["event_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          group_id: string
          id?: string
          kind?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_url?: string | null
          start_at: string
          status?: Database["public"]["Enums"]["suggestion_status"]
          target_event_id?: string | null
          title: string
          type: Database["public"]["Enums"]["event_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          group_id?: string
          id?: string
          kind?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_url?: string | null
          start_at?: string
          status?: Database["public"]["Enums"]["suggestion_status"]
          target_event_id?: string | null
          title?: string
          type?: Database["public"]["Enums"]["event_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_suggestions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_suggestions_target_event_id_fkey"
            columns: ["target_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          description: string | null
          end_at: string | null
          episode_number: number | null
          group_id: string
          hidden: boolean
          id: string
          image_url: string | null
          member_id: string | null
          mv_kind: Database["public"]["Enums"]["mv_kind"] | null
          slug: string | null
          source_id: string | null
          source_url: string | null
          stage_url: string | null
          start_at: string
          status: Database["public"]["Enums"]["event_status"]
          title: string
          type: Database["public"]["Enums"]["event_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_at?: string | null
          episode_number?: number | null
          group_id: string
          hidden?: boolean
          id?: string
          image_url?: string | null
          member_id?: string | null
          mv_kind?: Database["public"]["Enums"]["mv_kind"] | null
          slug?: string | null
          source_id?: string | null
          source_url?: string | null
          stage_url?: string | null
          start_at: string
          status?: Database["public"]["Enums"]["event_status"]
          title: string
          type: Database["public"]["Enums"]["event_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          end_at?: string | null
          episode_number?: number | null
          group_id?: string
          hidden?: boolean
          id?: string
          image_url?: string | null
          member_id?: string | null
          mv_kind?: Database["public"]["Enums"]["mv_kind"] | null
          slug?: string | null
          source_id?: string | null
          source_url?: string | null
          stage_url?: string | null
          start_at?: string
          status?: Database["public"]["Enums"]["event_status"]
          title?: string
          type?: Database["public"]["Enums"]["event_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          body: string
          created_at: string
          id: string
          kind: string
          page: string | null
          status: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          kind: string
          page?: string | null
          status?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          kind?: string
          page?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      debut_candidates: {
        Row: {
          decided_at: string | null
          detected_at: string
          fandom_pageid: number
          group_id: string | null
          id: string
          page_title: string
          payload: Json | null
          status: string
        }
        Insert: {
          decided_at?: string | null
          detected_at?: string
          fandom_pageid: number
          group_id?: string | null
          id?: string
          page_title: string
          payload?: Json | null
          status?: string
        }
        Update: {
          decided_at?: string | null
          detected_at?: string
          fandom_pageid?: number
          group_id?: string | null
          id?: string
          page_title?: string
          payload?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "debut_candidates_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      digest_log: {
        Row: {
          day_key: string
          edition: string
          id: string
          sent_at: string
          user_id: string
        }
        Insert: {
          day_key: string
          edition: string
          id?: string
          sent_at?: string
          user_id: string
        }
        Update: {
          day_key?: string
          edition?: string
          id?: string
          sent_at?: string
          user_id?: string
        }
        Relationships: []
      }
      lineup_unmatched: {
        Row: {
          display_name: string
          first_seen: string
          last_seen: string
          name_norm: string
          occurrences: number
          shows: string[]
          status: string
        }
        Insert: {
          display_name: string
          first_seen?: string
          last_seen?: string
          name_norm: string
          occurrences?: number
          shows?: string[]
          status?: string
        }
        Update: {
          display_name?: string
          first_seen?: string
          last_seen?: string
          name_norm?: string
          occurrences?: number
          shows?: string[]
          status?: string
        }
        Relationships: []
      }
      groups: {
        Row: {
          agency: string | null
          banner_url: string | null
          banner_yt_url: string | null
          color_hex: string | null
          confidence: Database["public"]["Enums"]["group_confidence"]
          created_at: string
          debut_date: string | null
          disbanded_on: string | null
          fandom_name: string | null
          id: string
          image_landscape: string | null
          image_url: string | null
          is_solo: boolean
          links: Json
          name: string
          slug: string
          spotify_followers: number | null
        }
        Insert: {
          agency?: string | null
          banner_url?: string | null
          banner_yt_url?: string | null
          color_hex?: string | null
          confidence?: Database["public"]["Enums"]["group_confidence"]
          created_at?: string
          debut_date?: string | null
          disbanded_on?: string | null
          fandom_name?: string | null
          id?: string
          image_landscape?: string | null
          image_url?: string | null
          is_solo?: boolean
          links?: Json
          name: string
          slug: string
          spotify_followers?: number | null
        }
        Update: {
          agency?: string | null
          banner_url?: string | null
          banner_yt_url?: string | null
          color_hex?: string | null
          confidence?: Database["public"]["Enums"]["group_confidence"]
          created_at?: string
          debut_date?: string | null
          disbanded_on?: string | null
          fandom_name?: string | null
          id?: string
          image_landscape?: string | null
          image_url?: string | null
          is_solo?: boolean
          links?: Json
          name?: string
          slug?: string
          spotify_followers?: number | null
        }
        Relationships: []
      }
      members: {
        Row: {
          birthday: string | null
          canonical_id: string | null
          created_at: string
          former_reason: string | null
          group_id: string
          id: string
          links: Json | null
          photo_checked_at: string | null
          photo_source_key: string | null
          photo_url: string | null
          position: string | null
          real_name: string | null
          slug: string | null
          stage_name: string
          status: Database["public"]["Enums"]["member_status"]
        }
        Insert: {
          birthday?: string | null
          canonical_id?: string | null
          created_at?: string
          former_reason?: string | null
          group_id: string
          id?: string
          links?: Json | null
          photo_checked_at?: string | null
          photo_source_key?: string | null
          photo_url?: string | null
          position?: string | null
          real_name?: string | null
          slug?: string | null
          stage_name: string
          status?: Database["public"]["Enums"]["member_status"]
        }
        Update: {
          birthday?: string | null
          canonical_id?: string | null
          created_at?: string
          former_reason?: string | null
          group_id?: string
          id?: string
          links?: Json | null
          photo_checked_at?: string | null
          photo_source_key?: string | null
          photo_url?: string | null
          position?: string | null
          real_name?: string | null
          slug?: string | null
          stage_name?: string
          status?: Database["public"]["Enums"]["member_status"]
        }
        Relationships: [
          {
            foreignKeyName: "members_canonical_id_fkey"
            columns: ["canonical_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_winner: {
        Row: {
          computed_at: string
          id: string
          period_month: string
          score: number
          type: Database["public"]["Enums"]["event_type"]
          winner_event_id: string
        }
        Insert: {
          computed_at?: string
          id?: string
          period_month: string
          score: number
          type: Database["public"]["Enums"]["event_type"]
          winner_event_id: string
        }
        Update: {
          computed_at?: string
          id?: string
          period_month?: string
          score?: number
          type?: Database["public"]["Enums"]["event_type"]
          winner_event_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_winner_winner_event_id_fkey"
            columns: ["winner_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      mv_like: {
        Row: {
          created_at: string
          event_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mv_like_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bias_member_id: string | null
          created_at: string
          favorite_group_id: string | null
          id: string
          role: Database["public"]["Enums"]["user_role"]
          tier: Database["public"]["Enums"]["tier_type"]
          timezone: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bias_member_id?: string | null
          created_at?: string
          favorite_group_id?: string | null
          id: string
          role?: Database["public"]["Enums"]["user_role"]
          tier?: Database["public"]["Enums"]["tier_type"]
          timezone?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bias_member_id?: string | null
          created_at?: string
          favorite_group_id?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          tier?: Database["public"]["Enums"]["tier_type"]
          timezone?: string | null
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_bias_member_id_fkey"
            columns: ["bias_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_favorite_group_id_fkey"
            columns: ["favorite_group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      product_events: {
        Row: {
          anon_id: string | null
          created_at: string
          day_key: string | null
          event: string
          id: number
          props: Json
          user_id: string | null
        }
        Insert: {
          anon_id?: string | null
          created_at?: string
          day_key?: string | null
          event: string
          id?: never
          props?: Json
          user_id?: string | null
        }
        Update: {
          anon_id?: string | null
          created_at?: string
          day_key?: string | null
          event?: string
          id?: never
          props?: Json
          user_id?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      rate_limit_hits: {
        Row: {
          action: string
          created_at: string
          id: number
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: never
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: never
          user_id?: string
        }
        Relationships: []
      }
      scrape_log: {
        Row: {
          details: Json | null
          ended_at: string | null
          error_msg: string | null
          id: string
          source: string
          started_at: string
          status: string
        }
        Insert: {
          details?: Json | null
          ended_at?: string | null
          error_msg?: string | null
          id?: string
          source: string
          started_at?: string
          status: string
        }
        Update: {
          details?: Json | null
          ended_at?: string | null
          error_msg?: string | null
          id?: string
          source?: string
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      sources: {
        Row: {
          channel_id: string | null
          created_at: string
          group_id: string | null
          id: string
          last_scraped_at: string | null
          name: string
          subscriber_count: number | null
          type: string
          url: string
        }
        Insert: {
          channel_id?: string | null
          created_at?: string
          group_id?: string | null
          id?: string
          last_scraped_at?: string | null
          name: string
          subscriber_count?: number | null
          type: string
          url: string
        }
        Update: {
          channel_id?: string | null
          created_at?: string
          group_id?: string | null
          id?: string
          last_scraped_at?: string | null
          name?: string
          subscriber_count?: number | null
          type?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "sources_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      user_follows: {
        Row: {
          created_at: string
          group_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_follows_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      user_notification_settings: {
        Row: {
          channel: string
          enabled: boolean
          event_type: Database["public"]["Enums"]["event_type"]
          id: string
          lead_time_minutes: number
          user_id: string
        }
        Insert: {
          channel?: string
          enabled?: boolean
          event_type: Database["public"]["Enums"]["event_type"]
          id?: string
          lead_time_minutes?: number
          user_id: string
        }
        Update: {
          channel?: string
          enabled?: boolean
          event_type?: Database["public"]["Enums"]["event_type"]
          id?: string
          lead_time_minutes?: number
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      consume_rate_limit: {
        Args: { p_action: string; p_max: number; p_window_seconds: number }
        Returns: boolean
      }
      group_follow_counts: {
        Args: never
        Returns: {
          follows: number
          group_id: string
        }[]
      }
      recent_activity: {
        Args: { p_limit?: number }
        Returns: {
          actor_avatar: string
          actor_username: string
          event_id: string
          event_slug: string
          event_title: string
          event_type: string
          group_name: string
          group_slug: string
          kind: string
          score: number
          ts: string
        }[]
      }
    }
    Enums: {
      event_status: "confirmed" | "tentative" | "cancelled"
      group_confidence: "verified" | "monitored" | "candidate"
      event_type:
        | "mv"
        | "music_show"
        | "live"
        | "anniversary"
        | "concert"
        | "other"
        | "release"
      member_status: "active" | "former" | "pre_debut" | "deceased"
      mv_kind: "main" | "performance" | "member" | "other_version"
      suggestion_status: "pending" | "approved" | "rejected"
      tier_type: "free" | "premium"
      user_role: "user" | "admin" | "moderator"
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
    Enums: {
      event_status: ["confirmed", "tentative", "cancelled"],
      group_confidence: ["verified", "monitored", "candidate"],
      event_type: [
        "mv",
        "music_show",
        "live",
        "anniversary",
        "concert",
        "other",
        "release",
      ],
      member_status: ["active", "former", "pre_debut", "deceased"],
      mv_kind: ["main", "performance", "member", "other_version"],
      suggestion_status: ["pending", "approved", "rejected"],
      tier_type: ["free", "premium"],
      user_role: ["user", "admin", "moderator"],
    },
  },
} as const
