create table threads (
    id bigserial primary key,
    project_key varchar(100) not null,
    title varchar(200) not null,
    status varchar(20) not null,
    priority varchar(20) not null,
    original_intent text not null,
    today_goal text,
    done_condition text,
    current_next_action text,
    drift_status varchar(20) not null,
    last_activity_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_at timestamp with time zone not null default current_timestamp,
    updated_at timestamp with time zone not null default current_timestamp
);

create table provider_connections (
    id bigserial primary key,
    provider varchar(30) not null,
    account_label varchar(100),
    home_path varchar(300),
    status varchar(20) not null,
    last_import_at timestamp with time zone,
    last_error_message text,
    created_at timestamp with time zone not null default current_timestamp,
    updated_at timestamp with time zone not null default current_timestamp
);

create table source_sessions (
    id bigserial primary key,
    thread_id bigint references threads(id),
    provider_connection_id bigint references provider_connections(id),
    provider_session_key varchar(200) not null,
    provider varchar(30) not null,
    source_path varchar(500),
    source_type varchar(50),
    title varchar(200),
    started_at timestamp with time zone,
    last_activity_at timestamp with time zone,
    imported_at timestamp with time zone not null default current_timestamp,
    metadata_json text not null default '{}',
    created_at timestamp with time zone not null default current_timestamp,
    updated_at timestamp with time zone not null default current_timestamp
);

create table thread_snapshots (
    id bigserial primary key,
    thread_id bigint not null references threads(id),
    snapshot_type varchar(30) not null,
    summary text not null,
    next_action text,
    blockers text,
    drift_score numeric(5,2),
    drift_status varchar(20),
    created_at timestamp with time zone not null default current_timestamp,
    updated_at timestamp with time zone not null default current_timestamp
);

create table handoffs (
    id bigserial primary key,
    thread_id bigint not null references threads(id),
    source_session_id bigint references source_sessions(id),
    target_provider varchar(30) not null,
    reason varchar(100),
    what_changed text,
    blockers text,
    next_action text,
    files_note text,
    status varchar(20) not null,
    created_at timestamp with time zone not null default current_timestamp,
    updated_at timestamp with time zone not null default current_timestamp
);

create table notification_rules (
    id bigserial primary key,
    rule_type varchar(30) not null,
    enabled boolean not null,
    channel varchar(30) not null,
    threshold_minutes integer,
    scheduled_time varchar(10),
    config_json text not null default '{}',
    created_at timestamp with time zone not null default current_timestamp,
    updated_at timestamp with time zone not null default current_timestamp
);

create table notification_events (
    id bigserial primary key,
    thread_id bigint references threads(id),
    rule_id bigint references notification_rules(id),
    event_type varchar(30) not null,
    channel varchar(30) not null,
    payload_json text not null default '{}',
    delivery_status varchar(20) not null,
    sent_at timestamp with time zone,
    created_at timestamp with time zone not null default current_timestamp,
    updated_at timestamp with time zone not null default current_timestamp
);

create index idx_threads_status_priority_activity on threads (status, priority, last_activity_at);
create index idx_source_sessions_thread_imported on source_sessions (thread_id, imported_at);
create index idx_thread_snapshots_thread_created on thread_snapshots (thread_id, created_at);
