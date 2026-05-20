const SUPABASE_URL = "sb_publishable_HcU1GoBSsRrg4X_m-FOASQ_ygk4WQmH";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjdXdwcXhlaWtpYXlleG1xd2dqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxMjI4ODcsImV4cCI6MjA5NDY5ODg4N30.LqeFYlbHx7_-v9VXDboAx28HTEjTHkf3t7VuYpSgR8Q";

const supabaseClient = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);