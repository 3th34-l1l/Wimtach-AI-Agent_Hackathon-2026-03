from pathlib import Path
import json
import pandas as pd
from sqlalchemy import create_engine

DB_URL = "postgresql+psycopg2://glip:glippass@localhost:5432/glip"
OUT = Path(__file__).resolve().parent.parent / "docs" / "admin_insights_summary.json"

engine = create_engine(DB_URL)

def q(sql: str) -> pd.DataFrame:
    return pd.read_sql(sql, engine)

def top_counts(df: pd.DataFrame, key: str, n: int = 10):
    if key not in df.columns:
        return []
    out = (
        df[key]
        .fillna("Unknown")
        .astype(str)
        .value_counts()
        .head(n)
        .reset_index()
    )
    out.columns = [key, "count"]
    return out.to_dict(orient="records")

def sector_root(series: pd.Series) -> pd.Series:
    return (
        series.fillna("Unknown")
        .astype(str)
        .apply(lambda x: x.split(" --> ")[0].strip() if " --> " in x else x)
    )

def main():
    projects = q("select * from projects")
    locations = q("select * from project_locations")
    metrics = q("select * from project_operating_metrics")
    subprojects = q("select * from project_subprojects")
    project_companies = q("select * from project_companies")
    companies = q("select * from companies")

    active_projects = projects[
        projects["project_stage"].fillna("").isin(["Planning", "Design", "Execution"])
    ].copy()

    projects["sector_root"] = sector_root(projects["primary_sector"])
    active_projects["sector_root"] = sector_root(active_projects["primary_sector"])

    company_counts = (
        project_companies.groupby("project_id")
        .size()
        .reset_index(name="company_count")
    )

    metrics_counts = (
        metrics.groupby("project_id")
        .size()
        .reset_index(name="metric_count")
    )

    project_company_stats = {
        "avg_companies_per_project": round(float(company_counts["company_count"].mean()), 2) if len(company_counts) else 0,
        "median_companies_per_project": round(float(company_counts["company_count"].median()), 2) if len(company_counts) else 0,
        "projects_with_multiple_companies": int((company_counts["company_count"] > 1).sum()) if len(company_counts) else 0,
    }

    top_value_projects = (
        projects[["project_id", "project_name", "project_value_usd", "project_stage", "state", "country"]]
        .dropna(subset=["project_value_usd"])
        .sort_values("project_value_usd", ascending=False)
        .head(10)
        .to_dict(orient="records")
    )

    summary = {
        "headline_kpis": {
            "total_projects": int(len(projects)),
            "active_projects": int(len(active_projects)),
            "total_locations": int(len(locations)),
            "total_metrics": int(len(metrics)),
            "total_subprojects": int(len(subprojects)),
            "total_project_company_links": int(len(project_companies)),
            "total_companies": int(len(companies)),
        },
        "distributions": {
            "project_stage": top_counts(projects, "project_stage", 10),
            "country": top_counts(projects, "country", 10),
            "state": top_counts(projects, "state", 10),
            "construction_type": top_counts(projects, "construction_type", 10),
            "location_type": top_counts(projects, "location_type", 10),
            "sector_root": top_counts(projects, "sector_root", 10),
            "active_sector_root": top_counts(active_projects, "sector_root", 10),
        },
        "metrics": {
            "top_parameters": top_counts(metrics, "parameter", 15),
            "top_facility_types": top_counts(metrics, "facility_type", 15),
            "projects_with_metrics": int(metrics["project_id"].nunique()) if "project_id" in metrics.columns else 0,
            "avg_metrics_per_project": round(float(metrics_counts["metric_count"].mean()), 2) if len(metrics_counts) else 0,
        },
        "companies": project_company_stats,
        "top_value_projects": top_value_projects,
        "insights": [
            "The dataset is large enough to support contextual project analysis, not just simple storage.",
            "Project-company relationships suggest high multi-party coordination complexity across many projects.",
            "The project base is concentrated in North America, which fits the current MVP framing.",
            "Stage, sector, and construction-type distributions can support immediate management-level filtering.",
            "Operating metrics provide a strong basis for project-scale and project-form analysis."
        ]
    }

    OUT.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(f"Wrote {OUT}")

if __name__ == "__main__":
    main()