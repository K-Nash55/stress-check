// Supabase クライアント初期化
// 全ページからこのファイルを読み込んで使用する
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script> の後に読み込むこと

var SUPABASE_URL = 'https://oazwzbrtfccicokxmris.supabase.co';
var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9hend6YnJ0ZmNjaWNva3htcmlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwNzI5OTYsImV4cCI6MjA5MTY0ODk5Nn0.PRcUsff7XsGCelbt3JtdY3KS2XQt8d18aQ_Ws5J4oTo';

var supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
