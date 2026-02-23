
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
    console.log("Portal Setup: Function started.");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { user } = await req.json();
    if (!user || !user.email || !user.password || !user.name) {
      throw new Error("User details (name, email, password) are required.");
    }

    // 1. ENSURE DEPENDENCIES (Roles & Departments) exist
    const { error: roleError } = await supabaseAdmin.from('roles').upsert({
        id: 'role_super_admin',
        name: 'Super Admin',
        permissions: [] 
    });
    if (roleError) console.warn("Portal Setup: Warning ensuring role:", roleError.message);

    const { error: deptError } = await supabaseAdmin.from('departments').upsert({
        id: 'dept_pilots',
        name: 'Pilots' 
    });
    if (deptError) console.warn("Portal Setup: Warning ensuring department:", deptError.message);

    // 2. CHECK EXISTING STAFF
    // If staff table is empty, this is a fresh setup.
    const { count: staffCount } = await supabaseAdmin.from('staff').select('*', { count: 'exact', head: true });
    
    if (staffCount !== null && staffCount > 0) {
        throw new Error("Portal setup has already been completed (staff records exist).");
    }

    // 3. CREATE AUTH USER
    // This will fire the `on_auth_user_created` DB Trigger.
    // The trigger will create the `public.staff` record automatically with default role 'role_staff'.
    console.log("Portal Setup: Creating admin auth user...");
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: { name: user.name }
    });

    if (authError) throw new Error(`Failed to create admin auth user: ${authError.message}`);
    
    // 4. ELEVATE TO SUPER ADMIN
    // Since the trigger creates the user as 'role_staff', we must immediately upgrade them.
    // We allow a small delay for the trigger to complete transaction.
    console.log("Portal Setup: Elevating user to Super Admin...");
    
    const { error: upgradeError } = await supabaseAdmin
        .from('staff')
        .update({ 
            role_id: 'role_super_admin',
            department_id: 'dept_pilots' 
        })
        .eq('email', user.email);

    if (upgradeError) {
        throw new Error(`Auth created, but failed to elevate profile to Super Admin: ${upgradeError.message}`);
    }

    console.log("Portal Setup: Success!");
    return new Response(JSON.stringify({ message: "Portal setup successful" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Portal Setup: CRITICAL ERROR:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
