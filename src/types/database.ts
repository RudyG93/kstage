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
  __InternalSupabase: {
    PostgrestVersion: '14.5'
  }
  public: {
    Tables: {
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
            foreignKeyName: 'comment_votes_comment_id_fkey'
            columns: ['comment_id']
            isOneToOne: false
            referencedRelation: 'comments'
            referencedColumns: ['id']
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
            foreignKeyName: 'comments_event_id_fkey'
            columns: ['event_id']
            isOneToOne: false
            referencedRelation: 'events'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'comments_parent_id_fkey'
            columns: ['parent_id']
            isOneToOne: false
            referencedRelation: 'comments'
            referencedColumns: ['id']
          },
        ]
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
            foreignKeyName: 'event_ratings_event_id_fkey'
            columns: ['event_id']
            isOneToOne: false
            referencedRelation: 'events'
            referencedColumns: ['id']
          },
        ]
      }
      event_suggestions: {
        Row: {
          created_at: string
          description: string | null
          group_id: string
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          source_url: string | null
          start_at: string
          status: Database['public']['Enums']['suggestion_status']
          title: string
          type: Database['public']['Enums']['event_type']
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          group_id: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_url?: string | null
          start_at: string
          status?: Database['public']['Enums']['suggestion_status']
          title: string
          type: Database['public']['Enums']['event_type']
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          group_id?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_url?: string | null
          start_at?: string
          status?: Database['public']['Enums']['suggestion_status']
          title?: string
          type?: Database['public']['Enums']['event_type']
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'event_suggestions_group_id_fkey'
            columns: ['group_id']
            isOneToOne: false
            referencedRelation: 'groups'
            referencedColumns: ['id']
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          description: string | null
          end_at: string | null
          group_id: string
          id: string
          image_url: string | null
          slug: string | null
          source_id: string | null
          source_url: string | null
          start_at: string
          status: Database['public']['Enums']['event_status']
          title: string
          type: Database['public']['Enums']['event_type']
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_at?: string | null
          group_id: string
          id?: string
          image_url?: string | null
          slug?: string | null
          source_id?: string | null
          source_url?: string | null
          start_at: string
          status?: Database['public']['Enums']['event_status']
          title: string
          type: Database['public']['Enums']['event_type']
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          end_at?: string | null
          group_id?: string
          id?: string
          image_url?: string | null
          slug?: string | null
          source_id?: string | null
          source_url?: string | null
          start_at?: string
          status?: Database['public']['Enums']['event_status']
          title?: string
          type?: Database['public']['Enums']['event_type']
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'events_group_id_fkey'
            columns: ['group_id']
            isOneToOne: false
            referencedRelation: 'groups'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'events_source_id_fkey'
            columns: ['source_id']
            isOneToOne: false
            referencedRelation: 'sources'
            referencedColumns: ['id']
          },
        ]
      }
      groups: {
        Row: {
          agency: string | null
          banner_url: string | null
          color_hex: string | null
          created_at: string
          debut_date: string | null
          fandom_name: string | null
          id: string
          image_landscape: string | null
          image_url: string | null
          links: Json
          name: string
          slug: string
        }
        Insert: {
          agency?: string | null
          banner_url?: string | null
          color_hex?: string | null
          created_at?: string
          debut_date?: string | null
          fandom_name?: string | null
          id?: string
          image_landscape?: string | null
          image_url?: string | null
          links?: Json
          name: string
          slug: string
        }
        Update: {
          agency?: string | null
          banner_url?: string | null
          color_hex?: string | null
          created_at?: string
          debut_date?: string | null
          fandom_name?: string | null
          id?: string
          image_landscape?: string | null
          image_url?: string | null
          links?: Json
          name?: string
          slug?: string
        }
        Relationships: []
      }
      members: {
        Row: {
          birthday: string | null
          created_at: string
          group_id: string
          id: string
          position: string | null
          real_name: string | null
          stage_name: string
        }
        Insert: {
          birthday?: string | null
          created_at?: string
          group_id: string
          id?: string
          position?: string | null
          real_name?: string | null
          stage_name: string
        }
        Update: {
          birthday?: string | null
          created_at?: string
          group_id?: string
          id?: string
          position?: string | null
          real_name?: string | null
          stage_name?: string
        }
        Relationships: [
          {
            foreignKeyName: 'members_group_id_fkey'
            columns: ['group_id']
            isOneToOne: false
            referencedRelation: 'groups'
            referencedColumns: ['id']
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          username?: string | null
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
      sources: {
        Row: {
          created_at: string
          group_id: string | null
          id: string
          last_scraped_at: string | null
          name: string
          type: string
          url: string
        }
        Insert: {
          created_at?: string
          group_id?: string | null
          id?: string
          last_scraped_at?: string | null
          name: string
          type: string
          url: string
        }
        Update: {
          created_at?: string
          group_id?: string | null
          id?: string
          last_scraped_at?: string | null
          name?: string
          type?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: 'sources_group_id_fkey'
            columns: ['group_id']
            isOneToOne: false
            referencedRelation: 'groups'
            referencedColumns: ['id']
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
            foreignKeyName: 'user_follows_group_id_fkey'
            columns: ['group_id']
            isOneToOne: false
            referencedRelation: 'groups'
            referencedColumns: ['id']
          },
        ]
      }
      user_notification_settings: {
        Row: {
          channel: string
          enabled: boolean
          event_type: Database['public']['Enums']['event_type']
          id: string
          lead_time_minutes: number
          user_id: string
        }
        Insert: {
          channel?: string
          enabled?: boolean
          event_type: Database['public']['Enums']['event_type']
          id?: string
          lead_time_minutes?: number
          user_id: string
        }
        Update: {
          channel?: string
          enabled?: boolean
          event_type?: Database['public']['Enums']['event_type']
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
      [_ in never]: never
    }
    Enums: {
      event_status: 'confirmed' | 'tentative' | 'cancelled'
      event_type:
        | 'mv'
        | 'music_show'
        | 'live'
        | 'anniversary'
        | 'concert'
        | 'other'
        | 'release'
      suggestion_status: 'pending' | 'approved' | 'rejected'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] &
        DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      event_status: ['confirmed', 'tentative', 'cancelled'],
      event_type: ['mv', 'music_show', 'live', 'anniversary', 'concert', 'other', 'release'],
      suggestion_status: ['pending', 'approved', 'rejected'],
    },
  },
} as const
