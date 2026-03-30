from pathlib import Path
import json
import sys
import traceback
import pandas as pd
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError

DB_URL = "postgresql+psycopg2://glip:glippass@localhost:5432/glip"
BASE = Path(__file__).resolve().parent.parent / "docs"

FILES = {
    "projects": BASE / "ProjectDetails.xlsx",
    "locations": BASE / "ProjectLocations.xlsx",
    "metrics": BASE / "ProjectOperatingMetrics.xlsx",
    "subprojects": BASE / "ProjectSubProjects.xlsx",
    "project_companies": BASE / "ProjectCompanies.xlsx",
    "companies": BASE / "Construction_CompanyDetails.xlsx",
}

CHUNK_SIZES = {
    "projects": 250,
    "locations": 500,
    "metrics": 250,
    "subprojects": 500,
    "project_companies": 500,
    "companies": 250,
}

engine = create_engine(
    DB_URL,
    pool_pre_ping=True,
    future=True,
)

def banner(msg: str) -> None:
    print(f"\n{'=' * 72}\n{msg}\n{'=' * 72}")

def info(msg: str) -> None:
    print(f"[INFO] {msg}")

def warn(msg: str) -> None:
    print(f"[WARN] {msg}")

def fail(msg: str) -> None:
    print(f"[ERROR] {msg}")

def verify_files() -> None:
    banner("Checking source files")
    missing = []
    for name, path in FILES.items():
        exists = path.exists()
        print(f"{name}: {path} -> exists={exists}")
        if not exists:
            missing.append(str(path))
    if missing:
        raise FileNotFoundError(
            "Missing required files:\n" + "\n".join(missing)
        )

def load_one(path: Path) -> pd.DataFrame:
    return pd.read_excel(path)

def nullify_scalar(value):
    if pd.isna(value):
        return None
    return value

def dataframe_nulls_to_none(df: pd.DataFrame) -> pd.DataFrame:
    return df.where(pd.notna(df), None)

def require_columns(df: pd.DataFrame, required: list[str], label: str) -> None:
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise ValueError(
            f"{label}: missing required columns: {missing}\n"
            f"Available columns: {df.columns.tolist()}"
        )

def normalize_projects(df: pd.DataFrame) -> pd.DataFrame:
    out = df.rename(columns={
        "ProjectId": "project_id",
        "ProjectName": "project_name",
        "ParentProjectId": "parent_project_id",
        "ParentProjectName": "parent_project_name",
        "UltimateParentId": "ultimate_parent_id",
        "UltimateParentName": "ultimate_parent_name",
        "LastUpdated": "last_updated",
        "ProjectStage": "project_stage",
        "ProjectType": "project_type",
        "ProjectValue": "project_value_raw",
        "ProjectValue_USD": "project_value_usd",
        "Country": "country",
        "State": "state",
        "City": "city",
        "ConstructionType": "construction_type",
        "LocationType": "location_type",
        "ProfileStatus": "profile_status",
        "ProjectAnnouncementQuarter": "project_announcement_quarter",
        "ConstructionStartQuarter": "construction_start_quarter",
        "ProjectEndQuarter": "project_end_quarter",
        "FundingMode": "funding_mode",
        "FundingSecured": "funding_secured",
        "PrimarySector": "primary_sector",
        "SecondarySector": "secondary_sector",
        "Region": "region",
        "ProjectAttribute": "project_attribute",
        "Latitude": "latitude",
        "Longitude": "longitude",
        "LatestMomentumScore": "latest_momentum_score",
        "ProjectEvent": "project_event",
        "ProjectScope": "project_scope",
        "ProjectBackground": "project_background",
        "LatestUpdates": "latest_updates",
        "ProjectOverview": "project_overview",
    }).copy()

    cols = [
        "project_id",
        "project_name",
        "parent_project_id",
        "parent_project_name",
        "ultimate_parent_id",
        "ultimate_parent_name",
        "last_updated",
        "project_stage",
        "project_type",
        "project_value_raw",
        "project_value_usd",
        "country",
        "state",
        "city",
        "construction_type",
        "location_type",
        "profile_status",
        "project_announcement_quarter",
        "construction_start_quarter",
        "project_end_quarter",
        "funding_mode",
        "funding_secured",
        "primary_sector",
        "secondary_sector",
        "region",
        "project_attribute",
        "latitude",
        "longitude",
        "latest_momentum_score",
        "project_event",
        "project_scope",
        "project_background",
        "latest_updates",
        "project_overview",
    ]
    require_columns(out, cols, "projects")
    out = dataframe_nulls_to_none(out)
    return out[cols]

