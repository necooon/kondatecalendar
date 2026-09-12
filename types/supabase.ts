// Generated from Supabase project aqrlponulqzjmfisvhlu (Issue #11 / #13, meal_days).
// recipes JSONB 形は js/recipes-db.js の JSDoc を正とする。
// meal_days JSONB 形は js/meals-db.js の JSDoc を正とする。
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

/** JSONB stored in public.recipes.ingredients (maps to RecipeIngredient in js/recipes-db.js). */
export type RecipeIngredientJson = {
  name: string
  base_amount: number
  unit: string
  note?: string
}

/** JSONB stored in public.recipes.steps (maps to RecipeStep.timer). */
export type RecipeStepJson = {
  title?: string
  instruction: string
  timer_seconds: number | null
  uses?: string[]
}

/** JSONB stored in public.recipes.pfc. */
export type RecipePfcJson = {
  p: number
  f: number
  c: number
  kcal: number
}

/** JSONB stored in public.recipes.versions[versionKey]. */
export type RecipeVersionJson = {
  title: string
  note?: string
  sort_order: number
  branch: string
  hash: string
  author: string
  committed_at: string
  ingredients: RecipeIngredientJson[]
  steps: RecipeStepJson[]
}

/** JSONB stored in public.meal_days.meals[slot].items. */
export type MealItemJson = {
  title: string
  recipe_id?: string | null
  item_id?: string | null
}

/** JSONB stored in public.meal_days.meals[slot]. */
export type MealSlotJson = {
  items?: MealItemJson[]
  servings?: number
  kind?: 'recipe' | 'memo'
  memo?: string
  memo_tag?: string | null
}

/** JSONB stored in public.meal_days.meals. */
export type MealDaysMealsJson = {
  breakfast?: MealSlotJson
  lunch?: MealSlotJson
  dinner?: MealSlotJson
}

/** JSONB stored in public.meal_days.pfc. */
export type MealDayPfcJson = {
  p: number
  f: number
  c: number
}

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      categories: {
        Row: {
          created_at: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      check_units: {
        Row: {
          created_at: string
          cycle_id: string
          id: string
          location_id: string | null
          sort_order: number
        }
        Insert: {
          created_at?: string
          cycle_id: string
          id?: string
          location_id?: string | null
          sort_order?: number
        }
        Update: {
          created_at?: string
          cycle_id?: string
          id?: string
          location_id?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "check_units_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "check_units_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      cycles: {
        Row: {
          created_at: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      item_check_units: {
        Row: {
          check_unit_id: string
          created_at: string
          item_id: string
        }
        Insert: {
          check_unit_id: string
          created_at?: string
          item_id: string
        }
        Update: {
          check_unit_id?: string
          created_at?: string
          item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_check_units_check_unit_id_fkey"
            columns: ["check_unit_id"]
            isOneToOne: false
            referencedRelation: "check_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_check_units_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          category: string
          count: number
          created_at: string
          entered: boolean
          id: string
          last_ordered_on: string | null
          location_id: string | null
          name: string
          order_threshold: number
          pending_dest: string | null
          pending_mode: string | null
          pending_product_id: string | null
          pending_qty: number | null
          purchase_destinations: string[]
          target_qty: number
          unit: string
          updated_at: string
        }
        Insert: {
          category?: string
          count?: number
          created_at?: string
          entered?: boolean
          id?: string
          last_ordered_on?: string | null
          location_id?: string | null
          name: string
          order_threshold?: number
          pending_dest?: string | null
          pending_mode?: string | null
          pending_product_id?: string | null
          pending_qty?: number | null
          purchase_destinations?: string[]
          target_qty?: number
          unit?: string
          updated_at?: string
        }
        Update: {
          category?: string
          count?: number
          created_at?: string
          entered?: boolean
          id?: string
          last_ordered_on?: string | null
          location_id?: string | null
          name?: string
          order_threshold?: number
          pending_dest?: string | null
          pending_mode?: string | null
          pending_product_id?: string | null
          pending_qty?: number | null
          purchase_destinations?: string[]
          target_qty?: number
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "items_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          created_at: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      meal_days: {
        Row: {
          created_at: string
          date: string
          id: string
          is_business_trip: boolean
          meals: Json
          pfc: Json | null
          servings: number
          tag: string
          tag_color: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          is_business_trip?: boolean
          meals?: Json
          pfc?: Json | null
          servings?: number
          tag?: string
          tag_color?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          is_business_trip?: boolean
          meals?: Json
          pfc?: Json | null
          servings?: number
          tag?: string
          tag_color?: string
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          barcode: string
          created_at: string
          id: string
          item_id: string | null
          name: string
          purchase_destinations: string[]
          updated_at: string
          url: string
        }
        Insert: {
          barcode?: string
          created_at?: string
          id?: string
          item_id?: string | null
          name: string
          purchase_destinations?: string[]
          updated_at?: string
          url?: string
        }
        Update: {
          barcode?: string
          created_at?: string
          id?: string
          item_id?: string | null
          name?: string
          purchase_destinations?: string[]
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_destinations: {
        Row: {
          created_at: string
          id: string
          kind: string
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      purchase_history: {
        Row: {
          created_at: string
          dest: string
          happened_at: string
          id: string
          item_id: string | null
          item_name: string
          mode: string
          product_id: string | null
          product_name: string
          qty: number
        }
        Insert: {
          created_at?: string
          dest?: string
          happened_at?: string
          id?: string
          item_id?: string | null
          item_name?: string
          mode?: string
          product_id?: string | null
          product_name?: string
          qty?: number
        }
        Update: {
          created_at?: string
          dest?: string
          happened_at?: string
          id?: string
          item_id?: string | null
          item_name?: string
          mode?: string
          product_id?: string | null
          product_name?: string
          qty?: number
        }
        Relationships: []
      }
      recipes: {
        Row: {
          branch: string
          created_at: string
          id: string
          ingredients: Json
          name: string
          pfc: Json | null
          servings_base: number
          steps: Json
          tag: string
          tags: Json
          updated_at: string
          versions: Json
        }
        Insert: {
          branch?: string
          created_at?: string
          id?: string
          ingredients?: Json
          name: string
          pfc?: Json | null
          servings_base?: number
          steps?: Json
          tag?: string
          tags?: Json
          updated_at?: string
          versions?: Json
        }
        Update: {
          branch?: string
          created_at?: string
          id?: string
          ingredients?: Json
          name?: string
          pfc?: Json | null
          servings_base?: number
          steps?: Json
          tag?: string
          tags?: Json
          updated_at?: string
          versions?: Json
        }
        Relationships: []
      }
      units: {
        Row: {
          created_at: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
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
