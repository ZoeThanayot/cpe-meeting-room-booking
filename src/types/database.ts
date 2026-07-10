export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string | null
          role: 'user' | 'admin'
          created_at: string
        }
        Insert: {
          id: string
          full_name?: string | null
          role?: 'user' | 'admin'
          created_at?: string
        }
        Update: {
          id?: string
          full_name?: string | null
          role?: 'user' | 'admin'
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedSchema: "auth"
          }
        ]
      }
      rooms: {
        Row: {
          id: string
          name: string
          room_type: 'small' | 'medium' | 'large'
          location: string | null
          capacity: number | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          room_type: 'small' | 'medium' | 'large'
          location?: string | null
          capacity?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          room_type?: 'small' | 'medium' | 'large'
          location?: string | null
          capacity?: number | null
          created_at?: string
        }
        Relationships: []
      }
      bookings: {
        Row: {
          id: string
          room_id: string
          user_id: string
          meeting_name: string
          start_time: string
          end_time: string
          status: 'booked' | 'cancelled'
          created_at: string
        }
        Insert: {
          id?: string
          room_id: string
          user_id: string
          meeting_name: string
          start_time: string
          end_time: string
          status?: 'booked' | 'cancelled'
          created_at?: string
        }
        Update: {
          id?: string
          room_id?: string
          user_id?: string
          meeting_name?: string
          start_time?: string
          end_time?: string
          status?: 'booked' | 'cancelled'
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedSchema: "public"
          },
          {
            foreignKeyName: "bookings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedSchema: "auth"
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
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