def normalize_locations(df: pd.DataFrame) -> pd.DataFrame:
    out = df.rename(columns={
        "ProjectID": "project_id",
        "Primary": "is_primary",
        "SortOrder": "sort_order",
        "City": "city",
        "State": "state",
        "Country": "country",
        "Latitude": "latitude",
        "Longitude": "longitude",
        "ProjectPostCode": "project_post_code",
    }).copy()

    cols = [
        "project_id",
        "is_primary",
        "sort_order",
        "city",
        "state",
        "country",
        "latitude",
        "longitude",
        "project_post_code",
    ]
    require_columns(out, cols, "locations")
    out = dataframe_nulls_to_none(out)
    return out[cols]

def normalize_metrics(df: pd.DataFrame) -> pd.DataFrame:
    info(f"Metrics columns: {df.columns.tolist()}")

    out = df.rename(columns={
        "ProjectID": "project_id",
        "OperatingMetricID": "operating_metric_id",
        "Parameter": "parameter",
        "UnitValue": "unit_value",
        "UnitName": "unit_name",
        "ProductName": "product_name",
    }).copy()

    if "FacilityType" in df.columns:
        out["facility_type"] = df["FacilityType"]
    elif "FacilityName" in df.columns:
        out["facility_type"] = df["FacilityName"]
    elif "Facility_Name" in df.columns:
        out["facility_type"] = df["Facility_Name"]
    else:
        out["facility_type"] = None

    cols = [
        "operating_metric_id",
        "project_id",
        "facility_type",
        "parameter",
        "unit_value",
        "unit_name",
        "product_name",
    ]
    require_columns(out, cols, "metrics")
    out = dataframe_nulls_to_none(out)
    return out[cols]

def normalize_subprojects(df: pd.DataFrame) -> pd.DataFrame:
    out = df.rename(columns={
        "ProjectID": "parent_project_id",
        "ProjectId2": "sub_project_id",
        "ProjectName": "sub_project_name",
    }).copy()

    cols = [
        "parent_project_id",
        "sub_project_id",
        "sub_project_name",
    ]
    require_columns(out, cols, "subprojects")
    out = dataframe_nulls_to_none(out)
    return out[cols]

def normalize_project_companies(df: pd.DataFrame) -> pd.DataFrame:
    out = df.rename(columns={
        "ProjectID": "project_id",
        "CompanyId": "company_id",
        "CompanyName": "company_name",
        "TickerSymbol": "company_ticker",
    }).copy()

    cols = [
        "project_id",
        "company_id",
        "company_name",
        "company_ticker",
    ]
    require_columns(out, cols, "project_companies")
    out = dataframe_nulls_to_none(out)
    return out[cols]

def normalize_companies(df: pd.DataFrame) -> pd.DataFrame:
    cleaned_rows = []

    for row in df.to_dict(orient="records"):
        cleaned_row = {k: nullify_scalar(v) for k, v in row.items()}
        cleaned_rows.append(cleaned_row)

    out = df.rename(columns={
        "CompanyId": "company_id",
        "CompanyName": "company_name",
        "CompanyUrl": "company_url",
        "HeadQuarters_Country": "country",
        "HeadQuarters_State": "state",
        "HeadQuarters_City": "city",
        "PrimaryIndustry": "industry",
        "NoOfEmployees": "employees",
        "AnnualRevenue": "revenue",
        "ParentCompanyName": "parent_company_name",
    }).copy()

    out = dataframe_nulls_to_none(out)

    out["raw_json"] = [
        json.dumps(row, allow_nan=False, default=str)
        for row in cleaned_rows
    ]

    cols = [
        "company_id",
        "company_name",
        "company_url",
        "country",
        "state",
        "city",
        "industry",
        "employees",
        "revenue",
        "parent_company_name",
        "raw_json",
    ]
    require_columns(out, cols, "companies")
    return out[cols]

