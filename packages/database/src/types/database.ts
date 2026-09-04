export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.5';
  };
  public: {
    Tables: {
      captions: {
        Row: {
          body: string;
          content_id: string;
          created_at: string;
          created_by: string | null;
          id: string;
          model_name: string;
          prompt_version: string;
          status: string;
          updated_at: string;
          version: number;
          workspace_id: string;
        };
        Insert: {
          body: string;
          content_id: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          model_name: string;
          prompt_version: string;
          status?: string;
          updated_at?: string;
          version: number;
          workspace_id: string;
        };
        Update: {
          body?: string;
          content_id?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          model_name?: string;
          prompt_version?: string;
          status?: string;
          updated_at?: string;
          version?: number;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'captions_content_id_fkey';
            columns: ['content_id'];
            isOneToOne: false;
            referencedRelation: 'content';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'captions_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      content: {
        Row: {
          created_at: string;
          description: string | null;
          external_id: string | null;
          id: string;
          media_status: string;
          source_type: string;
          source_url: string | null;
          status: string;
          storage_key: string | null;
          storage_provider: string | null;
          title: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          external_id?: string | null;
          id?: string;
          media_status?: string;
          source_type?: string;
          source_url?: string | null;
          status?: string;
          storage_key?: string | null;
          storage_provider?: string | null;
          title: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          external_id?: string | null;
          id?: string;
          media_status?: string;
          source_type?: string;
          source_url?: string | null;
          status?: string;
          storage_key?: string | null;
          storage_provider?: string | null;
          title?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'content_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      jobs: {
        Row: {
          attempt_count: number;
          cancel_requested: boolean;
          created_at: string;
          dedup_key: string | null;
          id: string;
          last_error_code: string | null;
          locked_at: string | null;
          locked_by: string | null;
          max_attempts: number;
          payload: Json;
          result: Json | null;
          scheduled_for: string;
          status: string;
          type: string;
          updated_at: string;
          workspace_id: string;
        };
        // Deliberately narrower than Row. There is no user INSERT or UPDATE
        // policy on jobs: every write goes through a security definer function
        // (enqueue_job, cancel_job, claim_job, complete_job, fail_job). These
        // shapes exist so the type system is honest about the table, not to
        // invite `.from('jobs').insert()` — which RLS will reject.
        Insert: {
          attempt_count?: number;
          cancel_requested?: boolean;
          created_at?: string;
          dedup_key?: string | null;
          id?: string;
          last_error_code?: string | null;
          locked_at?: string | null;
          locked_by?: string | null;
          max_attempts?: number;
          payload?: Json;
          result?: Json | null;
          scheduled_for?: string;
          status?: string;
          type: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          attempt_count?: number;
          cancel_requested?: boolean;
          created_at?: string;
          dedup_key?: string | null;
          id?: string;
          last_error_code?: string | null;
          locked_at?: string | null;
          locked_by?: string | null;
          max_attempts?: number;
          payload?: Json;
          result?: Json | null;
          scheduled_for?: string;
          status?: string;
          type?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'jobs_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          display_name: string | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          id: string;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      workspace_members: {
        Row: {
          created_at: string;
          id: string;
          role: string;
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: string;
          user_id: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: string;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'workspace_members_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'workspace_members_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      workspace_profiles: {
        Row: {
          content_goals: string | null;
          created_at: string;
          description: string | null;
          id: string;
          niche: string | null;
          restrictions: string | null;
          target_audience: string | null;
          tone: string | null;
          updated_at: string;
          workspace_id: string;
          writing_style: string | null;
        };
        Insert: {
          content_goals?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          niche?: string | null;
          restrictions?: string | null;
          target_audience?: string | null;
          tone?: string | null;
          updated_at?: string;
          workspace_id: string;
          writing_style?: string | null;
        };
        Update: {
          content_goals?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          niche?: string | null;
          restrictions?: string | null;
          target_audience?: string | null;
          tone?: string | null;
          updated_at?: string;
          workspace_id?: string;
          writing_style?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'workspace_profiles_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: true;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      workspaces: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          owner_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          owner_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          owner_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'workspaces_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      workspace_jobs: {
        Row: {
          attempt_count: number;
          cancel_requested: boolean;
          created_at: string;
          id: string;
          last_error_code: string | null;
          max_attempts: number;
          scheduled_for: string;
          status: string;
          type: string;
          updated_at: string;
          workspace_id: string;
        };
        Relationships: [];
      };
    };
    Functions: {
      cancel_job: { Args: { job_id: string }; Returns: boolean };
      confirm_content_media: {
        Args: {
          target_workspace_id: string;
          target_content_id: string;
          target_storage_key: string;
        };
        Returns: boolean;
      };
      cancel_workspace_jobs: { Args: { target_workspace_id: string }; Returns: number };
      claim_job: {
        Args: { worker_token: string };
        Returns: Database['public']['Tables']['jobs']['Row'] | null;
      };
      complete_job: {
        Args: { job_id: string; worker_token: string; job_result?: Json | null };
        Returns: boolean;
      };
      enqueue_job: {
        Args: {
          target_workspace_id: string;
          job_type: string;
          job_payload?: Json;
          job_dedup_key?: string | null;
          run_at?: string | null;
        };
        Returns: string;
      };
      fail_job: {
        Args: { job_id: string; worker_token: string; error_code: string; retryable?: boolean };
        Returns: string | null;
      };
      release_content_media: {
        Args: {
          target_workspace_id: string;
          target_content_id: string;
        };
        Returns: boolean;
      };
      reserve_content_media: {
        Args: {
          target_workspace_id: string;
          target_content_id: string;
          file_extension: string;
        };
        Returns: string;
      };
      workspace_ids_for_current_user: { Args: never; Returns: string[] };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
