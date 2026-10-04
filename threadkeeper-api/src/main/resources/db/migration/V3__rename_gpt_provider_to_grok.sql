-- GPT was dropped as a provider: OpenAI's coding agent is already covered by
-- CODEX. Grok takes its slot. The columns hold the enum name as text, so any row
-- still saying GPT would fail to load once the constant is gone.
update provider_connections set provider = 'GROK' where provider = 'GPT';
update source_sessions set provider = 'GROK' where provider = 'GPT';
update handoffs set target_provider = 'GROK' where target_provider = 'GPT';