def coerce_types(
    projects: pd.DataFrame,
    locations: pd.DataFrame,
    metrics: pd.DataFrame,
    subprojects: pd.DataFrame,
    project_companies: pd.DataFrame,
    companies: pd.DataFrame,
):
    for col in ["project_id", "parent_project_id", "ultimate_parent_id"]:
        if col in projects.columns:
            projects[col] = pd.to_numeric(projects[col], errors="coerce")

    for col in ["project_id"]:
        if col in locations.columns:
            locations[col] = pd.to_numeric(locations[col], errors="coerce")

    for col in ["operating_metric_id", "project_id"]:
        if col in metrics.columns:
            metrics[col] = pd.to_numeric(metrics[col], errors="coerce")

    for col in ["parent_project_id", "sub_project_id"]:
        if col in subprojects.columns:
            subprojects[col] = pd.to_numeric(subprojects[col], errors="coerce")

    for col in ["project_id", "company_id"]:
        if col in project_companies.columns:
            project_companies[col] = pd.to_numeric(project_companies[col], errors="coerce")

    if "company_id" in companies.columns:
        companies["company_id"] = pd.to_numeric(companies["company_id"], errors="coerce")

    if "project_value_usd" in projects.columns:
        projects["project_value_usd"] = pd.to_numeric(projects["project_value_usd"], errors="coerce")

    if "latest_momentum_score" in projects.columns:
        projects["latest_momentum_score"] = pd.to_numeric(projects["latest_momentum_score"], errors="coerce")

    if "latitude" in projects.columns:
        projects["latitude"] = pd.to_numeric(projects["latitude"], errors="coerce")
    if "longitude" in projects.columns:
        projects["longitude"] = pd.to_numeric(projects["longitude"], errors="coerce")

    if "latitude" in locations.columns:
        locations["latitude"] = pd.to_numeric(locations["latitude"], errors="coerce")
    if "longitude" in locations.columns:
        locations["longitude"] = pd.to_numeric(locations["longitude"], errors="coerce")

    if "sort_order" in locations.columns:
        locations["sort_order"] = pd.to_numeric(locations["sort_order"], errors="coerce")

    if "unit_value" in metrics.columns:
        metrics["unit_value"] = pd.to_numeric(metrics["unit_value"], errors="coerce")

    projects = dataframe_nulls_to_none(projects)
    locations = dataframe_nulls_to_none(locations)
    metrics = dataframe_nulls_to_none(metrics)
    subprojects = dataframe_nulls_to_none(subprojects)
    project_companies = dataframe_nulls_to_none(project_companies)
    companies = dataframe_nulls_to_none(companies)

    return projects, locations, metrics, subprojects, project_companies, companies

def dedupe_df(df: pd.DataFrame, subset: list[str], label: str) -> pd.DataFrame:
    before = len(df)
    df = df.drop_duplicates(subset=subset)
    removed = before - len(df)
    if removed > 0:
        warn(f"{label}: removed {removed} duplicate rows using key {subset}")
    else:
        info(f"{label}: no duplicate rows found on key {subset}")
    return df

def check_required_keys_not_null(df: pd.DataFrame, key_cols: list[str], label: str) -> pd.DataFrame:
    before = len(df)
    for col in key_cols:
        df = df[df[col].notna()]
    removed = before - len(df)
    if removed > 0:
        warn(f"{label}: removed {removed} rows with null required keys {key_cols}")
    return df

def print_row_counts(
    projects: pd.DataFrame,
    locations: pd.DataFrame,
    metrics: pd.DataFrame,
    subprojects: pd.DataFrame,
    project_companies: pd.DataFrame,
    companies: pd.DataFrame,
) -> None:
    banner("Prepared row counts")
    print("projects rows:", len(projects))
    print("locations rows:", len(locations))
    print("metrics rows:", len(metrics))
    print("subprojects rows:", len(subprojects))
    print("project_companies rows:", len(project_companies))
    print("companies rows:", len(companies))

