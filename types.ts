export type Priority = 'low' | 'medium' | 'high';

export interface Section {
  id: string;
  title: string;
  placeholder: string;
  hasGen: boolean;
  hasRiskAnalysis?: boolean;
  tooltip?: string;
  isAttachmentSection?: boolean;
}

export interface DocumentSection {
  [key: string]: string;
}

export interface Attachment {
  name: string;
  type: string;
  size: number;
  content: string; // base64 encoded content
  description?: string;
}

export interface DocumentVersion {
  timestamp: string;
  summary: string;
  sections: DocumentSection;
  attachments?: Attachment[];
}

export interface SavedDocument {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
  sections: DocumentSection;
  attachments?: Attachment[];
  history?: DocumentVersion[];
  priority?: Priority;
}

export type DocumentType = 'etp' | 'tr';

export interface Template {
  id: string;
  name: string;
  description: string;
  type: DocumentType;
  sections: Record<string, string>;
}

export interface FileChunk {
  page: number;
  content: string;
}

export interface UploadedFile {
  name: string;
  type: string;
  content: string; // base64 encoded content
  chunks: string[];
  selected: boolean;
  isLocked?: boolean;
}

export interface PreviewContext {
  type: DocumentType | null;
  id: number | null;
}

export interface Notification {
  id: number;
  title: string;
  text: string;
  type: 'success' | 'error' | 'info';
}