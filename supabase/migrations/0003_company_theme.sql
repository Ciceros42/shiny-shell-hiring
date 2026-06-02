-- Seed Shiny Shell brand theme into companies.settings
update companies set settings = settings || '{"theme":{"displayName":"Shiny Shell Carwash","primaryColor":"#1e3c6c","primaryForeground":"#ffffff","primaryMuted":"rgba(255,255,255,0.7)","fontFamily":"Gotham, Arial, sans-serif","borderRadius":"0.375rem"}}'::jsonb where slug = 'shiny-shell';