def insert_df(df: pd.DataFrame, table_name: str, chunksize: int) -> None:
    info(f"Inserting {table_name} ({len(df)} rows, chunksize={chunksize})...")
    try:
        df.to_sql(
            table_name,
            engine,
            if_exists="append",
            index=False,
            method="multi",
            chunksize=chunksize,
        )
        info(f"Finished {table_name}")
    except SQLAlchemyError as e:
        fail(f"Insert failed for table: {table_name}")
        fail(str(e))
        raise

def verify_db_counts() -> None:
    banner("Database row counts after import")
    tables = [
        "projects",
        "project_locations",
        "project_operating_metrics",
        "project_subprojects",
        "project_companies",
        "companies",
    ]
    with engine.connect() as conn:
        for table in tables:
            count = conn.execute(text(f"select count(*) from {table}")).scalar()
            print(f"{table}: {count}")

def main():
    try:
        verify_files()

        banner("Loading Excel files")
        raw_projects = load_one(FILES["projects"])
        raw_locations = load_one(FILES["locations"])
        raw_metrics = load_one(FILES["metrics"])
        raw_subprojects = load_one(FILES["subprojects"])
        raw_project_companies = load_one(FILES["project_companies"])
        raw_companies = load_one(FILES["companies"])

        banner("Normalizing data")
        projects = normalize_projects(raw_projects)
        locations = normalize_locations(raw_locations)
        metrics = normalize_metrics(raw_metrics)
        subprojects = normalize_subprojects(raw_subprojects)
        project_companies = normalize_project_companies(raw_project_companies)
        companies = normalize_companies(raw_companies)

        banner("Coercing types")
        (
            projects,
            locations,
            metrics,
            subprojects,
            project_companies,
            companies,
        ) = coerce_types(
            projects,
            locations,
            metrics,
            subprojects,
            project_companies,
            companies,
        )

        banner("Cleaning duplicates / null keys")
        projects = check_required_keys_not_null(projects, ["project_id"], "projects")
        locations = check_required_keys_not_null(locations, ["project_id"], "locations")
        metrics = check_required_keys_not_null(metrics, ["operating_metric_id", "project_id"], "metrics")
        subprojects = check_required_keys_not_null(subprojects, ["parent_project_id", "sub_project_id"], "subprojects")
        project_companies = check_required_keys_not_null(project_companies, ["project_id", "company_id"], "project_companies")
        companies = check_required_keys_not_null(companies, ["company_id"], "companies")

        projects = dedupe_df(projects, ["project_id"], "projects")
        locations = dedupe_df(
            locations,
            ["project_id", "sort_order", "city", "state", "country", "project_post_code"],
            "locations",
        )
        metrics = dedupe_df(metrics, ["operating_metric_id"], "metrics")
        subprojects = dedupe_df(subprojects, ["parent_project_id", "sub_project_id"], "subprojects")
        project_companies = dedupe_df(project_companies, ["project_id", "company_id"], "project_companies")
        companies = dedupe_df(companies, ["company_id"], "companies")

        print_row_counts(
            projects,
            locations,
            metrics,
            subprojects,
            project_companies,
            companies,
        )

        banner("Starting inserts")
        insert_df(projects, "projects", CHUNK_SIZES["projects"])
        insert_df(locations, "project_locations", CHUNK_SIZES["locations"])
        insert_df(metrics, "project_operating_metrics", CHUNK_SIZES["metrics"])
        insert_df(subprojects, "project_subprojects", CHUNK_SIZES["subprojects"])
        insert_df(project_companies, "project_companies", CHUNK_SIZES["project_companies"])
        insert_df(companies, "companies", CHUNK_SIZES["companies"])

        verify_db_counts()
        banner("Import complete")

    except Exception as e:
        banner("IMPORT FAILED")
        fail(str(e))
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()