-- es_test_account deja de ser ejecutable sin sesión (30-sep-2026, advisor de seguridad
-- «anon_security_definer_function_executable»). La única que la llama es useAttributionSync, y solo
-- después de confirmar que hay usuario (supabase.auth.getUser): con sesión corre como authenticated,
-- que la conserva. Sin sesión respondía siempre false (auth.uid() es null): no servía para nada y
-- dejaba una función SECURITY DEFINER abierta al público.
revoke execute on function public.es_test_account() from anon;
