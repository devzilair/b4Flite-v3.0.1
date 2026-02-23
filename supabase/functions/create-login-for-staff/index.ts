
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Add type declaration for Deno global for non-Deno environments
declare const Deno: any;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { staff_id, email } = await req.json();
    if (!staff_id || !email) {
      throw new Error("staff_id and email are required.");
    }

    // 1. Verify staff profile exists and doesn't have a login
    const { data: staffCheck, error: staffCheckError } = await supabaseAdmin
        .from('staff')
        .select('auth_id, name')
        .eq('id', staff_id)
        .single();
    
    if (staffCheckError) throw new Error(`Could not verify staff profile: ${staffCheckError.message}`);
    if (staffCheck.auth_id) {
        return new Response(JSON.stringify({ error: "This staff member already has a login associated with their profile." }), {
          status: 409, // Conflict
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    // 2. Invite the user by email.
    // The Database Trigger `on_auth_user_created` will automatically link the 
    // new auth user to the staff profile based on the email address.
    const { error: userError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: { name: staffCheck.name } // Pass name to metadata for consistency
    });

    if (userError) {
      if (userError.message.includes("User already registered")) {
        return new Response(JSON.stringify({ error: "An account with this email already exists. Please delete the old auth user or resolve manually." }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw userError;
    }

    // Success
    return new Response(JSON.stringify({ message: "Invitation sent. Profile linking handled by database trigger." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
