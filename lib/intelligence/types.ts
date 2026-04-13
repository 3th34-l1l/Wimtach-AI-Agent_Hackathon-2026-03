export type EntityType =
  | "aircraft"
  | "airport"
  | "operator"
  | "company"
  | "person"
  | "mechanic"
  | "pilot"
  | "fbo"
  | "service_provider"
  | "social_account";

export type SourceType =
  | "official_registry"
  | "business_website"
  | "directory"
  | "instagram"
  | "public_social"
  | "news"
  | "manual_entry"
  | "inferred";

export type EntityRecord = {
  id: string;
  name: string;
  entityType: EntityType;
  location?: string;
  website?: string;
  publicEmail?: string;
  publicPhone?: string;
  instagramHandle?: string;
  sourceType: SourceType;
  confidenceScore: number;
  notes?: string;
};

export type RelationshipType =
  | "operates"
  | "based_at"
  | "works_for"
  | "services"
  | "posted_about"
  | "linked_to"
  | "likely_associated_with";

export type RelationshipRecord = {
  fromId: string;
  toId: string;
  relationship: RelationshipType;
  confidenceScore: number;
  evidence: string[];
};