import { SavedDocument, UploadedFile, DocumentVersion } from '../types';

const ETP_STORAGE_KEY = 'savedETPs';
const TR_STORAGE_KEY = 'savedTRs';
const FILES_STORAGE_KEY = 'trGeniusFiles';

// Document Management (ETP & TR)
const getSavedDocuments = (key: string): SavedDocument[] => {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : [];
};

const saveDocuments = (key: string, docs: SavedDocument[]): void => {
  const oldDocs = getSavedDocuments(key);
  const oldDocsMap = new Map(oldDocs.map(d => [d.id, d]));
  const timestamp = new Date().toISOString();

  const updatedDocs = docs.map(newDoc => {
    const oldDoc = oldDocsMap.get(newDoc.id);

    // Case 1: Brand new document
    if (!oldDoc) {
      return {
        ...newDoc,
        createdAt: newDoc.createdAt || timestamp,
        updatedAt: timestamp,
        history: [{
          timestamp: timestamp,
          summary: 'Documento criado.',
          sections: newDoc.sections,
          attachments: newDoc.attachments
        }]
      };
    }

    // Case 2: Existing document. Check for changes.
    const hasChanged = JSON.stringify(newDoc.sections) !== JSON.stringify(oldDoc.sections) ||
                         JSON.stringify(newDoc.attachments || []) !== JSON.stringify(oldDoc.attachments || []) ||
                         newDoc.name !== oldDoc.name ||
                         newDoc.priority !== oldDoc.priority;

    if (hasChanged) {
      const changes: string[] = [];
      if (newDoc.name !== oldDoc.name) {
        changes.push('nome alterado');
      }
      if (newDoc.priority !== oldDoc.priority) {
        changes.push('prioridade alterada');
      }
      if (JSON.stringify(newDoc.sections) !== JSON.stringify(oldDoc.sections)) {
        changes.push('conteúdo das seções modificado');
      }
      if (JSON.stringify(newDoc.attachments || []) !== JSON.stringify(oldDoc.attachments || [])) {
        changes.push('anexos atualizados');
      }

      const summary = changes.length > 0 ? `Alteração: ${changes.join(', ')}.` : 'Modificações gerais.';

      const newHistoryEntry: DocumentVersion = {
        timestamp: timestamp,
        summary: summary,
        sections: newDoc.sections,
        attachments: newDoc.attachments
      };
      
      const newHistory = [newHistoryEntry, ...(oldDoc.history || [])];

      return {
        ...newDoc,
        updatedAt: timestamp,
        history: newHistory
      };
    }

    // No changes detected, return the old document to preserve its exact state and history
    return oldDoc;
  });

  localStorage.setItem(key, JSON.stringify(updatedDocs));
};

export const getSavedETPs = (): SavedDocument[] => getSavedDocuments(ETP_STORAGE_KEY);
export const saveETPs = (etps: SavedDocument[]): void => saveDocuments(ETP_STORAGE_KEY, etps);
export const getSavedTRs = (): SavedDocument[] => getSavedDocuments(TR_STORAGE_KEY);
export const saveTRs = (trs: SavedDocument[]): void => saveDocuments(TR_STORAGE_KEY, trs);

// Uploaded Files Management
export const getStoredFiles = (): UploadedFile[] => {
    const data = localStorage.getItem(FILES_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
};

export const saveStoredFiles = (files: UploadedFile[]): void => {
    localStorage.setItem(FILES_STORAGE_KEY, JSON.stringify(files));
};

// Form State Management
export const saveFormState = (key: string, state: object): void => {
    localStorage.setItem(key, JSON.stringify(state));
};

export const loadFormState = (key: string): object | null => {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
};