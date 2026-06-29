import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

export type AcsAnimal = {
  id: string;
  shelter_id: string;
  shelter_name: string;
  kennel_id: string | null;
  name: string;
  species: string;
  breed: string | null;
  age: string | null;
  sex: string | null;
  weight: string | null;
  photo_url: string;
  story: string | null;
  status: "at_risk" | "med_foster" | "pm_cutoff" | string;
  urgency: number;
  days_at_shelter: number;
  tags: string[];
  last_pulled_at: string;
};

export type AcsListResult = {
  animals: AcsAnimal[];
  total: number;
  counts: { at_risk: number; med_foster: number; pm_cutoff: number };
  shelter_name: string;
  last_pulled_at: string | null;
};

function serverClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: {
        storage: undefined,
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}

export const listAcsAnimals = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => {
    const o = (input ?? {}) as { shelterId?: string; limit?: number };
    return {
      shelterId: o.shelterId || "san_antonio_acs",
      limit: typeof o.limit === "number" ? o.limit : 10,
    };
  })
  .handler(async ({ data }): Promise<AcsListResult> => {
    const sb = serverClient();

    const { data: rows, error } = await sb
      .from("acs_animals")
      .select(
        "id, shelter_id, shelter_name, kennel_id, name, species, breed, age, sex, weight, photo_url, story, status, urgency, days_at_shelter, tags, last_pulled_at",
      )
      .eq("shelter_id", data.shelterId)
      .order("urgency", { ascending: false })
      .order("days_at_shelter", { ascending: false });

    if (error) throw new Error(error.message);

    const all = (rows ?? []) as AcsAnimal[];
    const counts = {
      at_risk: all.filter((a) => a.status === "at_risk").length,
      med_foster: all.filter((a) => a.status === "med_foster").length,
      pm_cutoff: all.filter((a) => a.status === "pm_cutoff").length,
    };
    const last = all.reduce<string | null>((acc, a) => {
      if (!a.last_pulled_at) return acc;
      if (!acc || a.last_pulled_at > acc) return a.last_pulled_at;
      return acc;
    }, null);

    return {
      animals: all.slice(0, data.limit),
      total: all.length,
      counts,
      shelter_name: all[0]?.shelter_name ?? "San Antonio ACS",
      last_pulled_at: last,
    };
  });
