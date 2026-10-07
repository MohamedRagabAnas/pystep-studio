import { getSupabase } from "./supabaseClient.js";

export async function ensureLearnerProfile(user) {
  const supabase = getSupabase();
  if (!supabase || !user) return null;

  const profile = {
    id: user.id,
    email: user.email || null,
    display_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email || "Learner",
    avatar_url: user.user_metadata?.avatar_url || null,
    updated_at: new Date().toISOString()
  };

  const { error } = await supabase
    .from("learner_profiles")
    .upsert(profile, { onConflict: "id" });

  if (error) throw error;
  return profile;
}

export async function listLearningExamples(userId) {
  const supabase = getSupabase();
  if (!supabase || !userId) return [];

  const { data, error } = await supabase
    .from("learning_examples")
    .select("id,title,tag,code,insight,updated_at")
    .eq("learner_id", userId)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data || []).map(fromRow);
}

export async function upsertLearningExample(userId, example) {
  const supabase = getSupabase();
  if (!supabase || !userId) return null;

  const row = {
    learner_id: userId,
    title: example.title,
    tag: example.tag || "My learning",
    code: example.code,
    insight: example.insight || "Saved by the learner in My learning.",
    updated_at: new Date().toISOString()
  };

  if (example.remoteId) row.id = example.remoteId;

  const { data, error } = await supabase
    .from("learning_examples")
    .upsert(row)
    .select("id,title,tag,code,insight,updated_at")
    .single();

  if (error) throw error;
  return fromRow(data);
}

export async function deleteLearningExample(remoteId) {
  const supabase = getSupabase();
  if (!supabase || !remoteId) return;

  const { error } = await supabase
    .from("learning_examples")
    .delete()
    .eq("id", remoteId);

  if (error) throw error;
}

function fromRow(row) {
  return {
    remoteId: row.id,
    title: row.title,
    tag: row.tag || "My learning",
    code: row.code,
    insight: row.insight || "Saved by the learner in My learning.",
    updatedAt: row.updated_at
  };
}
