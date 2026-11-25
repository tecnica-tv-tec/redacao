// Configuração do Supabase (projeto redacao-tvtec · São Paulo).
// A chave "anon" é pública por natureza: só funciona dentro das regras de segurança (RLS) do banco.
// Nunca coloque a chave service_role aqui.
// No computador local (node server.js) o sistema continua no modo demonstração;
// para testar o Supabase localmente, abra http://localhost:3000/?supabase=1
(function () {
  const local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && !/[?&]supabase=1/.test(location.search);
  window.REDACAO_CONFIG = local ? { supabaseUrl: '', supabaseAnonKey: '' } : {
    dominioEmail: 'tvtecjundiai.com.br',   // cadastro restrito (a regra real fica no banco)
    supabaseUrl: 'https://qjedvtmoqcarhkkbausc.supabase.co',
    supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqZWR2dG1vcWNhcmhra2JhdXNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTU2MjYwODAsImV4cCI6MjExMTIwMjA4MH0.i-HcVpDSmodDNEddO2TUbxaLfQgTAOPiISiNcKBcAFw',
  };
})();
