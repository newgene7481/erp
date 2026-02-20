const { createClient } = supabase;
const SUPABASE_URL = "https://nuvqtknmmucuapljlycx.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51dnF0a25tbXVjdWFwbGpseWN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1NzY5OTgsImV4cCI6MjA4MzE1Mjk5OH0.uRXBr5TsvAVtDYdHA3c2SI9uUvyWr5y-DIH3_2OpW6c";
window.supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Preferências de Funcionamento do Sistema
const PREFERENCIAS = {
    exigirLogin: false, // Mude para true quando quiser ativar a tela de PIN
    usuarioPadrao: {
        id: 2,
        nome: "Rogério",
        permissao: "admin"
    }
};
