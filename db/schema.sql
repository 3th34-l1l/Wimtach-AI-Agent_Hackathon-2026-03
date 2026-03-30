create table if not exists projects (
  project_id bigint primary key,
  project_name text,
  parent_project_id bigint,
  parent_project_name text,
  ultimate_parent_id bigint,
  ultimate_parent_name text,
  last_updated timestamp null,
  project_stage text,
  project_type text,
  project_value_raw text,
  project_value_usd numeric,
  country text,
  state text,
  city text,
  construction_type text,
  location_type text,
  profile_status text,
  project_announcement_quarter text,
  construction_start_quarter text,
  project_end_quarter text,
  funding_mode text,
  funding_secured text,
  primary_sector text,
  secondary_sector text,
  region text,
  project_attribute text,
  latitude double precision,
  longitude double precision,
  latest_momentum_score integer,
  project_event text,
  project_scope text,
  project_background text,
  latest_updates text,
  project_overview text,
  created_at timestamp default now()
);

create index if not exists idx_projects_stage on projects(project_stage);
create index if not exists idx_projects_country on projects(country);
create index if not exists idx_projects_state on projects(state);
create index if not exists idx_projects_sector on projects(primary_sector);
create index if not exists idx_projects_type on projects(construction_type);

create table if not exists project_locations (
  id bigserial primary key,
  project_id bigint references projects(project_id) on delete cascade,
  is_primary text,
  sort_order integer,
  city text,
  state text,
  country text,
  latitude double precision,
  longitude double precision,
  project_post_code text
);

create index if not exists idx_project_locations_project_id on project_locations(project_id);

create table if not exists project_operating_metrics (
  operating_metric_id bigint primary key,
  project_id bigint references projects(project_id) on delete cascade,
  facility_type text,
  parameter text,
  unit_value numeric,
  unit_name text,
  product_name text
);

create index if not exists idx_metrics_project_id on project_operating_metrics(project_id);
create index if not exists idx_metrics_parameter on project_operating_metrics(parameter);

create table if not exists project_subprojects (
  id bigserial primary key,
  parent_project_id bigint references projects(project_id) on delete cascade,
  sub_project_id bigint,
  sub_project_name text
);

create index if not exists idx_subprojects_parent on project_subprojects(parent_project_id);

create table if not exists project_companies (
  id bigserial primary key,
  project_id bigint references projects(project_id) on delete cascade,
  company_id bigint,
  company_name text,
  company_role text null,
  company_ticker text null
);

create index if not exists idx_project_companies_project_id on project_companies(project_id);
create index if not exists idx_project_companies_company_id on project_companies(company_id);

create table if not exists companies (
  company_id bigint primary key,
  company_name text,
  company_url text,
  country text,
  state text,
  city text,
  industry text,
  employees text,
  revenue text,
  parent_company_name text,
  raw_json jsonb
);

create index if not exists idx_companies_name on companies(company_name);

create table if not exists safety_reports (
  report_id bigserial primary key,
  project_id bigint references projects(project_id),
  input_channel text,
  reported_at timestamp,
  raw_input text,
  narrative text,
  incident_type text,
  hazard_type text,
  injury_involved boolean,
  site_conditions text,
  review_status text default 'draft',
  extracted_fields jsonb default '{}'::jsonb,
  created_at timestamp default now()
);

create index if not exists idx_safety_reports_project_id on safety_reports(project_id);
create index if not exists idx_safety_reports_review_status on safety_reports(review_status);

create table if not exists analysis_results (
  analysis_id bigserial primary key,
  report_id bigint references safety_reports(report_id) on delete cascade,
  summary text,
  detected_hazards jsonb default '[]'::jsonb,
  trend_signals jsonb default '[]'::jsonb,
  source_matches jsonb default '[]'::jsonb,
  mapping_status text,
  confidence_score numeric,
  explanation text,
  created_at timestamp default now()
);