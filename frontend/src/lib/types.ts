export interface AuthUser {
  user_id: string;
  email: string;
  full_name: string;
  roles: string[];
  permissions: string[];
}

export interface Tokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface AuthResponse {
  user: AuthUser;
  tokens: Tokens;
}

export interface Page<T> {
  items: T[];
  page: number;
  size: number;
  total: number;
  pages: number;
}

export interface Category {
  folder: string;
  doc_type: string;
  jurisdiction: string;
  purpose: string;
  answers_for: string[];
  pdf_examples: string[];
  recommended_min_pdfs: number;
  recommended_optimal_pdfs: number;
  ingestion_tips: string;
}

export interface KnowledgeDocument {
  document_id: string;
  title: string;
  doc_type: string;
  jurisdiction: string | null;
  chunk_count: number;
  status: string;
  source_uri?: string | null;
  content_hash?: string | null;
  indexed_at?: string | null;
}

export interface IngestionResult {
  document_id: string;
  title: string;
  doc_type: string;
  jurisdiction: string | null;
  chunk_count: number;
  page_count: number | null;
  citations: string[];
  status: string;
  chunks_embedded?: number;
}

export interface UserDocument {
  document_id: string;
  title: string;
  filename?: string | null;
  doc_type?: string | null;
  status: string;
  page_count?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface IngestionJob {
  job_id: string;
  status: "pending" | "processing" | "indexed" | "failed" | string;
  title: string;
  doc_type: string;
  document_id: string | null;
  chunk_count: number;
  error: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export type UploadDocumentResponse =
  | { kind: "result"; data: IngestionResult }
  | { kind: "job"; data: IngestionJob };

export interface KnowledgeGraphNode {
  id: string;
  label: string;
  type: "Document" | "Reference" | string;
  doc_type?: string | null;
  jurisdiction?: string | null;
  document_id?: string | null;
  key?: string | null;
}

export interface KnowledgeGraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
}

export interface KnowledgeGraphStats {
  documents: number;
  references: number;
  citations: number;
}

export interface KnowledgeGraph {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
  stats: KnowledgeGraphStats;
}

export interface RetrievedSource {
  chunk_id: string;
  document_id: string;
  title?: string | null;
  doc_type?: string | null;
  jurisdiction?: string | null;
  citation?: string | null;
  section?: string | null;
  content: string;
  score: number;
  retrieval: string;
}

export interface Citation {
  marker: string;
  title?: string | null;
  citation?: string | null;
  document_id: string;
  section?: string | null;
}

export interface ConfidenceBreakdown {
  retrieval_strength: number;
  source_agreement: number;
  coverage: number;
  overall: number;
}

export interface JurisdictionResult {
  country: string;
  level: string;
  region?: string | null;
  confidence: number;
}

export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
}

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface WebImageResult {
  title: string;
  image_url: string;
  source_url: string;
  caption: string;
}

export interface ResearchResponse {
  query: string;
  intent: string;
  jurisdiction: JurisdictionResult;
  answer: string;
  sources: RetrievedSource[];
  web_sources: WebSearchResult[];
  web_images: WebImageResult[];
  suggestions: string[];
  citations: Citation[];
  confidence: ConfidenceBreakdown;
  trace: string[];
  specialist_payload: Record<string, unknown>;
  disclaimer: string;
}

export interface LawyerProfile {
  id: string;
  full_name: string;
  bar_council_id: string;
  practice_areas: string[];
  city: string;
  jurisdictions: string[];
  languages: string[];
  years_experience: number;
  rating: number;
  review_count: number;
  verified: boolean;
  hourly_rate_inr: number | null;
  bio: string;
}

export interface LawyerMatchResult {
  id: string;
  full_name: string;
  bar_council_id: string | null;
  practice_areas: string[];
  jurisdictions: string[];
  years_experience: number;
  languages: string[];
  rating: number;
  rating_count: number;
  hourly_rate: number | null;
  is_verified: boolean;
  summary: string;
  match_score: number;
  ai_recommended: boolean;
}

export type AppointmentStatus = "requested" | "confirmed" | "completed" | "cancelled";

export interface ConsultationBooking {
  id: string;
  lawyer_id: string;
  lawyer_name: string;
  date: string;
  time_slot: string;
  matter_summary: string;
  status: AppointmentStatus;
  created_at: string;
}

export type CaseStatus = "open" | "in_progress" | "closed";

export interface CaseTimelineEvent {
  id: string;
  label: string;
  description: string;
  at: string;
}

export interface LegalCase {
  id: string;
  title: string;
  description: string;
  case_number: string;
  court: string;
  jurisdiction: string;
  practice_area: string;
  status: CaseStatus;
  created_at: string;
  updated_at: string;
  timeline: CaseTimelineEvent[];
  linked_appointment_id?: string | null;
}
