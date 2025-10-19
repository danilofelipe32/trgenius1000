import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Section as SectionType, SavedDocument, UploadedFile, DocumentType, PreviewContext, Attachment, DocumentVersion, Priority, Template, Notification as NotificationType } from './types';
import * as storage from './services/storageService';
import { callGemini } from './services/geminiService';
import { processSingleUploadedFile, chunkText } from './services/ragService';
import { exportDocumentToPDF } from './services/exportService';
import { Icon } from './components/Icon';
import Login from './components/Login';
import { AttachmentManager } from './components/AttachmentManager';
import InstallPWA from './components/InstallPWA';
import { HistoryViewer } from './components/HistoryViewer';
import { etpSections, trSections } from './config/sections';
import { etpTemplates, trTemplates } from './config/templates';

declare const mammoth: any;

// --- Helper Functions ---
const stripHtml = (html: string | null | undefined): string => {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || "";
};


// --- Notification Component ---
interface NotificationProps {
  notification: NotificationType;
  onClose: (id: number) => void;
}

const Notification: React.FC<NotificationProps> = ({ notification, onClose }) => {
  const { id, title, text, type } = notification;
  const [isExiting, setIsExiting] = useState(false);

  const handleClose = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => onClose(id), 300); // Wait for animation to finish
  }, [id, onClose]);

  useEffect(() => {
    const timer = setTimeout(() => {
      handleClose();
    }, 5000); // Auto-close after 5 seconds

    return () => clearTimeout(timer);
  }, [id, handleClose]);

  const typeClasses = useMemo(() => ({
    success: {
      bg: 'bg-green-50',
      border: 'border-green-400',
      iconColor: 'text-green-500',
      iconName: 'check-circle',
    },
    error: {
      bg: 'bg-red-50',
      border: 'border-red-400',
      iconColor: 'text-red-500',
      iconName: 'exclamation-triangle',
    },
    info: {
      bg: 'bg-blue-50',
      border: 'border-blue-400',
      iconColor: 'text-blue-500',
      iconName: 'info-circle',
    },
  }), []);

  const classes = typeClasses[type];

  return (
    <div
      className={`relative w-full max-w-sm p-4 mb-4 rounded-lg shadow-xl border-l-4 overflow-hidden
        ${classes.bg} ${classes.border} ${isExiting ? 'animate-slide-out-right' : 'animate-slide-in-right'}`}
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
    >
      <div className="flex items-start">
        <div className="flex-shrink-0 pt-0.5">
          <Icon name={classes.iconName} className={`text-xl ${classes.iconColor}`} />
        </div>
        <div className="ml-3 flex-1">
          <p className="text-sm font-bold text-slate-800">{title}</p>
          <p className="mt-1 text-sm text-slate-600 break-words">{text}</p>
        </div>
        <div className="ml-4 flex-shrink-0 flex">
          <button
            onClick={handleClose}
            className="inline-flex text-slate-400 hover:text-slate-600 transition-colors p-1 -mr-1 -mt-1 rounded-full focus:outline-none focus:ring-2 focus:ring-slate-400"
            aria-label="Fechar"
          >
            <Icon name="times" className="text-lg" />
          </button>
        </div>
      </div>
    </div>
  );
};


// --- Content Renderer ---
const ContentRenderer: React.FC<{ htmlContent: string | null; className?: string }> = ({ htmlContent, className }) => {
    if (!htmlContent) return null;

    return (
      <div className={`relative p-5 rounded-lg border bg-white shadow-sm ${className || ''}`}>
        <div className="absolute -top-2 -left-2 bg-pink-100 text-pink-700 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
          <Icon name="brain" className="text-sm" />
          <span>TR GENIUS</span>
        </div>
        <div className="pt-4 prose" dangerouslySetInnerHTML={{ __html: htmlContent }} />
      </div>
    );
};

// --- Rich Text Editor Component ---
interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({ value, onChange, placeholder, disabled }) => {
  const editorRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (editorRef.current && value !== editorRef.current.innerHTML) {
      editorRef.current.innerHTML = value || '';
    }
  }, [value]);

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    onChange(e.currentTarget.innerHTML);
  };
  
  const execCmd = (command: string, value: string | null = null) => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      editorRef.current.focus();
      onChange(editorRef.current.innerHTML);
    }
    forceUpdate(); // Force re-render to update button states
  };
  
  const handleCreateLink = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.toString().trim().length === 0) {
      alert("Por favor, selecione o texto que pretende transformar num link.");
      return;
    }
    const url = prompt("Introduza o URL:", "https://");
    if (url) {
      execCmd('createLink', url);
    }
  };
  
  const [updateKey, setUpdateKey] = useState(0);
  const forceUpdate = () => setUpdateKey(k => k + 1);

  const getCommandState = (command: string) => {
    if (typeof document !== 'undefined') {
      return document.queryCommandState(command);
    }
    return false;
  };

  return (
    <div className="border border-slate-300 rounded-lg focus-within:ring-2 focus-within:ring-blue-500 bg-white">
      {!disabled && (
        <div className="toolbar flex items-center gap-1 p-2 border-b border-slate-200 flex-wrap bg-slate-50" onMouseDown={(e) => e.preventDefault()}>
          <button type="button" onClick={() => execCmd('bold')} className={`w-8 h-8 rounded transition-colors ${getCommandState('bold') ? 'bg-blue-200 text-blue-800' : 'text-slate-700 hover:bg-slate-200'}`} title="Negrito"><Icon name="bold" /></button>
          <button type="button" onClick={() => execCmd('italic')} className={`w-8 h-8 rounded transition-colors ${getCommandState('italic') ? 'bg-blue-200 text-blue-800' : 'text-slate-700 hover:bg-slate-200'}`} title="Itálico"><Icon name="italic" /></button>
          <button type="button" onClick={() => execCmd('insertUnorderedList')} className={`w-8 h-8 rounded transition-colors ${getCommandState('insertUnorderedList') ? 'bg-blue-200 text-blue-800' : 'text-slate-700 hover:bg-slate-200'}`} title="Lista com Marcadores"><Icon name="list-ul" /></button>
          <button type="button" onClick={() => execCmd('insertOrderedList')} className={`w-8 h-8 rounded transition-colors ${getCommandState('insertOrderedList') ? 'bg-blue-200 text-blue-800' : 'text-slate-700 hover:bg-slate-200'}`} title="Lista Numerada"><Icon name="list-ol" /></button>
          <button type="button" onClick={handleCreateLink} className="w-8 h-8 rounded text-slate-700 hover:bg-slate-200 transition-colors" title="Inserir Link"><Icon name="link" /></button>
        </div>
      )}
      <div
        key={updateKey}
        ref={editorRef}
        contentEditable={!disabled}
        onInput={handleInput}
        onKeyUp={forceUpdate}
        onMouseUp={forceUpdate}
        className={`rich-text-editor w-full h-40 p-3 bg-slate-50 focus:outline-none overflow-y-auto ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        data-placeholder={placeholder}
        dangerouslySetInnerHTML={{ __html: value || ''}}
       />
       <style>{`
        .rich-text-editor:empty:not(:focus):before {
          content: attr(data-placeholder);
          color: #94a3b8; /* slate-400 */
          pointer-events: none;
          display: block;
        }
        .rich-text-editor ul, .rich-text-editor ol {
          padding-left: 24px;
          margin: 8px 0;
        }
        .rich-text-editor ul { list-style-type: disc; }
        .rich-text-editor ol { list-style-type: decimal; }
        .rich-text-editor a { color: #2563eb; text-decoration: underline; }
       `}</style>
    </div>
  );
};


const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer as ArrayBuffer;
};

const base64ToUtf8 = (base64: string): string => {
    try {
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return new TextDecoder('utf-8').decode(bytes);
    } catch(e) {
        console.error("Failed to decode base64 string:", e);
        return "Erro ao descodificar o conteúdo do ficheiro. Pode estar corrompido ou numa codificação não suportada.";
    }
};

const priorityLabels: Record<Priority, string> = {
  high: 'Alta',
  medium: 'Média',
  low: 'Baixa',
};

const etpTemplateColors = [
  "bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-800",
  "bg-teal-50 hover:bg-teal-100 border-teal-200 text-teal-800",
  "bg-sky-50 hover:bg-sky-100 border-sky-200 text-sky-800",
  "bg-indigo-50 hover:bg-indigo-100 border-indigo-200 text-indigo-800",
  "bg-cyan-50 hover:bg-cyan-100 border-cyan-200 text-cyan-800",
  "bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-800",
];

const trTemplateColors = [
  "bg-purple-50 hover:bg-purple-100 border-purple-200 text-purple-800",
  "bg-fuchsia-50 hover:bg-fuchsia-100 border-fuchsia-200 text-fuchsia-800",
  "bg-pink-50 hover:bg-pink-100 border-pink-200 text-pink-800",
  "bg-violet-50 hover:bg-violet-100 border-violet-200 text-violet-800",
  "bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-800",
  "bg-red-50 hover:bg-red-100 border-red-200 text-red-800",
];


// --- Reusable Section Component ---
interface SectionProps {
  id: string;
  title: string;
  placeholder: string;
  value: string;
  onChange: (id: string, value: string) => void;
  onGenerate: () => void;
  hasGen: boolean;
  onAnalyze?: () => void;
  hasRiskAnalysis?: boolean;
  onRefine?: () => void;
  isLoading?: boolean;
  hasError?: boolean;
  tooltip?: string;
}

const Section: React.FC<SectionProps> = ({ id, title, placeholder, value, onChange, onGenerate, hasGen, onAnalyze, hasRiskAnalysis, onRefine, isLoading, hasError, tooltip }) => {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = () => {
    if (!value || !navigator.clipboard) return;
    navigator.clipboard.writeText(stripHtml(value)).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };
  
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm mb-6 transition-all hover:shadow-md">
      <div className="flex justify-between items-center mb-4 flex-wrap gap-y-3">
        <div className="flex items-center gap-2">
            <label htmlFor={id} className={`block text-lg font-semibold ${hasError ? 'text-red-600' : 'text-slate-700'}`}>{title}</label>
            {tooltip && <Icon name="question-circle" className="text-slate-400 cursor-help" title={tooltip} />}
        </div>
        <div className="w-full sm:w-auto flex items-stretch gap-2 flex-wrap">
           {value && stripHtml(value).trim().length > 0 && (
             <button
              onClick={handleCopy}
              className={`flex-1 flex items-center justify-center text-center px-3 py-2 text-xs font-semibold rounded-lg transition-colors min-w-[calc(50%-0.25rem)] sm:min-w-0 ${isCopied ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              title={isCopied ? 'Copiado para a área de transferência!' : 'Copiar Conteúdo'}
            >
              <Icon name={isCopied ? 'check' : 'copy'} className="mr-2" /> 
              <span>{isCopied ? 'Copiado!' : 'Copiar'}</span>
            </button>
           )}
           {value && stripHtml(value).trim().length > 0 && onRefine && (
             <button
              onClick={onRefine}
              className="flex-1 flex items-center justify-center text-center px-3 py-2 text-xs font-semibold text-green-700 bg-green-100 rounded-lg hover:bg-green-200 transition-colors min-w-[calc(50%-0.25rem)] sm:min-w-0"
              title="Refinar conteúdo com IA"
            >
              <Icon name="pencil-alt" className="mr-2" />
              <span>Refinar com IA</span>
            </button>
          )}
          {hasRiskAnalysis && onAnalyze && (
            <button
              onClick={onAnalyze}
              className="flex-1 flex items-center justify-center text-center px-3 py-2 text-xs font-semibold text-purple-700 bg-purple-100 rounded-lg hover:bg-purple-200 transition-colors min-w-[calc(50%-0.25rem)] sm:min-w-0"
              title="Análise de Riscos"
            >
              <Icon name="shield-alt" className="mr-2" />
              <span>Análise Risco</span>
            </button>
          )}
          {hasGen && (
            <button
              onClick={onGenerate}
              disabled={isLoading}
              className="flex-1 flex items-center justify-center text-center px-3 py-2 text-xs font-semibold text-blue-700 bg-blue-100 rounded-lg hover:bg-blue-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-w-[calc(50%-0.25rem)] sm:min-w-0"
            >
              <Icon name="wand-magic-sparkles" className="mr-2" />
              <span>{isLoading ? 'A gerar...' : 'Gerar com IA'}</span>
            </button>
          )}
        </div>
      </div>
      <div className="relative">
        <RichTextEditor
            value={value || ''}
            onChange={(html) => onChange(id, html)}
            placeholder={isLoading ? 'A IA está a gerar o conteúdo...' : placeholder}
            disabled={isLoading}
        />
        {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-50/70 rounded-lg pointer-events-none">
              <Icon name="spinner" className="fa-spin text-3xl text-blue-600" />
            </div>
        )}
      </div>
    </div>
  );
};

// --- Modal Component ---
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, footer, maxWidth = 'max-w-xl' }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className={`bg-white rounded-2xl shadow-2xl w-full ${maxWidth} flex flex-col max-h-[90vh] transition-all duration-300 transform scale-95 animate-scale-in`}>
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-800">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <Icon name="times" className="text-2xl" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto">
          {children}
        </div>
        {footer && (
          <div className="p-5 border-t border-gray-200 bg-slate-50 rounded-b-2xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

const PriorityIndicator: React.FC<{ priority?: Priority }> = ({ priority }) => {
    const priorityStyles: Record<Priority, { color: string; label: string }> = {
        low: { color: 'bg-green-500', label: 'Prioridade Baixa' },
        medium: { color: 'bg-yellow-500', label: 'Prioridade Média' },
        high: { color: 'bg-red-500', label: 'Prioridade Alta' },
    };

    if (!priority) return <div title="Prioridade não definida" className="w-3 h-3 rounded-full bg-slate-300 flex-shrink-0"></div>;

    return (
        <div
            title={priorityStyles[priority].label}
            className={`w-3 h-3 rounded-full ${priorityStyles[priority].color} flex-shrink-0`}
        ></div>
    );
};

const PrioritySelector: React.FC<{
  priority: Priority;
  setPriority: (p: Priority) => void;
}> = ({ priority, setPriority }) => {
  const priorities: { key: Priority; label: string; classes: string; icon: string }[] = [
    { key: 'low', label: 'Baixa', classes: 'border-green-500 hover:bg-green-100 text-green-700', icon: 'angle-down' },
    { key: 'medium', label: 'Média', classes: 'border-yellow-500 hover:bg-yellow-100 text-yellow-700', icon: 'equals' },
    { key: 'high', label: 'Alta', classes: 'border-red-500 hover:bg-red-100 text-red-700', icon: 'angle-up' },
  ];
  const activeClasses: Record<Priority, string> = {
    low: 'bg-green-500 text-white border-green-500',
    medium: 'bg-yellow-500 text-white border-yellow-500',
    high: 'bg-red-500 text-white border-red-500',
  };

  return (
    <div>
      <label className="block text-sm font-medium text-slate-600 mb-2">Prioridade</label>
      <div className="flex items-center gap-2">
        {priorities.map(p => (
          <button
            key={p.key}
            type="button"
            onClick={() => setPriority(p.key)}
            className={`flex-1 px-3 py-2 text-sm font-semibold rounded-lg border-2 transition-colors flex items-center justify-center gap-2 ${
              priority === p.key ? activeClasses[p.key] : `bg-white ${p.classes}`
            }`}
          >
            <Icon name={p.icon} />
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
};


// --- Main App Component ---
const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [activeView, setActiveView] = useState<DocumentType>('etp');
  
  // State for documents
  const [savedETPs, setSavedETPs] = useState<SavedDocument[]>([]);
  const [savedTRs, setSavedTRs] = useState<SavedDocument[]>([]);
  const [etpSectionsContent, setEtpSectionsContent] = useState<Record<string, string>>({});
  const [trSectionsContent, setTrSectionsContent] = useState<Record<string, string>>({});
  const [etpAttachments, setEtpAttachments] = useState<Attachment[]>([]);
  const [trAttachments, setTrAttachments] = useState<Attachment[]>([]);
  const [loadedEtpForTr, setLoadedEtpForTr] = useState<{ id: number; name: string; content: string } | null>(null);
  const [currentEtpPriority, setCurrentEtpPriority] = useState<Priority>('medium');
  const [currentTrPriority, setCurrentTrPriority] = useState<Priority>('medium');


  // State for API and files
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [processingFiles, setProcessingFiles] = useState<Array<{ name: string; status: 'processing' | 'success' | 'error'; message?: string }>>([]);
  const [useWebSearch, setUseWebSearch] = useState<boolean>(false);


  // UI State
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 768);
  const [openSidebarSections, setOpenSidebarSections] = useState({ etps: true, trs: true, knowledgeBase: true });
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [previewContext, setPreviewContext] = useState<PreviewContext>({ type: null, id: null });
  const [notifications, setNotifications] = useState<NotificationType[]>([]);
  const [analysisContent, setAnalysisContent] = useState<{ title: string; content: string | null }>({ title: '', content: null });
  const [loadingSection, setLoadingSection] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Set<string>>(new Set());
  const [viewingAttachment, setViewingAttachment] = useState<Attachment | null>(null);
  const [isNewDocModalOpen, setIsNewDocModalOpen] = useState(false);
  const [historyModalContent, setHistoryModalContent] = useState<SavedDocument | null>(null);
  const [installPrompt, setInstallPrompt] = useState<any>(null); // For PWA install prompt
  const [isInstallBannerVisible, setIsInstallBannerVisible] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [openDocMenu, setOpenDocMenu] = useState<{ type: DocumentType; id: number } | null>(null);
  
  // Refine Modal State
  const [isRefineModalOpen, setIsRefineModalOpen] = useState(false);
  const [refiningContent, setRefiningContent] = useState<{ docType: DocumentType; sectionId: string; title: string; text: string } | null>(null);
  const [refinePrompt, setRefinePrompt] = useState('');
  const [isRefining, setIsRefining] = useState(false);

  // Detailed Prompt Modal State
  const [isDetailedPromptModalOpen, setIsDetailedPromptModalOpen] = useState(false);
  const [detailedPromptContext, setDetailedPromptContext] = useState<{ docType: DocumentType; sectionId: string; title: string; } | null>(null);
  const [userDetailedPrompt, setUserDetailedPrompt] = useState('');


  // Compliance Checker State
  const [isComplianceModalOpen, setIsComplianceModalOpen] = useState(false);
  const [complianceCheckResult, setComplianceCheckResult] = useState<string>('');
  const [isCheckingCompliance, setIsCheckingCompliance] = useState<boolean>(false);

  // Inline rename state
  const [editingDoc, setEditingDoc] = useState<{ type: DocumentType; id: number; name: string; priority: Priority; } | null>(null);

  // Auto-save state
  const [autoSaveStatus, setAutoSaveStatus] = useState<string>('Salvo com sucesso');
  const debounceTimeoutRef = useRef<number | null>(null);
  const etpContentRef = useRef(etpSectionsContent);
  const trContentRef = useRef(trSectionsContent);

  // Filter and Sort state
  const [priorityFilter, setPriorityFilter] = useState<'all' | Priority>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'updatedAt' | 'name'>('updatedAt');
  
  // Summary state
  const [summaryState, setSummaryState] = useState<{ loading: boolean; content: string | null }>({ loading: false, content: null });
  
  // Preview State
  const [previewContent, setPreviewContent] = useState<{ type: 'html' | 'text'; content: string } | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isRagPreviewModalOpen, setIsRagPreviewModalOpen] = useState(false);

  // Generated Content Modal State
  const [generatedContentModal, setGeneratedContentModal] = useState<{
    docType: DocumentType;
    sectionId: string;
    title: string;
    content: string;
  } | null>(null);

  // Risk Analysis Refinement State
  const [isRefiningAnalysis, setIsRefiningAnalysis] = useState(false);
  const [refineAnalysisPrompt, setRefineAnalysisPrompt] = useState('');
  const [originalAnalysisForRefinement, setOriginalAnalysisForRefinement] = useState('');
  const [isAnalysisLoading, setIsAnalysisLoading] = useState(false);


  const priorityFilters: {
    key: 'all' | Priority;
    label: string;
    activeClasses: string;
    inactiveClasses: string;
  }[] = [
    { key: 'all', label: 'Todos', activeClasses: 'bg-white shadow-sm text-slate-800', inactiveClasses: 'text-slate-500 hover:bg-slate-200' },
    { key: 'high', label: 'Alta', activeClasses: 'bg-red-500 text-white shadow-sm', inactiveClasses: 'text-red-700 hover:bg-red-100' },
    { key: 'medium', label: 'Média', activeClasses: 'bg-yellow-500 text-white shadow-sm', inactiveClasses: 'text-yellow-700 hover:bg-yellow-100' },
    { key: 'low', label: 'Alta', activeClasses: 'bg-green-500 text-white shadow-sm', inactiveClasses: 'text-green-700 hover:bg-green-100' },
  ];


  // --- Handlers ---
  const removeNotification = useCallback((id: number) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const addNotification = useCallback((type: 'success' | 'error' | 'info', title: string, text: string) => {
      const newNotification = {
        id: Date.now(),
        title,
        text,
        type,
      };
      setNotifications(prev => [...prev, newNotification]);
  }, []);

  // --- Effects ---
  useEffect(() => {
    const loggedIn = sessionStorage.getItem('isAuthenticated') === 'true';
    if (loggedIn) {
        setIsAuthenticated(true);
    }
  }, []);

  // Effect to close dropdown menu on outside click
  useEffect(() => {
    const handleOutsideClick = () => {
      setOpenDocMenu(null);
    };

    if (openDocMenu) {
      document.addEventListener('click', handleOutsideClick);
    }

    return () => {
      document.removeEventListener('click', handleOutsideClick);
    };
  }, [openDocMenu]);


  useEffect(() => {
    if (!isAuthenticated) return;
    
    const loadInitialData = async () => {
        const etps = storage.getSavedETPs();
        setSavedETPs(etps);
        setSavedTRs(storage.getSavedTRs());

        const etpFormState = storage.loadFormState('etpFormState') as Record<string, string> || {};
        setEtpSectionsContent(etpFormState);

        // Find the last active ETP to load its attachments
        const lastActiveEtp = etps.find(etp => JSON.stringify(etp.sections) === JSON.stringify(etpFormState));
        if (lastActiveEtp) {
            setEtpAttachments(lastActiveEtp.attachments || []);
        }

        setTrSectionsContent(storage.loadFormState('trFormState') as Record<string, string> || {});
        
        const userFiles = storage.getStoredFiles();
        setUploadedFiles(userFiles);
    };

    loadInitialData();

    const handleResize = () => {
        if (window.innerWidth >= 768) {
            setIsSidebarOpen(true);
        } else {
            setIsSidebarOpen(false);
        }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isAuthenticated]);
  
  // PWA Install Prompt
  useEffect(() => {
    const handler = (e: Event) => {
        e.preventDefault();
        setInstallPrompt(e);
        if (!sessionStorage.getItem('pwaInstallDismissed')) {
            setIsInstallBannerVisible(true);
        }
    };
    window.addEventListener('beforeinstallprompt', handler);

    return () => {
        window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  // Online status listener
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
    };
}, []);

  // --- Auto-save Effects ---
  useEffect(() => {
      etpContentRef.current = etpSectionsContent;
  }, [etpSectionsContent]);

  useEffect(() => {
      trContentRef.current = trSectionsContent;
  }, [trSectionsContent]);
  
  // Debounced save on change
  useEffect(() => {
      if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);

      debounceTimeoutRef.current = window.setTimeout(() => {
          setAutoSaveStatus('Salvando...');
          storage.saveFormState('etpFormState', etpSectionsContent);
          storage.saveFormState('trFormState', trSectionsContent);
          setTimeout(() => setAutoSaveStatus('Salvo com sucesso'), 500);
      }, 2000); // 2 seconds after user stops typing

      return () => {
          if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
      };
  }, [etpSectionsContent, trSectionsContent]);

  // Periodic save every 30 seconds
  useEffect(() => {
      const interval = setInterval(() => {
          setAutoSaveStatus('Salvando...');
          // Use refs to get the latest state, avoiding stale closures
          storage.saveFormState('etpFormState', etpContentRef.current);
          storage.saveFormState('trFormState', trContentRef.current);
          setTimeout(() => setAutoSaveStatus('Salvo com sucesso'), 500);
      }, 30000);

      return () => clearInterval(interval);
  }, []); // Run only once
  
  // Attachment Preview Generator
  useEffect(() => {
    if (!viewingAttachment) {
        setPreviewContent(null);
        return;
    }

    const { type, content, name } = viewingAttachment;
    const lowerCaseName = name.toLowerCase();

    if (type === 'text/plain' || lowerCaseName.endsWith('.txt')) {
        setPreviewContent({ type: 'text', content: base64ToUtf8(content) });
    } else if (type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || lowerCaseName.endsWith('.docx')) {
        setIsLoadingPreview(true);
        setPreviewContent(null);
        try {
            const arrayBuffer = base64ToArrayBuffer(content);
            mammoth.convertToHtml({ arrayBuffer })
                .then((result: { value: string }) => {
                    setPreviewContent({ type: 'html', content: result.value });
                })
                .catch((err: any) => {
                    console.error("Error converting docx to html", err);
                    setPreviewContent({ type: 'html', content: '<p class="text-red-500 font-semibold p-4">Erro ao pré-visualizar o ficheiro DOCX.</p>' });
                })
                .finally(() => setIsLoadingPreview(false));
        } catch (err) {
            console.error("Error processing docx", err);
            setPreviewContent({ type: 'html', content: '<p class="text-red-500 font-semibold p-4">Erro ao processar o ficheiro .docx.</p>' });
            setIsLoadingPreview(false);
        }
    } else {
        // Reset for images, PDFs which are handled natively by object/img tags
        setPreviewContent(null); 
    }
  }, [viewingAttachment]);

  // --- Handlers ---
  const handleLogin = (success: boolean) => {
    if (success) {
        sessionStorage.setItem('isAuthenticated', 'true');
        setIsAuthenticated(true);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('isAuthenticated');
    setIsAuthenticated(false);
  };

  const handleSectionChange = (docType: DocumentType, id: string, value: string) => {
    if (validationErrors.has(id)) {
      setValidationErrors(prev => {
        const newErrors = new Set(prev);
        newErrors.delete(id);
        return newErrors;
      });
    }

    setAutoSaveStatus('A escrever...');
    const updateFn = docType === 'etp' ? setEtpSectionsContent : setTrSectionsContent;
    updateFn(prev => ({ ...prev, [id]: value }));
  };

  const getRagContext = useCallback(async (query: string): Promise<string> => {
    if (uploadedFiles.length === 0) return '';
    
    const selectedFiles = uploadedFiles.filter(f => f.selected);
    if (selectedFiles.length === 0) return '';

    addNotification('info', `A processar ${selectedFiles.length} ficheiro(s) para contexto...`, 'A IA está a selecionar as partes mais relevantes.');
    
    const allChunks = selectedFiles.flatMap(file => 
        file.chunks.map(chunk => ({
            content: chunk,
            source: file.name
        }))
    );

    if (allChunks.length === 0) {
      addNotification('info', 'Contexto Vazio', 'Os ficheiros selecionados não contêm texto para análise.');
      return '';
    }

    let relevantContent = '';

    // If there are few chunks, use them all directly to save an API call.
    if (allChunks.length <= 5) {
        relevantContent = allChunks
            .map(chunk => `Contexto do ficheiro "${chunk.source}":\n${chunk.content}`)
            .join('\n\n---\n\n');
    } else {
        // Use Gemini to select the most relevant chunks, truncating them to avoid overly large prompts.
        const selectionPrompt = `
        Analise a PERGUNTA do utilizador e a lista de TRECHOS de documentos fornecida abaixo.
        Sua tarefa é identificar e retornar APENAS os números dos trechos (ex: "1, 5, 8") que são mais cruciais e diretamente relevantes para responder à pergunta. Selecione no máximo os 5 trechos mais importantes.

        PERGUNTA: "${query}"

        --- INÍCIO DOS TRECHOS ---
        ${allChunks.map((chunk, index) => `[TRECHO ${index + 1} - Ficheiro: ${chunk.source}]:\n${chunk.content.substring(0, 1500)}...`).join('\n\n')}
        --- FIM DOS TRECHOS ---

        Números dos trechos mais relevantes (separados por vírgula):`;

        try {
            const selectionResult = await callGemini(selectionPrompt, false);

            if (selectionResult && !selectionResult.startsWith("Erro:")) {
                const selectedIndices = selectionResult
                    .split(',')
                    .map(n => parseInt(n.trim(), 10) - 1)
                    .filter(n => !isNaN(n) && n >= 0 && n < allChunks.length);
                
                if (selectedIndices.length > 0) {
                    relevantContent = selectedIndices
                        .map(index => {
                            const chunk = allChunks[index];
                            return `Contexto do ficheiro "${chunk.source}":\n${chunk.content}`;
                        })
                        .join('\n\n---\n\n');
                    addNotification('success', 'Contexto Otimizado', `${selectedIndices.length} trechos relevantes foram selecionados para a IA.`);
                } else {
                    // Fallback if Gemini doesn't return valid numbers
                    relevantContent = allChunks.slice(0, 3)
                        .map(chunk => `Contexto do ficheiro "${chunk.source}":\n${chunk.content}`)
                        .join('\n\n---\n\n');
                    addNotification('info', 'Contexto Padrão', 'Não foi possível selecionar trechos específicos. Usando um contexto geral.');
                }
            } else {
                 // Fallback on Gemini error
                 relevantContent = allChunks.slice(0, 3)
                    .map(chunk => `Contexto do ficheiro "${chunk.source}":\n${chunk.content}`)
                    .join('\n\n---\n\n');
                addNotification('error', 'Erro no RAG', 'Falha ao selecionar contexto. Usando um contexto geral.');
            }
        // FIX: Use unknown in catch and safely access error message.
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            relevantContent = allChunks.slice(0, 3)
                .map(chunk => `Contexto do ficheiro "${chunk.source}":\n${chunk.content}`)
                .join('\n\n---\n\n');
            addNotification('error', 'Erro no RAG', `Ocorreu um erro inesperado: ${message}`);
        }
    }

    if (!relevantContent.trim()) {
        return '';
    }
        
    return `\n\nAdicionalmente, utilize o conteúdo dos seguintes documentos de apoio (RAG) como base de conhecimento:\n\n--- INÍCIO DOS DOCUMENTOS DE APOIO ---\n${relevantContent}\n--- FIM DOS DOCUMENTOS DE APOIO ---`;
  }, [uploadedFiles, addNotification]);

  const webSearchInstruction = "\n\nAdicionalmente, para uma resposta mais completa e atualizada, realize uma pesquisa na web por informações relevantes, incluindo notícias, atualizações na Lei 14.133/21 e jurisprudências recentes sobre o tema.";

  const handleGenerate = async (docType: DocumentType, sectionId: string, title: string, userPrompt: string = '') => {
      const currentSections = docType === 'etp' ? etpSectionsContent : trSectionsContent;
      const allSections = docType === 'etp' ? etpSections : trSections;
      setLoadingSection(sectionId);

      let primaryContext = '';
      let secondaryContext = '';
      let prompt = '';

      if (docType === 'etp') {
          const primarySectionId = 'etp-2-necessidade';
          const necessidadeText = stripHtml(currentSections[primarySectionId]);

          if (sectionId !== primarySectionId && !necessidadeText.trim()) {
              addNotification('info', 'Atenção', `Por favor, preencha a seção "${etpSections.find(s => s.id === primarySectionId)?.title}" primeiro, pois ela serve de base para as outras.`);
              setValidationErrors(new Set([primarySectionId]));
              setLoadingSection(null);
              return;
          }

          primaryContext = `Contexto Principal (Necessidade da Contratação): ${necessidadeText}\n`;
          allSections.forEach(sec => {
              const content = stripHtml(currentSections[sec.id]);
              if (sec.id !== sectionId && sec.id !== primarySectionId && content.trim()) {
                  secondaryContext += `\nContexto Adicional (${sec.title}): ${content.trim()}\n`;
              }
          });

          const ragContext = await getRagContext(title);
          prompt = `Você é um especialista em planeamento de contratações públicas no Brasil. Sua tarefa é gerar o conteúdo para a seção "${title}" de um Estudo Técnico Preliminar (ETP).

Use o "Contexto Principal" como sua fonte primária de informação. Use o "Contexto Secundário" e os "Resumos de Apoio" para detalhes adicionais e complementares.

--- CONTEXTO PRINCIPAL ---
${primaryContext}
--- FIM DO CONTEXTO PRINCIPAL ---
${secondaryContext ? `\n--- CONTEXTO SECUNDÁRIO ---\n${secondaryContext}\n--- FIM DO CONTEXTO SECUNDÁRIO ---` : ''}
${ragContext}
${userPrompt ? `\nInstruções Adicionais do Utilizador: "${userPrompt}"\n` : ''}
Gere um texto detalhado e tecnicamente correto para a seção "${title}", utilizando a Lei 14.133/21 como referência principal. A resposta deve ser formatada em HTML, usando tags como <p>, <strong>, <em>, <ul> e <li> para uma apresentação clara e profissional.`;

      } else { // TR
          if (!loadedEtpForTr) {
              addNotification('info', 'Atenção', 'Por favor, carregue um ETP para usar como contexto antes de gerar o TR.');
              setLoadingSection(null);
              return;
          }

          const primarySectionId = 'tr-1-objeto';
          const objetoText = stripHtml(currentSections[primarySectionId]);
          if (sectionId !== primarySectionId && !objetoText.trim()) {
              addNotification('info', 'Atenção', `Por favor, preencha a seção "${trSections.find(s => s.id === primarySectionId)?.title}" primeiro, pois ela serve de base para as outras.`);
              setValidationErrors(new Set([primarySectionId]));
              setLoadingSection(null);
              return;
          }

          primaryContext = `--- INÍCIO DO ETP DE CONTEXTO ---\n${loadedEtpForTr.content}\n--- FIM DO ETP DE CONTEXTO ---\n\n--- OBJETO DO TR ---\n${objetoText}\n--- FIM DO OBJETO DO TR ---`;
          
          allSections.forEach(sec => {
              const content = stripHtml(currentSections[sec.id]);
              if (sec.id !== sectionId && sec.id !== primarySectionId && content.trim()) {
                  secondaryContext += `\nContexto Adicional do TR já preenchido (${sec.title}): ${content.trim()}\n`;
              }
          });

          const ragContext = await getRagContext(title);
          prompt = `Você é um especialista em licitações públicas no Brasil. Sua tarefa é gerar o conteúdo para a seção "${title}" de um Termo de Referência (TR).

Para isso, utilize as seguintes fontes de informação, em ordem de prioridade:
1. O Estudo Técnico Preliminar (ETP) e o Objeto do TR (Contexto Principal).
2. Os documentos de apoio (RAG) e as outras seções do TR já preenchidas (Contexto Secundário).

--- CONTEXTO PRINCIPAL ---
${primaryContext}
--- FIM DO CONTEXTO PRINCIPAL ---
${secondaryContext ? `\n--- CONTEXTO SECUNDÁRIO ---\n${secondaryContext}\n--- FIM DO CONTEXTO SECUNDÁRIO ---` : ''}
${ragContext}
${userPrompt ? `\nInstruções Adicionais do Utilizador: "${userPrompt}"\n` : ''}
Gere um texto detalhado e bem fundamentado para a seção "${title}" do TR, extraindo e inferindo as informações necessárias das fontes fornecidas. A resposta deve ser formatada em HTML, usando tags como <p>, <strong>, <em>, <ul> e <li> para uma apresentação clara e profissional.`;
      }
      
      const finalPrompt = prompt + (useWebSearch ? webSearchInstruction : '');

      try {
          const generatedText = await callGemini(finalPrompt, useWebSearch);
          if (generatedText && !generatedText.startsWith("Erro:")) {
              setGeneratedContentModal({ docType, sectionId, title, content: generatedText });
          } else {
              addNotification('error', 'Erro de Geração', generatedText);
          }
      } catch (error: unknown) {
          // FIX: Use unknown in catch and safely access error message.
          const message = error instanceof Error ? error.message : String(error);
          addNotification('error', 'Erro Inesperado', `Falha ao gerar texto: ${message}`);
      } finally {
          setLoadingSection(null);
      }
  };


  const handleOpenDetailedPromptModal = (docType: DocumentType, sectionId: string, title: string) => {
    setDetailedPromptContext({ docType, sectionId, title });
    setUserDetailedPrompt(''); // Reset prompt every time
    setIsDetailedPromptModalOpen(true);
  };
  
  const handleTriggerGeneration = () => {
    if (!detailedPromptContext) return;
    const { docType, sectionId, title } = detailedPromptContext;
    setIsDetailedPromptModalOpen(false);
    handleGenerate(docType, sectionId, title, userDetailedPrompt);
  };

  const handleComplianceCheck = async () => {
    setIsCheckingCompliance(true);
    setIsComplianceModalOpen(true);
    setComplianceCheckResult('A IA está a analisar o seu documento... Por favor, aguarde.');

    const trSectionsForAnalysis = trSections
        .map(section => {
            const content = stripHtml(trSectionsContent[section.id]);
            if (content.trim()) {
                const legalReference = section.tooltip?.match(/Conforme (Art\. [\s\S]+)/)?.[1]?.split('.')[0] || 'Não especificado';
                return `
---
**Seção: ${section.title}**
**Referência Legal:** ${legalReference}
**Conteúdo:**
${content}
---
`;
            }
            return null;
        })
        .filter(Boolean)
        .join('\n');

    if (!trSectionsForAnalysis.trim()) {
        setComplianceCheckResult('<p>O Termo de Referência está vazio. Por favor, preencha as seções antes de verificar a conformidade.</p>');
        setIsCheckingCompliance(false);
        return;
    }

    const lawExcerpts = `
    **Lei nº 14.133/2021 (Excertos Relevantes para Termo de Referência):**
    Art. 6º, XXIII: O TR deve conter: a) definição do objeto, quantitativos, prazo; b) fundamentação (referência ao ETP); c) descrição da solução (ciclo de vida); d) requisitos da contratação; e) modelo de execução; f) modelo de gestão; g) critérios de medição e pagamento; h) forma de seleção do fornecedor; i) estimativas de valor; j) adequação orçamentária.
    Art. 40, § 1º: O TR deve conter os elementos do Art. 6º, XXIII, e mais: I - especificação do produto/serviço (qualidade, rendimento, etc.); II - locais de entrega e regras para recebimento; III - garantia, manutenção e assistência técnica.
    `;

    const prompt = `
    Você é um auditor especialista em licitações e contratos públicos, com profundo conhecimento da Lei nº 14.133/2021. Sua tarefa é realizar uma análise de conformidade detalhada, seção por seção, de um Termo de Referência (TR).

    **Contexto Legal de Referência:**
    ${lawExcerpts}

    **Termo de Referência para Análise (Estruturado por Seção):**
    ${trSectionsForAnalysis}

    **Sua Tarefa:**
    Analise CADA seção do Termo de Referência fornecido, comparando o conteúdo da seção com a sua respectiva "Referência Legal" indicada.

    Elabore um relatório de conformidade detalhado em formato HTML. O relatório deve conter:

    1.  **Análise por Seção:** Para cada seção do TR, crie um subtítulo (ex: <h2>Análise da Seção: Objeto</h2>) e detalhe os seguintes pontos:
        *   <p><strong>Referência Legal:</strong> Repita o artigo da lei correspondente.</p>
        *   <p><strong>Análise:</strong> Comente de forma objetiva se o conteúdo da seção atende aos requisitos do artigo.</p>
        *   <p><strong>Status:</strong> Classifique a seção com um dos seguintes emojis e rótulos: "✅ <strong>Conforme</strong>", "⚠️ <strong>Ponto de Atenção</strong>" (se estiver incompleto ou ambíguo), ou "❌ <strong>Não Conforme</strong>" (se contradiz a lei ou omite informação crucial).</p>
        *   <p><strong>Recomendação:</strong> Se o status for de atenção ou não conforme, forneça uma sugestão clara e prática para ajustar o texto e adequá-lo à legislação.</p>

    2.  **Resumo Geral:** Ao final, adicione uma seção de resumo (ex: <h2>Resumo Geral</h2>) com:
        *   <h3>Pontos Fortes:</h3> <p>Um resumo dos principais pontos positivos do documento.</p>
        *   <h3>Principais Pontos a Melhorar:</h3> <p>Um resumo dos pontos mais críticos que precisam de ajuste em todo o documento.</p>

    Seja técnico, objetivo e didático. Use tags HTML como <p>, <strong>, <ul>, <li>, <h2> e <h3> para estruturar a sua resposta de forma clara.
    `;
    
    const finalPrompt = prompt + (useWebSearch ? webSearchInstruction : '');

    try {
        const result = await callGemini(finalPrompt, useWebSearch);
        setComplianceCheckResult(result);
    } catch (error: unknown) {
        // FIX: Use unknown in catch and safely access error message.
        const message = error instanceof Error ? error.message : String(error);
        setComplianceCheckResult(`<p>Erro ao verificar a conformidade: ${message}</p>`);
    } finally {
        setIsCheckingCompliance(false);
    }
};


  const validateForm = (docType: DocumentType, sections: Record<string, string>): string[] => {
    const errors: string[] = [];
    const errorFields = new Set<string>();

    const requiredFields: { [key in DocumentType]?: { id: string; name: string }[] } = {
        etp: [
            { id: 'etp-2-necessidade', name: '2. Descrição da Necessidade' },
        ],
        tr: [
            { id: 'tr-1-objeto', name: '1. Objeto' },
        ],
    };

    const fieldsToValidate = requiredFields[docType] || [];

    fieldsToValidate.forEach(field => {
        if (!sections[field.id] || stripHtml(sections[field.id]).trim() === '') {
            errors.push(`O campo "${field.name}" é obrigatório.`);
            errorFields.add(field.id);
        }
    });

    setValidationErrors(errorFields);
    return errors;
  };

  const handleSaveDocument = (docType: DocumentType) => {
    const sections = docType === 'etp' ? etpSectionsContent : trSectionsContent;
    
    const validationMessages = validateForm(docType, sections);
    if (validationMessages.length > 0) {
        addNotification(
            'error',
            "Campos Obrigatórios",
            `Por favor, preencha os seguintes campos antes de salvar:\n- ${validationMessages.join('\n- ')}`
        );
        return;
    }

    const name = `${docType.toUpperCase()} ${new Date().toLocaleString('pt-BR').replace(/[/:,]/g, '_')}`;
    const now = new Date().toISOString();
    
    if (docType === 'etp') {
      const newDoc: SavedDocument = {
        id: Date.now(),
        name,
        createdAt: now,
        updatedAt: now,
        sections: { ...sections },
        attachments: etpAttachments,
        history: [],
        priority: currentEtpPriority,
      };
      const updatedETPs = [...savedETPs, newDoc];
      setSavedETPs(updatedETPs);
      storage.saveETPs(updatedETPs);
      addNotification("success", "Sucesso", `ETP "${name}" guardado com sucesso!`);
    } else {
      const newDoc: SavedDocument = {
        id: Date.now(),
        name,
        createdAt: now,
        updatedAt: now,
        sections: { ...sections },
        attachments: trAttachments,
        history: [],
        priority: currentTrPriority,
      };
      const updatedTRs = [...savedTRs, newDoc];
      setSavedTRs(updatedTRs);
      storage.saveTRs(updatedTRs);
      addNotification("success", "Sucesso", `TR "${name}" guardado com sucesso!`);
    }
  };
  
  const handleLoadDocument = (docType: DocumentType, id: number) => {
    const docs = docType === 'etp' ? savedETPs : savedTRs;
    const docToLoad = docs.find(doc => doc.id === id);
    if (docToLoad) {
      if (docType === 'etp') {
        setEtpSectionsContent(docToLoad.sections);
        setEtpAttachments(docToLoad.attachments || []);
        setCurrentEtpPriority(docToLoad.priority || 'medium');
        storage.saveFormState('etpFormState', docToLoad.sections);
      } else {
        setTrSectionsContent(docToLoad.sections);
        setTrAttachments(docToLoad.attachments || []);
        setCurrentTrPriority(docToLoad.priority || 'medium');
        storage.saveFormState('trFormState', docToLoad.sections);
      }
      addNotification('success', 'Documento Carregado', `O ${docType.toUpperCase()} "${docToLoad.name}" foi carregado.`);
      setActiveView(docType);
      if (window.innerWidth < 768) setIsSidebarOpen(false);
    }
  };

  const handleDeleteDocument = (docType: DocumentType, id: number) => {
    if (docType === 'etp') {
      const updated = savedETPs.filter(doc => doc.id !== id);
      setSavedETPs(updated);
      storage.saveETPs(updated);
    } else {
      const updated = savedTRs.filter(doc => doc.id !== id);
      setSavedTRs(updated);
      storage.saveTRs(updated);
    }
    addNotification('success', 'Sucesso', `O documento foi apagado.`);
  };

  const handleStartEditing = (type: DocumentType, doc: SavedDocument) => {
    setEditingDoc({ type, id: doc.id, name: doc.name, priority: doc.priority || 'medium' });
  };

  const handleUpdateDocumentDetails = () => {
    if (!editingDoc) return;

    const { type, id, name, priority } = editingDoc;
    const newName = name.trim();
    if (!newName) {
        setEditingDoc(null); // Cancel edit if name is empty
        return;
    }

    const updateDocs = (docs: SavedDocument[]) => docs.map(doc =>
        doc.id === id ? { ...doc, name: newName, priority: priority } : doc
    );

    if (type === 'etp') {
        const updated = updateDocs(savedETPs);
        setSavedETPs(updated);
        storage.saveETPs(updated);
    } else { // type === 'tr'
        const updated = updateDocs(savedTRs);
        setSavedTRs(updated);
        storage.saveTRs(updated);
    }

    setEditingDoc(null);
  };

  const handleEditorBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    // When focus moves from an element inside the div to another element inside the same div,
    // relatedTarget will be one of the children.
    // If focus moves outside the div, relatedTarget will be null or an element outside the div.
    // `contains` will correctly handle both cases.
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      handleUpdateDocumentDetails();
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const fileList: File[] = Array.from(files);

    const filesToProcess = fileList.map(file => ({
      name: file.name,
      status: 'processing' as const,
      message: ''
    }));
    setProcessingFiles(filesToProcess);

    const successfullyProcessed: UploadedFile[] = [];
    const currentFileNames = uploadedFiles.map(f => f.name);

    for (const file of fileList) {
      try {
        const processedFile = await processSingleUploadedFile(file, [
          ...currentFileNames, 
          ...successfullyProcessed.map(f => f.name)
        ]);
        successfullyProcessed.push(processedFile);

        setProcessingFiles(prev =>
          prev.map(p => (p.name === file.name ? { ...p, status: 'success' } : p))
        );
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        setProcessingFiles(prev =>
          prev.map(p =>
            p.name === file.name ? { ...p, status: 'error', message: message } : p
          )
        );
      }
    }

    if (successfullyProcessed.length > 0) {
      const updatedFiles = [...uploadedFiles, ...successfullyProcessed];
      setUploadedFiles(updatedFiles);
      storage.saveStoredFiles(updatedFiles);
      addNotification('success', 'Sucesso', `${successfullyProcessed.length} ficheiro(s) carregado(s).`);
    }

    setTimeout(() => {
      setProcessingFiles([]);
    }, 5000);

    event.target.value = ''; // Reset input
  };
  
  const handleToggleFileSelection = (index: number) => {
    const updatedFiles = uploadedFiles.map((file, i) =>
      i === index ? { ...file, selected: !file.selected } : file
    );
    setUploadedFiles(updatedFiles);
    storage.saveStoredFiles(updatedFiles);
  };

  const handleDeleteFile = (index: number) => {
      const updatedFiles = uploadedFiles.filter((_, i) => i !== index);
      setUploadedFiles(updatedFiles);
      storage.saveStoredFiles(updatedFiles);
  };

  const handleToggleFileLock = (index: number) => {
    const file = uploadedFiles[index];
    const updatedFiles = uploadedFiles.map((f, i) =>
        i === index ? { ...f, isLocked: !(f.isLocked ?? false) } : f
    );
    setUploadedFiles(updatedFiles);
    storage.saveStoredFiles(updatedFiles);
    addNotification('info', 'Status do Ficheiro', `O ficheiro "${file.name}" foi ${!(file.isLocked ?? false) ? 'bloqueado' : 'desbloqueado'}.`);
  };

  const handlePreviewRagFile = (file: UploadedFile) => {
    if (!file.content || !file.type) {
      addNotification('info', 'Pré-visualização Indisponível', 'Este ficheiro foi carregado numa versão anterior e não tem conteúdo para pré-visualização. Por favor, remova-o e carregue-o novamente.');
      return;
    }
    const attachmentToPreview: Attachment = {
      name: file.name,
      type: file.type,
      content: file.content,
      size: 0, // not important for this preview
      description: 'Documento de Apoio (RAG)'
    };
    setViewingAttachment(attachmentToPreview);
    setIsRagPreviewModalOpen(true);
  };

  const handleLoadEtpForTr = (etpId: string) => {
    if (etpId === "") {
        setLoadedEtpForTr(null);
        return;
    }
    const etp = savedETPs.find(e => e.id === parseInt(etpId, 10));
    if (etp) {
        const content = etpSections
            .map(section => `## ${section.title}\n${stripHtml(etp.sections[section.id]) || 'Não preenchido.'}`)
            .join('\n\n');
        setLoadedEtpForTr({ id: etp.id, name: etp.name, content });
        addNotification('success', 'Contexto Carregado', `O ETP "${etp.name}" foi carregado com sucesso para o TR.`);
    }
  };

  const handleImportEtpAttachments = () => {
    if (!loadedEtpForTr) {
      addNotification('info', 'Aviso', 'Nenhum ETP carregado para importar anexos.');
      return;
    }
    const etp = savedETPs.find(e => e.id === loadedEtpForTr.id);
    if (etp && etp.attachments && etp.attachments.length > 0) {
      const newAttachments = etp.attachments.filter(
        att => !trAttachments.some(trAtt => trAtt.name === att.name)
      );
      if (newAttachments.length > 0) {
        setTrAttachments(prev => [...prev, ...newAttachments]);
        addNotification('success', 'Sucesso', `${newAttachments.length} anexo(s) importado(s) do ETP "${etp.name}".`);
      } else {
        addNotification('info', 'Informação', 'Todos os anexos do ETP já constam neste TR.');
      }
    } else {
      addNotification('info', 'Aviso', `O ETP "${loadedEtpForTr.name}" não possui anexos para importar.`);
    }
  };

  const handleRiskAnalysis = async (docType: DocumentType, sectionId: string, title: string) => {
    const currentSections = docType === 'etp' ? etpSectionsContent : trSectionsContent;
    const sectionContent = stripHtml(currentSections[sectionId]);

    if (!sectionContent.trim()) {
        addNotification('info', 'Aviso', `Por favor, preencha ou gere o conteúdo da seção "${title}" antes de realizar a análise de riscos.`);
        return;
    }

    setAnalysisContent({ title: `Analisando Riscos para: ${title}`, content: null });
    setIsAnalysisLoading(true);

    const attachments = docType === 'etp' ? etpAttachments : trAttachments;
    let attachmentContext = '';
    if (attachments && attachments.length > 0) {
        attachmentContext = `\n\n**Anexos para Contexto Adicional:**\nAlém das seções do documento, considere as informações dos seguintes ficheiros anexados (nome e descrição fornecida pelo utilizador):\n${attachments
            .map(att => `- **${att.name}**: ${att.description || 'Nenhuma descrição fornecida.'}`)
            .join('\n')}`;
    }
    
    const ragContext = await getRagContext(title);
    let primaryContext = '';
    
    if (docType === 'tr') {
        let etpContext = '';
        if (loadedEtpForTr) {
            etpContext = `--- INÍCIO DO ETP DE CONTEXTO ---\n${loadedEtpForTr.content}\n--- FIM DO ETP DE CONTEXTO ---\n\n`;
        }

        const trOtherSectionsContext = Object.entries(currentSections)
            .filter(([key, value]) => key !== sectionId && value && stripHtml(value).trim())
            .map(([key, value]) => `Contexto da Seção do TR (${trSections.find(s => s.id === key)?.title}):\n${stripHtml(value).trim()}`)
            .join('\n\n');
        
        primaryContext = `${etpContext}${trOtherSectionsContext}`;
        
    } else if (docType === 'etp') {
        primaryContext = Object.entries(currentSections)
            .filter(([key, value]) => key !== sectionId && value)
            .map(([key, value]) => `Contexto Adicional (${etpSections.find(s => s.id === key)?.title}): ${stripHtml(value).trim()}`)
            .join('\n');
    }

    const prompt = `Você é um especialista em gestão de riscos em contratações públicas no Brasil. Sua tarefa é realizar uma análise de risco detalhada sobre o conteúdo da seção "${title}" de um ${docType.toUpperCase()}.

Utilize o contexto geral do documento, os documentos de apoio (RAG) e os anexos listados para uma análise completa.

**Seção a ser analisada:**
${sectionContent}

**Contexto Adicional (Outras seções, ETP, anexos, etc.):**
${primaryContext}
${attachmentContext}
${ragContext}

**Sua Tarefa Detalhada:**
Analise o conteúdo da seção fornecida e elabore um relatório de riscos detalhado em formato HTML. O relatório deve seguir a estrutura abaixo para CADA risco identificado (identifique de 3 a 5 riscos principais):

<hr>
<h3>Risco [Nº]: [Nome do Risco]</h3>
<ul>
  <li><strong>Descrição:</strong> Detalhe o risco, explicando como ele pode se manifestar com base no conteúdo da seção e no contexto geral da contratação.</li>
  <li><strong>Causa Raiz:</strong> Aponte as possíveis causas ou gatilhos para a ocorrência deste risco.</li>
  <li><strong>Classificação:</strong>
    <ul>
      <li><strong>Probabilidade:</strong> (Baixa, Média, Alta)</li>
      <li><strong>Impacto:</strong> (Baixo, Médio, Alto) - Descreva brevemente o impacto financeiro, operacional ou legal caso o risco se concretize.</li>
    </ul>
  </li>
  <li><strong>Nível de Risco:</strong> (Baixo, Médio, Alto) - Com base na combinação de probabilidade e impacto.</li>
  <li><strong>Medidas de Mitigação:</strong> Proponha ações claras e práticas para reduzir a probabilidade ou o impacto do risco. Inclua sugestões de como o texto da seção poderia ser ajustado para mitigar o risco.</li>
  <li><strong>Responsável Sugerido:</strong> Indique quem deveria ser o responsável por monitorar e mitigar o risco (ex: Fiscal do Contrato, Gestor, Equipe Técnica).</li>
</ul>

Seja técnico, objetivo e use a estrutura HTML fornecida para garantir uma apresentação clara e organizada.`;
    
    const finalPrompt = prompt + (useWebSearch ? webSearchInstruction : '');

    try {
        const analysisResult = await callGemini(finalPrompt, useWebSearch);
        setAnalysisContent({ title: `Análise de Riscos: ${title}`, content: analysisResult });
        setOriginalAnalysisForRefinement(analysisResult); // Store original for refinement
    } catch (error: unknown) {
        // FIX: Use unknown in catch and safely access error message.
        const message = error instanceof Error ? error.message : String(error);
        setAnalysisContent({ title: `Análise de Riscos: ${title}`, content: `<p>Erro ao realizar análise: ${message}</p>` });
    } finally {
        setIsAnalysisLoading(false);
    }
  };

  const handleRefineAnalysis = async () => {
    if (!originalAnalysisForRefinement || !refineAnalysisPrompt) {
      addNotification('info', 'Aviso', 'Não há análise para refinar ou o prompt está vazio.');
      return;
    }
    
    setIsAnalysisLoading(true);
    setAnalysisContent(prev => ({ ...prev, content: null })); // Clear content to show loader

    const prompt = `Você é um assistente especialista em gestão de riscos. A seguir está uma análise de risco original em formato HTML:

--- ANÁLISE ORIGINAL ---
${originalAnalysisForRefinement}
--- FIM DA ANÁLISE ORIGINAL ---

Agora, refine esta análise com base na seguinte solicitação do utilizador: "${refineAnalysisPrompt}"

Retorne APENAS a análise refinada completa, mantendo o mesmo formato HTML original, mas incorporando as melhorias solicitadas. Não adicione comentários ou introduções como "Aqui está a análise refinada:".`;
    
    try {
      const refinedResult = await callGemini(prompt, useWebSearch);
      if (refinedResult && !refinedResult.startsWith("Erro:")) {
        setAnalysisContent(prev => ({ ...prev, content: refinedResult }));
        setOriginalAnalysisForRefinement(refinedResult); // Update the base for further refinements
      } else {
        addNotification("error", "Erro ao Refinar", refinedResult);
        setAnalysisContent(prev => ({ ...prev, content: originalAnalysisForRefinement })); // Restore original on error
      }
    } catch (error: unknown) {
        // FIX: Use unknown in catch and safely access error message.
        const message = error instanceof Error ? error.message : String(error);
        addNotification('error', 'Erro Inesperado', `Falha ao refinar a análise: ${message}`);
      setAnalysisContent(prev => ({ ...prev, content: originalAnalysisForRefinement }));
    } finally {
      setIsAnalysisLoading(false);
      setIsRefiningAnalysis(false);
      setRefineAnalysisPrompt('');
    }
  };

  const handleOpenRefineModal = (docType: DocumentType, sectionId: string, title: string) => {
    const content = (docType === 'etp' ? etpSectionsContent : trSectionsContent)[sectionId] || '';
    setRefiningContent({ docType, sectionId, title, text: content });
    setIsRefineModalOpen(true);
  };
  
  const closeRefineModal = () => {
    setIsRefineModalOpen(false);
    setRefiningContent(null);
    setRefinePrompt('');
    setIsRefining(false);
  };
  
  const handleRefineText = async () => {
    if (!refiningContent || !refinePrompt) return;
    setIsRefining(true);
    
    const prompt = `Você é um assistente de redação especializado em documentos públicos. O texto original está em HTML. Refine o texto a seguir com base na solicitação do usuário. Retorne APENAS o HTML refinado, sem introduções ou observações, mantendo a estrutura e formatação.

--- INÍCIO DO HTML ORIGINAL ---
${refiningContent.text}
--- FIM DO HTML ORIGINAL ---

Solicitação do usuário: "${refinePrompt}"

--- HTML REFINADO ---`;

    try {
      const refinedHtml = await callGemini(prompt, useWebSearch);
      if (refinedHtml && !refinedHtml.startsWith("Erro:")) {
        handleSectionChange(refiningContent.docType, refiningContent.sectionId, refinedHtml);
        addNotification('success', 'Sucesso', 'O texto foi refinado pela IA.');
        closeRefineModal();
      } else {
        addNotification("error", "Erro de Refinamento", refinedHtml);
      }
    } catch (error: unknown) {
        // FIX: Use unknown in catch and safely access error message.
        const message = error instanceof Error ? error.message : String(error);
        addNotification('error', 'Erro Inesperado', `Falha ao refinar o texto: ${message}`);
    } finally {
      setIsRefining(false);
    }
  };

  const handleExportToPDF = () => {
    if (!previewContext.type || previewContext.id === null) return;

    const { type, id } = previewContext;
    const docs = type === 'etp' ? savedETPs : savedTRs;
    const docToExport = docs.find(d => d.id === id);

    if (docToExport) {
        const allSections = type === 'etp' ? etpSections : trSections;
        exportDocumentToPDF(docToExport, allSections);
    } else {
        addNotification('error', 'Erro', 'Não foi possível encontrar o documento para exportar.');
    }
  };
  
  const handleClearForm = useCallback((docType: DocumentType) => () => {
    if (docType === 'etp') {
        setEtpSectionsContent({});
        setEtpAttachments([]);
        setCurrentEtpPriority('medium');
        storage.saveFormState('etpFormState', {});
    } else {
        setTrSectionsContent({});
        setTrAttachments([]);
        setCurrentTrPriority('medium');
        setLoadedEtpForTr(null);
        const etpSelector = document.getElementById('etp-selector') as HTMLSelectElement;
        if (etpSelector) etpSelector.value = "";
        storage.saveFormState('trFormState', {});
    }
    addNotification('info', 'Formulário Limpo', `O formulário do ${docType.toUpperCase()} foi limpo.`);
  }, [addNotification]);

  const getAttachmentDataUrl = (attachment: Attachment) => {
    return `data:${attachment.type};base64,${attachment.content}`;
  };
  
  const handleGenerateSummary = async () => {
      if (!previewContext.type || previewContext.id === null) return;

      const { type, id } = previewContext;
      const docs = type === 'etp' ? savedETPs : savedTRs;
      const doc = docs.find(d => d.id === id);

      if (!doc) {
        addNotification('error', 'Erro', 'Documento não encontrado para gerar o resumo.');
        return;
      }

      setSummaryState({ loading: true, content: null });

      const allSections = type === 'etp' ? etpSections : trSections;
      const documentText = allSections
        .map(section => {
          const content = stripHtml(doc.sections[section.id]);
          if (content.trim()) {
            return `### ${section.title}\n${content}`;
          }
          return null;
        })
        .filter(Boolean)
        .join('\n\n---\n\n');

      if (!documentText.trim()) {
        setSummaryState({ loading: false, content: '<p>O documento está vazio e não pode ser resumido.</p>' });
        return;
      }
      
      const ragContext = await getRagContext("Resumo Geral do Documento");

      const prompt = `Você é um assistente especializado em analisar documentos de licitações públicas. Sua tarefa é criar um resumo executivo do "Documento Principal" a seguir. Utilize os "Documentos de Apoio (RAG)" como contexto para entender melhor o tema.

      O resumo deve ser conciso, focar APENAS nas informações do "Documento Principal" e destacar os seguintes pontos em uma lista (<ul><li>...</li></ul>):
      1.  O objetivo principal da contratação.
      2.  Os elementos ou requisitos mais importantes.
      3.  A conclusão ou solução recomendada.

      Seja direto e claro. Retorne a resposta em formato HTML.

      --- INÍCIO DO DOCUMENTO PRINCIPAL ---
      ${documentText}
      --- FIM DO DOCUMENTO PRINCIPAL ---
      
      ${ragContext}

      --- RESUMO EXECUTIVO (EM HTML) ---`;
      
      const finalPrompt = prompt + (useWebSearch ? webSearchInstruction : '');

      try {
        const summary = await callGemini(finalPrompt, useWebSearch);
        if (summary && !summary.startsWith("Erro:")) {
          setSummaryState({ loading: false, content: summary });
        } else {
          setSummaryState({ loading: false, content: `<p>Erro ao gerar resumo: ${summary}</p>` });
        }
      } catch (error: unknown) {
        // FIX: Use unknown in catch and safely access error message.
        const message = error instanceof Error ? error.message : String(error);
        setSummaryState({ loading: false, content: `<p>Falha inesperada ao gerar resumo: ${message}</p>` });
      }
    };

  const renderPreviewContent = () => {
    if (!previewContext.type || previewContext.id === null) return null;
    const { type, id } = previewContext;
    const docs = type === 'etp' ? savedETPs : savedTRs;
    const doc = docs.find(d => d.id === id);
    if (!doc) return <p>Documento não encontrado.</p>;

    const allSections = type === 'etp' ? etpSections : trSections;

    return (
      <div>
        <div className="pb-4 border-b border-slate-200 mb-6">
            <div className="flex justify-between items-start flex-wrap gap-y-3">
              <div>
                  <h1 className="text-3xl font-extrabold text-slate-800 leading-tight">{doc.name}</h1>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500 mt-2">
                      <span><Icon name="calendar-plus" className="mr-1.5" /> Criado em: {new Date(doc.createdAt).toLocaleString('pt-BR')}</span>
                      {doc.updatedAt && doc.updatedAt !== doc.createdAt && (
                      <span><Icon name="calendar-check" className="mr-1.5" /> Última modif.: {new Date(doc.updatedAt).toLocaleString('pt-BR')}</span>
                      )}
                  </div>
              </div>
               <button
                  onClick={handleGenerateSummary}
                  disabled={summaryState.loading}
                  className="flex items-center gap-2 bg-purple-100 text-purple-700 font-bold py-2 px-4 rounded-lg hover:bg-purple-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                  <Icon name="wand-magic-sparkles" />
                  {summaryState.loading ? 'A resumir...' : 'Gerar Resumo com IA'}
               </button>
            </div>
             {(summaryState.loading || summaryState.content) && (
                <div className="mt-6">
                    <h3 className="font-bold text-slate-800 text-lg mb-2">Resumo Executivo</h3>
                    {summaryState.loading ? (
                        <div className="flex items-center gap-2 text-purple-700 p-4 bg-purple-50 rounded-lg">
                            <Icon name="spinner" className="fa-spin" />
                            <span>A IA está a processar o seu pedido...</span>
                        </div>
                    ) : (
                        <ContentRenderer htmlContent={summaryState.content} />
                    )}
                </div>
            )}
        </div>
        
        <div className="space-y-8">
          {allSections.map(section => {
            const content = doc.sections[section.id];
            if (content && stripHtml(content).trim()) {
              return (
                <div key={section.id}>
                  <h2 className="text-xl font-bold text-slate-700 mb-3">{section.title}</h2>
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="prose" dangerouslySetInnerHTML={{ __html: content }} />
                  </div>
                </div>
              );
            }
            return null;
          })}
        </div>

        {doc.attachments && doc.attachments.length > 0 && (
            <div className="mt-8">
                <h2 className="text-xl font-bold text-slate-700 mb-3">Anexos</h2>
                <div className="space-y-3">
                    {doc.attachments.map((att, index) => (
                        <div key={index} className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                          <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 truncate">
                                  <Icon name="file-alt" className="text-slate-500" />
                                  <span className="font-medium text-slate-800 truncate">{att.name}</span>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                  <button 
                                      onClick={() => viewingAttachment?.name === att.name ? setViewingAttachment(null) : setViewingAttachment(att)} 
                                      className="text-blue-600 hover:text-blue-800 font-semibold text-sm"
                                  >
                                      {viewingAttachment?.name === att.name ? 'Ocultar' : 'Visualizar'}
                                  </button>
                              </div>
                          </div>
                          {att.description && (
                              <div className="mt-2 pl-4 ml-6 border-l-2 border-slate-200">
                                <p className="text-sm text-slate-600 italic">"{att.description}"</p>
                              </div>
                          )}
                      </div>
                    ))}
                </div>
            </div>
        )}
        
        {viewingAttachment && (
            <div className="mt-6 pt-6 border-t border-slate-200">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-slate-800 truncate" title={viewingAttachment.name}>Visualizando: {viewingAttachment.name}</h3>
                    <button onClick={() => setViewingAttachment(null)} className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full">
                        <Icon name="times" className="text-xl" />
                    </button>
                </div>
                <div className="w-full h-[60vh] bg-slate-100 rounded-lg border flex items-center justify-center">
                    {isLoadingPreview ? (
                        <div className="flex flex-col items-center gap-2 text-slate-600">
                            <Icon name="spinner" className="fa-spin text-3xl" />
                            <span>A carregar pré-visualização...</span>
                        </div>
                    ) : previewContent ? (
                        <div className="w-full h-full bg-white overflow-auto rounded-lg">
                            {previewContent.type === 'text' ? (
                                <pre className="text-sm whitespace-pre-wrap font-mono bg-slate-50 p-6 h-full">{previewContent.content}</pre>
                            ) : (
                                <div className="p-2 sm:p-8 bg-slate-100 min-h-full">
                                    <div className="prose max-w-4xl mx-auto p-8 bg-white shadow-lg" dangerouslySetInnerHTML={{ __html: previewContent.content }} />
                                </div>
                            )}
                        </div>
                    ) : viewingAttachment.type.startsWith('image/') ? (
                        <img src={getAttachmentDataUrl(viewingAttachment)} alt={viewingAttachment.name} className="max-w-full max-h-full object-contain" />
                    ) : viewingAttachment.type === 'application/pdf' ? (
                        <object data={getAttachmentDataUrl(viewingAttachment)} type="application/pdf" width="100%" height="100%">
                            <p className="p-4 text-center text-slate-600">O seu navegador não suporta a pré-visualização de PDFs. <a href={getAttachmentDataUrl(viewingAttachment)} download={viewingAttachment.name} className="text-blue-600 hover:underline">Clique aqui para fazer o download.</a></p>
                        </object>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                            <Icon name="file-download" className="text-5xl text-slate-400 mb-4" />
                            <p className="text-slate-700 text-lg mb-2">A pré-visualização não está disponível para este tipo de ficheiro.</p>
                            <p className="text-slate-500 mb-6 text-sm">({viewingAttachment.type})</p>
                            <a 
                                href={getAttachmentDataUrl(viewingAttachment)} 
                                download={viewingAttachment.name}
                                className="inline-flex items-center gap-2 bg-blue-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                <Icon name="download" />
                                Fazer Download
                            </a>
                        </div>
                    )}
                </div>
            </div>
        )}
      </div>
    );
  };

  const switchView = useCallback((view: DocumentType) => {
    setActiveView(view);
    setValidationErrors(new Set());
  }, []);

  const toggleSidebarSection = (section: 'etps' | 'trs' | 'knowledgeBase') => {
    setOpenSidebarSections(prev => ({ ...prev, [section]: !prev[section] }));
  };
  
  const handleCreateNewDocument = useCallback((docType: DocumentType) => {
    setIsNewDocModalOpen(false);
    switchView(docType);
    handleClearForm(docType)();
    addNotification(
        'info',
        'Novo Documento',
        `Um novo formulário para ${docType.toUpperCase()} foi iniciado.`
    );
  }, [switchView, handleClearForm, addNotification]);

  const handleCreateFromTemplate = useCallback((template: Template) => {
      setIsNewDocModalOpen(false);
      switchView(template.type);
      if (template.type === 'etp') {
          setEtpSectionsContent(template.sections);
          setEtpAttachments([]);
          setCurrentEtpPriority('medium');
          storage.saveFormState('etpFormState', template.sections);
      } else {
          setTrSectionsContent(template.sections);
          setTrAttachments([]);
          setCurrentTrPriority('medium');
          setLoadedEtpForTr(null);
          const etpSelector = document.getElementById('etp-selector') as HTMLSelectElement;
          if (etpSelector) etpSelector.value = "";
          storage.saveFormState('trFormState', template.sections);
      }
      addNotification(
          'success',
          'Template Carregado',
          `Um novo documento foi iniciado usando o template "${template.name}".`
      );
  }, [switchView, addNotification]);

  const displayDocumentHistory = (doc: SavedDocument) => {
    setHistoryModalContent(doc);
  };
  
  const handleInstallClick = () => {
    if (!installPrompt) {
        return;
    }
    installPrompt.prompt();
    installPrompt.userChoice.then(({ outcome }: { outcome: 'accepted' | 'dismissed' }) => {
        if (outcome === 'accepted') {
            console.log('User accepted the install prompt');
        } else {
            console.log('User dismissed the install prompt');
        }
        setInstallPrompt(null);
        setIsInstallBannerVisible(false);
    });
  };

  const handleDismissInstallBanner = () => {
    sessionStorage.setItem('pwaInstallDismissed', 'true');
    setIsInstallBannerVisible(false);
  };

  const handleShare = async () => {
    const shareData = {
        title: 'TR Genius PWA',
        text: 'Conheça o TR Genius, seu assistente IA para licitações!',
        url: 'https://trgenius.netlify.app/'
    };

    if (navigator.share) {
        try {
            await navigator.share(shareData);
        } catch (error) {
            console.error('Erro ao partilhar:', error);
        }
    } else {
        // Fallback: Copy to clipboard
        try {
            await navigator.clipboard.writeText(shareData.url);
            addNotification("success", "Link Copiado", "O link da aplicação foi copiado para a sua área de transferência!");
        } catch (error) {
            console.error('Erro ao copiar o link:', error);
            addNotification("error", "Erro", "Não foi possível copiar o link. Por favor, copie manualmente: https://trgenius.netlify.app/");
        }
    }
  };

  const priorityFilteredDocs = useMemo(() => {
    const filterByPriority = (docs: SavedDocument[]) => {
      if (priorityFilter === 'all') {
        return docs;
      }
      return docs.filter(doc => doc.priority === priorityFilter);
    };
    return {
      etps: filterByPriority(savedETPs),
      trs: filterByPriority(savedTRs),
    };
  }, [savedETPs, savedTRs, priorityFilter]);

  const searchedDocs = useMemo(() => {
    const filterBySearch = (docs: SavedDocument[]) => {
      if (!searchTerm) {
        return docs;
      }
      const lowercasedSearchTerm = searchTerm.toLowerCase();
      return docs.filter(doc => doc.name.toLowerCase().includes(lowercasedSearchTerm));
    };
    return {
      etps: filterBySearch(priorityFilteredDocs.etps),
      trs: filterBySearch(priorityFilteredDocs.trs),
    };
  }, [priorityFilteredDocs, searchTerm]);

  const { displayedETPs, displayedTRs } = useMemo(() => {
    const sortDocs = (docs: SavedDocument[]) => {
      return [...docs].sort((a, b) => {
        if (sortOrder === 'name') {
          return a.name.localeCompare(b.name);
        }
        // Default sort by 'updatedAt' descending
        const dateA = new Date(a.updatedAt).getTime();
        const dateB = new Date(b.updatedAt).getTime();
        return dateB - dateA;
      });
    };
    
    return {
      displayedETPs: sortDocs(searchedDocs.etps),
      displayedTRs: sortDocs(searchedDocs.trs)
    };
  }, [searchedDocs, sortOrder]);
  
  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="bg-slate-50 min-h-screen text-slate-800 font-sans">
       <div className="flex flex-col md:flex-row h-screen">
          {/* Mobile Overlay */}
          {isSidebarOpen && (
            <div 
              className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-10 transition-opacity"
              onClick={() => setIsSidebarOpen(false)}
            ></div>
          )}
          
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="md:hidden fixed top-4 left-4 z-30 bg-blue-600 text-white w-10 h-10 rounded-full shadow-lg flex items-center justify-center">
            <Icon name={isSidebarOpen ? 'times' : 'bars'} />
          </button>
         
          <aside className={`fixed md:relative top-0 left-0 h-full w-full max-w-sm md:w-80 bg-white border-r border-slate-200 p-6 flex flex-col transition-transform duration-300 z-20 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
             <div className="flex items-center justify-between gap-3 mb-6 pt-10 md:pt-0">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-pink-100 rounded-lg flex items-center justify-center">
                        <Icon name="brain" className="text-pink-600 text-xl" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900">TR Genius</h1>
                </div>
                <button
                    onClick={handleShare}
                    className="w-9 h-9 flex items-center justify-center text-slate-400 rounded-full hover:bg-slate-100 hover:text-blue-600 transition-colors"
                    title="Partilhar Aplicação"
                >
                    <Icon name="share-nodes" />
                </button>
            </div>
            <p className="text-slate-500 text-sm mb-4 leading-relaxed">
                Seu assistente para criar Estudos Técnicos e Termos de Referência, em conformidade com a <b>Lei 14.133/21</b>.
            </p>
            
            <div className="flex-1 overflow-y-auto -mr-6 pr-6 space-y-1">
                <div className="py-2">
                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Busca Rápida</h3>
                    <div className="relative">
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Filtrar por nome..."
                            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-slate-50"
                            aria-label="Filtrar documentos por nome"
                        />
                        <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                </div>

                <div className="py-2">
                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Filtro de Prioridade</h3>
                    <div className="flex items-center justify-between bg-slate-100 rounded-lg p-1 gap-1">
                        {priorityFilters.map(filter => (
                            <button
                                key={filter.key}
                                onClick={() => setPriorityFilter(filter.key)}
                                className={`px-2 py-1 text-xs font-semibold rounded-md transition-all w-full ${
                                    priorityFilter === filter.key ? filter.activeClasses : filter.inactiveClasses
                                }`}
                            >
                                {filter.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="py-2">
                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Ordenar por</h3>
                    <div className="flex items-center justify-between bg-slate-100 rounded-lg p-1 gap-1">
                        <button
                            onClick={() => setSortOrder('updatedAt')}
                            className={`px-2 py-1 text-xs font-semibold rounded-md transition-all w-full flex items-center justify-center gap-1 ${
                                sortOrder === 'updatedAt' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:bg-slate-200'
                            }`}
                        >
                            <Icon name="history" /> Data Modif.
                        </button>
                        <button
                            onClick={() => setSortOrder('name')}
                            className={`px-2 py-1 text-xs font-semibold rounded-md transition-all w-full flex items-center justify-center gap-1 ${
                                sortOrder === 'name' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:bg-slate-200'
                            }`}
                        >
                           <Icon name="sort-alpha-down" /> Nome (A-Z)
                        </button>
                    </div>
                </div>

                {/* Accordion Section: ETPs */}
                <div className="py-1">
                  <button onClick={() => toggleSidebarSection('etps')} className="w-full flex justify-between items-center text-left p-2 rounded-lg hover:bg-blue-50 transition-colors">
                    <div className="flex items-center">
                        <Icon name="file-alt" className="text-blue-500 w-5 text-center" />
                        <h3 className="text-sm font-semibold text-blue-600 uppercase tracking-wider ml-2">ETPs Salvos</h3>
                    </div>
                    <Icon name={openSidebarSections.etps ? 'chevron-up' : 'chevron-down'} className="text-slate-400 transition-transform" />
                  </button>
                  <div className={`transition-all duration-500 ease-in-out overflow-hidden ${openSidebarSections.etps ? 'max-h-[1000px] opacity-100 mt-3' : 'max-h-0 opacity-0'}`}>
                    <div className="space-y-2">
                      {displayedETPs.length > 0 ? (
                        <ul className="space-y-2">
                          {displayedETPs.map(etp => (
                             <li key={etp.id} className="relative flex items-center justify-between bg-slate-50 p-2 rounded-lg">
                                {editingDoc?.type === 'etp' && editingDoc?.id === etp.id ? (
                                    <div className="w-full flex items-center gap-2" onBlur={handleEditorBlur}>
                                        <div className="flex-grow">
                                            <input
                                                type="text"
                                                value={editingDoc.name}
                                                onChange={(e) => setEditingDoc({ ...editingDoc, name: e.target.value })}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleUpdateDocumentDetails();
                                                    if (e.key === 'Escape') setEditingDoc(null);
                                                }}
                                                className="text-sm font-medium w-full bg-white border border-blue-500 rounded px-1 py-0.5"
                                                autoFocus
                                            />
                                            <select
                                                value={editingDoc.priority}
                                                onChange={(e) => setEditingDoc(prev => prev ? { ...prev, priority: e.target.value as Priority } : null)}
                                                className="w-full mt-1 p-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 bg-white"
                                            >
                                                <option value="high">{priorityLabels.high}</option>
                                                <option value="medium">{priorityLabels.medium}</option>
                                                <option value="low">{priorityLabels.low}</option>
                                            </select>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button onClick={handleUpdateDocumentDetails} className="w-6 h-6 text-green-600 hover:text-green-800" title="Salvar"><Icon name="check" /></button>
                                            <button onClick={() => setEditingDoc(null)} className="w-6 h-6 text-red-600 hover:text-red-800" title="Cancelar"><Icon name="times" /></button>
                                        </div>
                                    </div>
                                ) : (
                                  <div className="flex items-center justify-between w-full gap-4">
                                      {/* Name and Priority */}
                                      <div className="flex items-center gap-2 truncate flex-1 min-w-0">
                                          <PriorityIndicator priority={etp.priority} />
                                          <span className="text-sm font-medium text-slate-700 truncate" title={etp.name}>{etp.name}</span>
                                      </div>
                                      {/* Date */}
                                      <div className="text-xs text-slate-500 whitespace-nowrap flex-shrink-0" title={etp.updatedAt ? `Atualizado em: ${new Date(etp.updatedAt).toLocaleString('pt-BR')}` : ''}>
                                          {etp.updatedAt && (
                                            <span>
                                              {new Date(etp.updatedAt).toLocaleDateString('pt-BR', {day: '2-digit', month: 'short'})}
                                            </span>
                                          )}
                                      </div>
                                      {/* Actions */}
                                      <div className="flex-shrink-0">
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setOpenDocMenu(openDocMenu?.type === 'etp' && openDocMenu.id === etp.id ? null : { type: 'etp', id: etp.id });
                                            }} 
                                            className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-blue-600 rounded-full hover:bg-slate-200"
                                            title="Mais opções"
                                        >
                                            <Icon name="ellipsis-v" />
                                        </button>
                                        {openDocMenu?.type === 'etp' && openDocMenu?.id === etp.id && (
                                            <div 
                                                className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-slate-200 z-20 py-1"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <ul className="text-sm text-slate-700">
                                                    <li><button onClick={() => { handleStartEditing('etp', etp); setOpenDocMenu(null); }} className="w-full text-left px-4 py-2 hover:bg-slate-100 flex items-center gap-3"><Icon name="pencil-alt" className="w-4 text-center text-slate-500" /> Renomear</button></li>
                                                    <li><button onClick={() => { handleLoadDocument('etp', etp.id); setOpenDocMenu(null); }} className="w-full text-left px-4 py-2 hover:bg-slate-100 flex items-center gap-3"><Icon name="upload" className="w-4 text-center text-slate-500" /> Carregar</button></li>
                                                    <li><button onClick={() => { setPreviewContext({ type: 'etp', id: etp.id }); setIsPreviewModalOpen(true); setOpenDocMenu(null); }} className="w-full text-left px-4 py-2 hover:bg-slate-100 flex items-center gap-3"><Icon name="eye" className="w-4 text-center text-slate-500" /> Pré-visualizar</button></li>
                                                    <li><button onClick={() => { displayDocumentHistory(etp); setOpenDocMenu(null); }} className="w-full text-left px-4 py-2 hover:bg-slate-100 flex items-center gap-3"><Icon name="history" className="w-4 text-center text-slate-500" /> Ver Histórico</button></li>
                                                    <li className="my-1"><hr className="border-slate-100"/></li>
                                                    <li><button onClick={() => { handleDeleteDocument('etp', etp.id); setOpenDocMenu(null); }} className="w-full text-left px-4 py-2 hover:bg-slate-100 text-red-600 flex items-center gap-3"><Icon name="trash" className="w-4 text-center" /> Apagar</button></li>
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                  </div>
                                )}
                              </li>
                          ))}
                        </ul>
                      ) : <p className="text-sm text-slate-400 italic px-2">Nenhum ETP corresponde ao filtro.</p>}
                    </div>
                  </div>
                </div>

                {/* Accordion Section: TRs */}
                <div className="py-1">
                  <button onClick={() => toggleSidebarSection('trs')} className="w-full flex justify-between items-center text-left p-2 rounded-lg hover:bg-purple-50 transition-colors">
                    <div className="flex items-center">
                        <Icon name="gavel" className="text-purple-500 w-5 text-center" />
                        <h3 className="text-sm font-semibold text-purple-600 uppercase tracking-wider ml-2">TRs Salvos</h3>
                    </div>
                    <Icon name={openSidebarSections.trs ? 'chevron-up' : 'chevron-down'} className="text-slate-400 transition-transform" />
                  </button>
                   <div className={`transition-all duration-500 ease-in-out overflow-hidden ${openSidebarSections.trs ? 'max-h-[1000px] opacity-100 mt-3' : 'max-h-0 opacity-0'}`}>
                    <div className="space-y-2">
                      {displayedTRs.length > 0 ? (
                        <ul className="space-y-2">
                          {displayedTRs.map(tr => (
                             <li key={tr.id} className="relative flex items-center justify-between bg-slate-50 p-2 rounded-lg">
                                {editingDoc?.type === 'tr' && editingDoc?.id === tr.id ? (
                                    <div className="w-full flex items-center gap-2" onBlur={handleEditorBlur}>
                                        <div className="flex-grow">
                                            <input
                                                type="text"
                                                value={editingDoc.name}
                                                onChange={(e) => setEditingDoc({ ...editingDoc, name: e.target.value })}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleUpdateDocumentDetails();
                                                    if (e.key === 'Escape') setEditingDoc(null);
                                                }}
                                                className="text-sm font-medium w-full bg-white border border-blue-500 rounded px-1 py-0.5"
                                                autoFocus
                                            />
                                            <select
                                                value={editingDoc.priority}
                                                onChange={(e) => setEditingDoc(prev => prev ? { ...prev, priority: e.target.value as Priority } : null)}
                                                className="w-full mt-1 p-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 bg-white"
                                            >
                                                <option value="high">{priorityLabels.high}</option>
                                                <option value="medium">{priorityLabels.medium}</option>
                                                <option value="low">{priorityLabels.low}</option>
                                            </select>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button onClick={handleUpdateDocumentDetails} className="w-6 h-6 text-green-600 hover:text-green-800" title="Salvar"><Icon name="check" /></button>
                                            <button onClick={() => setEditingDoc(null)} className="w-6 h-6 text-red-600 hover:text-red-800" title="Cancelar"><Icon name="times" /></button>
                                        </div>
                                    </div>
                                ) : (
                                  <div className="flex items-center justify-between w-full gap-4">
                                      {/* Name and Priority */}
                                      <div className="flex items-center gap-2 truncate flex-1 min-w-0">
                                          <PriorityIndicator priority={tr.priority} />
                                          <span className="text-sm font-medium text-slate-700 truncate" title={tr.name}>{tr.name}</span>
                                      </div>
                                      {/* Date */}
                                      <div className="text-xs text-slate-500 whitespace-nowrap flex-shrink-0" title={tr.updatedAt ? `Atualizado em: ${new Date(tr.updatedAt).toLocaleString('pt-BR')}` : ''}>
                                          {tr.updatedAt && (
                                            <span>
                                              {new Date(tr.updatedAt).toLocaleDateString('pt-BR', {day: '2-digit', month: 'short'})}
                                            </span>
                                          )}
                                      </div>
                                      {/* Actions */}
                                      <div className="flex-shrink-0">
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setOpenDocMenu(openDocMenu?.type === 'tr' && openDocMenu.id === tr.id ? null : { type: 'tr', id: tr.id });
                                            }} 
                                            className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-blue-600 rounded-full hover:bg-slate-200"
                                            title="Mais opções"
                                        >
                                            <Icon name="ellipsis-v" />
                                        </button>
                                        {openDocMenu?.type === 'tr' && openDocMenu?.id === tr.id && (
                                            <div 
                                                className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-slate-200 z-20 py-1"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <ul className="text-sm text-slate-700">
                                                    <li><button onClick={() => { handleStartEditing('tr', tr); setOpenDocMenu(null); }} className="w-full text-left px-4 py-2 hover:bg-slate-100 flex items-center gap-3"><Icon name="pencil-alt" className="w-4 text-center text-slate-500" /> Renomear</button></li>
                                                    <li><button onClick={() => { handleLoadDocument('tr', tr.id); setOpenDocMenu(null); }} className="w-full text-left px-4 py-2 hover:bg-slate-100 flex items-center gap-3"><Icon name="upload" className="w-4 text-center text-slate-500" /> Carregar</button></li>
                                                    <li><button onClick={() => { setPreviewContext({ type: 'tr', id: tr.id }); setIsPreviewModalOpen(true); setOpenDocMenu(null); }} className="w-full text-left px-4 py-2 hover:bg-slate-100 flex items-center gap-3"><Icon name="eye" className="w-4 text-center text-slate-500" /> Pré-visualizar</button></li>
                                                    <li><button onClick={() => { displayDocumentHistory(tr); setOpenDocMenu(null); }} className="w-full text-left px-4 py-2 hover:bg-slate-100 flex items-center gap-3"><Icon name="history" className="w-4 text-center text-slate-500" /> Ver Histórico</button></li>
                                                    <li className="my-1"><hr className="border-slate-100"/></li>
                                                    <li><button onClick={() => { handleDeleteDocument('tr', tr.id); setOpenDocMenu(null); }} className="w-full text-left px-4 py-2 hover:bg-slate-100 text-red-600 flex items-center gap-3"><Icon name="trash" className="w-4 text-center" /> Apagar</button></li>
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                  </div>
                                )}
                              </li>
                          ))}
                        </ul>
                      ) : <p className="text-sm text-slate-400 italic px-2">Nenhum TR corresponde ao filtro.</p>}
                    </div>
                   </div>
                </div>
                
                {/* Accordion Section: Base de Conhecimento */}
                <div className="py-1 border-t mt-2 pt-3">
                    <button onClick={() => toggleSidebarSection('knowledgeBase')} className="w-full flex justify-between items-center text-left p-2 rounded-lg hover:bg-green-50 transition-colors">
                        <div className="flex items-center">
                            <Icon name="database" className="text-green-500 w-5 text-center" />
                            <h3 className="text-sm font-semibold text-green-600 uppercase tracking-wider ml-2">Base de Conhecimento</h3>
                        </div>
                        <Icon name={openSidebarSections.knowledgeBase ? 'chevron-up' : 'chevron-down'} className="text-slate-400 transition-transform" />
                    </button>
                    <div className={`transition-all duration-500 ease-in-out overflow-hidden ${openSidebarSections.knowledgeBase ? 'max-h-[1000px] opacity-100 mt-3' : 'max-h-0 opacity-0'}`}>
                        <div className="space-y-2">
                             {processingFiles.length > 0 && (
                                <div className="mb-3 p-2 bg-slate-100 rounded-lg">
                                    <h4 className="text-xs font-bold text-slate-600 mb-2">A processar ficheiros...</h4>
                                    <div className="w-full bg-slate-200 rounded-full h-1.5 mb-2">
                                        <div 
                                            className="bg-blue-600 h-1.5 rounded-full transition-all duration-500" 
                                            style={{ width: `${(processingFiles.filter(f => f.status !== 'processing').length / processingFiles.length) * 100}%` }}
                                        ></div>
                                    </div>
                                    <ul className="space-y-1">
                                        {processingFiles.map(file => (
                                            <li key={file.name} className="flex items-center text-xs justify-between">
                                                <div className="flex items-center truncate">
                                                    {file.status === 'processing' && <Icon name="spinner" className="fa-spin text-slate-400 w-4" />}
                                                    {file.status === 'success' && <Icon name="check-circle" className="text-green-500 w-4" />}
                                                    {file.status === 'error' && <Icon name="exclamation-circle" className="text-red-500 w-4" />}
                                                    <span className="ml-2 truncate flex-1">{file.name}</span>
                                                </div>
                                                {file.status === 'error' && <span className="ml-2 text-red-600 font-semibold flex-shrink-0">{file.message}</span>}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                             )}

                            {uploadedFiles.length === 0 && processingFiles.length === 0 && (
                                <p className="text-sm text-slate-400 italic px-2">Nenhum ficheiro carregado.</p>
                            )}
                            
                            {uploadedFiles.map((file, index) => (
                                <div key={index} className="flex items-center justify-between bg-slate-50 p-2 rounded-lg">
                                    <label className={`flex items-center gap-2 text-sm font-medium text-slate-700 truncate ${file.isLocked ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}>
                                        <input
                                            type="checkbox"
                                            checked={file.selected}
                                            onChange={() => handleToggleFileSelection(index)}
                                            className="form-checkbox h-4 w-4 text-blue-600 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                                            disabled={!!file.isLocked}
                                        />
                                        <span className="truncate">{file.name}</span>
                                    </label>
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                        <button onClick={() => handleToggleFileLock(index)} className="w-6 h-6 text-slate-500 hover:text-yellow-600" title={file.isLocked ? "Desbloquear Ficheiro" : "Bloquear Ficheiro"}>
                                            <Icon name={file.isLocked ? "lock" : "lock-open"} />
                                        </button>
                                        <button onClick={() => handlePreviewRagFile(file)} className="w-6 h-6 text-slate-500 hover:text-green-600" title="Pré-visualizar"><Icon name="eye" /></button>
                                        <button onClick={() => handleDeleteFile(index)} className="w-6 h-6 text-slate-500 hover:text-red-600" title="Apagar"><Icon name="trash" /></button>
                                    </div>
                                </div>
                            ))}
                            
                            <label className="mt-2 w-full flex items-center justify-center px-4 py-3 bg-blue-50 border-2 border-dashed border-blue-200 text-blue-600 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors">
                                <Icon name="upload" className="mr-2" />
                                <span className="text-sm font-semibold">Carregar ficheiros</span>
                                <input type="file" className="hidden" multiple onChange={handleFileUpload} accept=".pdf,.docx,.txt,.json,.md" />
                            </label>
                        </div>
                    </div>
                </div>
            </div>
            <div className="mt-auto pt-4 border-t border-slate-200 flex items-center gap-2">
                <button
                    onClick={() => setIsInfoModalOpen(true)}
                    className="flex-1 flex items-center justify-center gap-2 py-2 px-3 text-sm font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                    title="Informações"
                >
                    <Icon name="info-circle" />
                    Sobre
                </button>
                <button
                    onClick={handleLogout}
                    className="flex-1 flex items-center justify-center gap-2 py-2 px-3 text-sm font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-red-100 hover:text-red-700 transition-colors"
                >
                    <Icon name="sign-out-alt" />
                    Sair
                </button>
            </div>
          </aside>
          
          <main className="flex-1 p-4 pb-28 sm:p-6 md:p-10 overflow-y-auto bg-slate-100" onClick={() => { if(window.innerWidth < 768) setIsSidebarOpen(false) }}>
             <header className="flex flex-wrap justify-between items-center gap-4 mb-8">
                <div className="flex-grow">
                  <div className="border-b border-slate-200">
                    <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                      <button
                        onClick={() => switchView('etp')}
                        className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-lg transition-colors ${
                          activeView === 'etp'
                            ? 'border-blue-600 text-blue-600'
                            : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        Gerador de ETP
                      </button>
                      <button
                        onClick={() => switchView('tr')}
                        className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-lg transition-colors ${
                           activeView === 'tr'
                            ? 'border-blue-600 text-blue-600'
                            : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        Gerador de TR
                      </button>
                    </nav>
                  </div>
                </div>
                <div className="flex-shrink-0 ml-4 flex items-center gap-4">
                    <label htmlFor="web-search-toggle" className="flex items-center cursor-pointer gap-2 text-sm font-medium text-slate-600" title="Ativar para incluir resultados da web em tempo real nas respostas da IA.">
                        <Icon name="globe-americas" />
                        <span className="hidden sm:inline">Pesquisa Web</span>
                        <div className="relative">
                            <input id="web-search-toggle" type="checkbox" className="sr-only peer" checked={useWebSearch} onChange={() => setUseWebSearch(!useWebSearch)} />
                            <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </div>
                    </label>
                    {isOnline ? (
                        <div className="flex items-center justify-center w-8 h-8 md:w-auto md:px-2 md:py-1 md:gap-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full" title="A ligação à Internet está ativa.">
                            <Icon name="wifi" />
                            <span className="hidden md:inline">Online</span>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center w-8 h-8 md:w-auto md:px-2 md:py-1 md:gap-1 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded-full" title="Sem ligação à Internet. As funcionalidades online estão desativadas.">
                            <Icon name="wifi-slash" />
                            <span className="hidden md:inline">Offline</span>
                        </div>
                    )}
                </div>
            </header>
            
            <div className={`${activeView === 'etp' ? 'block' : 'hidden'}`}>
                <div className="bg-white p-6 rounded-xl shadow-sm mb-6 transition-all hover:shadow-md">
                    <h2 className="text-lg font-semibold text-slate-700 mb-4">Prioridade do Documento</h2>
                    <PrioritySelector priority={currentEtpPriority} setPriority={setCurrentEtpPriority} />
                </div>
                {etpSections.map(section => {
                  if (section.isAttachmentSection) {
                    return (
                        <div key={section.id} className="bg-white p-6 rounded-xl shadow-sm mb-6 transition-all hover:shadow-md">
                            <div className="flex justify-between items-center mb-3">
                                 <div className="flex items-center gap-2">
                                    <label className="block text-lg font-semibold text-slate-700">{section.title}</label>
                                    {section.tooltip && <Icon name="question-circle" className="text-slate-400 cursor-help" title={section.tooltip} />}
                                 </div>
                            </div>
                            <div className="mb-4">
                                <RichTextEditor
                                    value={etpSectionsContent[section.id] || ''}
                                    onChange={(html) => handleSectionChange('etp', section.id, html)}
                                    placeholder={section.placeholder}
                                />
                            </div>
                            <AttachmentManager
                                attachments={etpAttachments}
                                onAttachmentsChange={setEtpAttachments}
                                onPreview={setViewingAttachment}
                                addNotification={addNotification}
                            />
                        </div>
                    );
                  }
                  return (
                    <Section
                        key={section.id}
                        id={section.id}
                        title={section.title}
                        placeholder={section.placeholder}
                        value={etpSectionsContent[section.id]}
                        onChange={(id, value) => handleSectionChange('etp', id, value)}
                        onGenerate={() => handleOpenDetailedPromptModal('etp', section.id, section.title)}
                        hasGen={section.hasGen}
                        onAnalyze={() => handleRiskAnalysis('etp', section.id, section.title)}
                        hasRiskAnalysis={section.hasRiskAnalysis}
                        isLoading={loadingSection === section.id}
                        onRefine={() => handleOpenRefineModal('etp', section.id, section.title)}
                        hasError={validationErrors.has(section.id)}
                        tooltip={section.tooltip}
                    />
                  );
                })}
                <div className="fixed bottom-0 left-0 right-0 z-10 bg-white p-4 border-t border-slate-200 md:relative md:bg-transparent md:p-0 md:border-none md:mt-6" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
                    <div className="grid grid-cols-2 gap-3 md:flex md:items-center">
                        <span className="hidden md:block text-sm text-slate-500 italic mr-auto transition-colors">{autoSaveStatus}</span>
                        <button onClick={handleClearForm('etp')} className="bg-slate-200 text-slate-700 font-bold py-3 px-6 rounded-lg hover:bg-slate-300 transition-colors flex items-center justify-center gap-2">
                            <Icon name="eraser" /> Limpar Formulário
                        </button>
                        <button onClick={() => handleSaveDocument('etp')} className="bg-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors shadow-md flex items-center justify-center gap-2">
                            <Icon name="save" /> Salvar ETP
                        </button>
                    </div>
                </div>
            </div>

            <div className={`${activeView === 'tr' ? 'block' : 'hidden'}`}>
                <div className="bg-white p-6 rounded-xl shadow-sm mb-6">
                    <label htmlFor="etp-selector" className="block text-lg font-semibold text-slate-700 mb-3">Carregar ETP para Contexto</label>
                    <p className="text-sm text-slate-500 mb-4">Selecione um Estudo Técnico Preliminar (ETP) salvo para fornecer contexto à IA na geração do Termo de Referência (TR).</p>
                    <select
                        id="etp-selector"
                        onChange={(e) => handleLoadEtpForTr(e.target.value)}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                        defaultValue=""
                    >
                        <option value="">-- Selecione um ETP --</option>
                        {savedETPs.map(etp => (
                            <option key={etp.id} value={etp.id}>{etp.name}</option>
                        ))}
                    </select>
                    {loadedEtpForTr && (
                        <div className="mt-4 p-3 bg-green-50 text-green-800 border-l-4 border-green-500 rounded-r-lg">
                            <p className="font-semibold">ETP "{loadedEtpForTr.name}" carregado com sucesso.</p>
                        </div>
                    )}
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm mb-6 transition-all hover:shadow-md">
                    <h2 className="text-lg font-semibold text-slate-700 mb-4">Prioridade do Documento</h2>
                    <PrioritySelector priority={currentTrPriority} setPriority={setCurrentTrPriority} />
                </div>
                {trSections.map(section => {
                  if (section.isAttachmentSection) {
                    return (
                        <div key={section.id} className="bg-white p-6 rounded-xl shadow-sm mb-6 transition-all hover:shadow-md">
                            <div className="flex justify-between items-center mb-3 flex-wrap gap-y-3">
                                 <div className="flex items-center gap-2">
                                    <label className="block text-lg font-semibold text-slate-700">{section.title}</label>
                                    {section.tooltip && <Icon name="question-circle" className="text-slate-400 cursor-help" title={section.tooltip} />}
                                 </div>
                                 <button
                                    onClick={handleImportEtpAttachments}
                                    disabled={!loadedEtpForTr}
                                    className="px-3 py-2 text-xs font-semibold text-purple-700 bg-purple-100 rounded-lg hover:bg-purple-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Importar todos os anexos do ETP carregado"
                                 >
                                    <Icon name="file-import" className="mr-2" />
                                    Importar do ETP
                                 </button>
                            </div>
                             <div className="mb-4">
                                <RichTextEditor
                                    value={trSectionsContent[section.id] || ''}
                                    onChange={(html) => handleSectionChange('tr', section.id, html)}
                                    placeholder={section.placeholder}
                                />
                            </div>
                            <AttachmentManager
                                attachments={trAttachments}
                                onAttachmentsChange={setTrAttachments}
                                onPreview={setViewingAttachment}
                                addNotification={addNotification}
                            />
                        </div>
                    );
                  }
                  return (
                    <Section
                        key={section.id}
                        id={section.id}
                        title={section.title}
                        placeholder={section.placeholder}
                        value={trSectionsContent[section.id]}
                        onChange={(id, value) => handleSectionChange('tr', id, value)}
                        onGenerate={() => handleOpenDetailedPromptModal('tr', section.id, section.title)}
                        hasGen={section.hasGen}
                        isLoading={loadingSection === section.id}
                        onAnalyze={() => handleRiskAnalysis('tr', section.id, section.title)}
                        hasRiskAnalysis={section.hasRiskAnalysis}
                        onRefine={() => handleOpenRefineModal('tr', section.id, section.title)}
                        hasError={validationErrors.has(section.id)}
                        tooltip={section.tooltip}
                    />
                  );
                })}
                <div className="fixed bottom-0 left-0 right-0 z-10 bg-white p-4 border-t border-slate-200 md:relative md:bg-transparent md:p-0 md:border-none md:mt-6" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
                    <div className="grid grid-cols-3 gap-3 md:flex md:items-center">
                        <span className="hidden md:block text-sm text-slate-500 italic mr-auto transition-colors">{autoSaveStatus}</span>
                        <button onClick={handleClearForm('tr')} className="bg-slate-200 text-slate-700 font-bold py-3 px-6 rounded-lg hover:bg-slate-300 transition-colors flex items-center justify-center gap-2">
                            <Icon name="eraser" /> Limpar
                        </button>
                         <button 
                            onClick={handleComplianceCheck}
                            disabled={isCheckingCompliance}
                            className="bg-teal-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-teal-700 transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Icon name="check-double" /> {isCheckingCompliance ? 'A verificar...' : 'Verificar'}
                        </button>
                        <button onClick={() => handleSaveDocument('tr')} className="bg-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors shadow-md flex items-center justify-center gap-2">
                            <Icon name="save" /> Salvar TR
                        </button>
                    </div>
                </div>
            </div>

             <footer className="text-center mt-8 pt-6 border-t border-slate-200 text-slate-500 text-sm">
                <a href="https://wa.me/5584999780963" target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 transition-colors">
                    Desenvolvido por Danilo Arruda
                </a>
            </footer>
          </main>
      </div>

      <Modal isOpen={isInfoModalOpen} onClose={() => setIsInfoModalOpen(false)} title="Sobre o TR Genius" maxWidth="max-w-2xl">
          <div className="space-y-4 text-slate-600">
              <p>O <b>TR Genius</b> é o seu assistente inteligente para a elaboração de documentos de contratação pública, totalmente alinhado com a Nova Lei de Licitações e Contratos (Lei 14.133/21).</p>
                <ul className="list-none space-y-2">
                    <li className="flex items-start"><Icon name="wand-magic-sparkles" className="text-blue-500 mt-1 mr-3" /> <div><b>Geração de ETP e TR com IA:</b> Crie secções inteiras dos seus documentos com um clique, com base no contexto que fornecer.</div></li>
                    <li className="flex items-start"><Icon name="shield-alt" className="text-blue-500 mt-1 mr-3" /> <div><b>Análise de Riscos:</b> Identifique e mitigue potenciais problemas no seu projeto antes mesmo de ele começar.</div></li>
                    <li className="flex items-start"><Icon name="check-double" className="text-blue-500 mt-1 mr-3" /> <div><b>Verificador de Conformidade:</b> Garanta que os seus Termos de Referência estão em conformidade com a legislação vigente.</div></li>
                    <li className="flex items-start"><Icon name="file-alt" className="text-blue-500 mt-1 mr-3" /> <div><b>Contexto com Ficheiros:</b> Faça o upload de documentos para que a IA tenha um conhecimento ainda mais aprofundado sobre a sua necessidade específica.</div></li>
                </ul>
              <p>Esta ferramenta foi projetada para otimizar o seu tempo, aumentar a qualidade dos seus documentos e garantir a segurança jurídica das suas contratações.</p>
          </div>
      </Modal>

      <Modal 
        isOpen={isPreviewModalOpen} 
        onClose={() => {
          setIsPreviewModalOpen(false);
          setViewingAttachment(null);
          setSummaryState({ loading: false, content: null });
        }} 
        title="Pré-visualização do Documento" 
        maxWidth="max-w-3xl"
        footer={
          <div className="flex justify-end">
            <button
              onClick={handleExportToPDF}
              className="bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 transition-colors"
            >
              <Icon name="file-pdf" className="mr-2" /> Exportar para PDF
            </button>
          </div>
        }
      >
          {renderPreviewContent()}
      </Modal>
      
      <Modal isOpen={isRefineModalOpen} onClose={closeRefineModal} title={`Refinar: ${refiningContent?.title}`} maxWidth="max-w-xl">
        {refiningContent && (
            <div>
                <div className="bg-slate-100 p-4 rounded-lg">
                    <label htmlFor="refine-prompt" className="block text-sm font-semibold text-slate-700 mb-2">O que você gostaria de alterar ou adicionar ao texto?</label>
                    <div className="flex gap-2">
                        <input
                            id="refine-prompt"
                            type="text"
                            value={refinePrompt}
                            onChange={(e) => setRefinePrompt(e.target.value)}
                            placeholder="Ex: 'Torne o tom mais formal' ou 'Adicione um parágrafo...'"
                            className="flex-grow p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-purple-500"
                            disabled={isRefining}
                            onKeyDown={(e) => e.key === 'Enter' && handleRefineText()}
                        />
                        <button
                            onClick={handleRefineText}
                            disabled={!refinePrompt || isRefining}
                            className="bg-purple-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-purple-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                        >
                            {isRefining ? <Icon name="spinner" className="fa-spin" /> : <Icon name="wand-magic-sparkles" />}
                        </button>
                    </div>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                    <button onClick={closeRefineModal} className="bg-slate-200 text-slate-800 font-bold py-2 px-4 rounded-lg hover:bg-slate-300 transition-colors">
                        Fechar
                    </button>
                </div>
            </div>
        )}
    </Modal>
     <Modal 
      isOpen={isDetailedPromptModalOpen} 
      onClose={() => setIsDetailedPromptModalOpen(false)} 
      title={`Gerar conteúdo para: ${detailedPromptContext?.title}`}
      footer={
        <div className="flex justify-end gap-3">
          <button onClick={() => setIsDetailedPromptModalOpen(false)} className="bg-slate-200 text-slate-700 font-bold py-2 px-4 rounded-lg hover:bg-slate-300 transition-colors">
            Cancelar
          </button>
          <button 
            onClick={handleTriggerGeneration}
            className="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Icon name="wand-magic-sparkles" /> Gerar com IA
          </button>
        </div>
      }
    >
      <div>
        <label htmlFor="user-detailed-prompt" className="block text-sm font-medium text-slate-600 mb-2">
          Forneça instruções adicionais para a IA (opcional):
        </label>
        <textarea 
          id="user-detailed-prompt"
          value={userDetailedPrompt}
          onChange={(e) => setUserDetailedPrompt(e.target.value)}
          placeholder="Ex: 'Seja mais formal', 'Foque nos aspetos de sustentabilidade', 'Crie uma lista com 5 itens...'"
          className="w-full h-24 p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-xs text-slate-500 mt-2">Isto irá guiar a IA para gerar um texto mais alinhado com as suas expectativas.</p>
      </div>
    </Modal>

      <Modal 
        isOpen={!!analysisContent.title} 
        onClose={() => {
          setAnalysisContent({ title: '', content: null });
          setIsRefiningAnalysis(false);
          setRefineAnalysisPrompt('');
          setOriginalAnalysisForRefinement('');
        }} 
        title={analysisContent.title} 
        maxWidth="max-w-3xl"
        footer={
          <div className="flex flex-col gap-4">
            {isRefiningAnalysis && (
              <div className="bg-slate-200 p-4 rounded-lg">
                <label htmlFor="refine-analysis-prompt" className="block text-sm font-semibold text-slate-700 mb-2">
                  Peça à IA para refinar a análise acima:
                </label>
                <div className="flex gap-2">
                  <input
                    id="refine-analysis-prompt"
                    type="text"
                    value={refineAnalysisPrompt}
                    onChange={(e) => setRefineAnalysisPrompt(e.target.value)}
                    placeholder="Ex: 'Foque nos riscos financeiros' ou 'Sugira mais uma medida...'"
                    className="flex-grow p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-purple-500"
                    disabled={isAnalysisLoading}
                  />
                  <button
                    onClick={handleRefineAnalysis}
                    disabled={!refineAnalysisPrompt || isAnalysisLoading}
                    className="bg-purple-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-purple-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                  >
                    <Icon name="wand-magic-sparkles" />
                  </button>
                </div>
              </div>
            )}
            <div className="flex justify-end gap-3">
               <button onClick={() => {
                  if (analysisContent.content) {
                    navigator.clipboard.writeText(stripHtml(analysisContent.content))
                      .then(() => addNotification('success', 'Copiado!', 'A análise de risco foi copiada para a área de transferência.'));
                  }
                }}
                className="bg-blue-100 text-blue-800 font-bold py-2 px-4 rounded-lg hover:bg-blue-200 transition-colors mr-auto"
                disabled={isAnalysisLoading || !analysisContent.content}
              >
                <Icon name="copy" /> Copiar
              </button>
              <button 
                onClick={() => setIsRefiningAnalysis(!isRefiningAnalysis)}
                className="bg-slate-200 text-slate-800 font-bold py-2 px-4 rounded-lg hover:bg-slate-300 transition-colors"
                disabled={isAnalysisLoading}
              >
                {isRefiningAnalysis ? 'Cancelar Refinamento' : 'Refinar Análise'}
              </button>
            </div>
          </div>
        }
      >
          <div className="bg-slate-50 p-4 rounded-lg max-h-[60vh] overflow-y-auto min-h-[200px] flex items-center justify-center">
            {isAnalysisLoading ? (
               <div className="flex flex-col items-center gap-2 text-slate-600">
                  <Icon name="spinner" className="fa-spin text-3xl" />
                  <span>A IA está a processar a sua análise...</span>
              </div>
            ) : (
              <ContentRenderer htmlContent={analysisContent.content} />
            )}
          </div>
      </Modal>

      <Modal
        isOpen={isComplianceModalOpen}
        onClose={() => setIsComplianceModalOpen(false)}
        title="Relatório de Conformidade - Lei 14.133/21"
        maxWidth="max-w-3xl"
      >
        {isCheckingCompliance && !complianceCheckResult.startsWith("<p>Erro") ? (
          <div className="flex items-center justify-center flex-col gap-4 p-8">
              <Icon name="spinner" className="fa-spin text-4xl text-blue-600" />
              <p className="text-slate-600 font-semibold">A IA está a analisar o seu documento... Por favor, aguarde.</p>
          </div>
        ) : (
          <div className="p-4 bg-slate-50 rounded-lg max-h-[60vh] overflow-y-auto">
              <ContentRenderer htmlContent={complianceCheckResult} />
          </div>
        )}
        <div className="flex justify-end mt-4">
          <button onClick={() => setIsComplianceModalOpen(false)} className="bg-blue-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-blue-700 transition-colors">Fechar</button>
        </div>
      </Modal>

      <Modal 
        isOpen={!!historyModalContent} 
        onClose={() => setHistoryModalContent(null)} 
        title={`Histórico de: ${historyModalContent?.name}`}
        maxWidth="max-w-6xl"
      >
        {historyModalContent && <HistoryViewer document={historyModalContent} allSections={[...etpSections, ...trSections]} />}
      </Modal>

    <Modal isOpen={isNewDocModalOpen} onClose={() => setIsNewDocModalOpen(false)} title="Criar Novo Documento" maxWidth="max-w-4xl">
      <div className="space-y-4">
        <p className="text-slate-600 mb-6">Comece com um template pré-definido para agilizar o seu trabalho ou crie um documento em branco.</p>
        
        {/* ETP Templates */}
        <div className="mb-8">
            <h3 className="text-lg font-bold text-blue-800 mb-3 border-b-2 border-blue-200 pb-2">Estudo Técnico Preliminar (ETP)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <button 
                    onClick={() => handleCreateNewDocument('etp')}
                    className="w-full text-left p-4 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border-2 border-dashed border-slate-300 flex flex-col justify-between h-full"
                >
                    <div>
                        <div className="flex items-center gap-3">
                            <Icon name="file" className="text-slate-500 text-xl" />
                            <p className="font-bold text-slate-700">Documento em Branco</p>
                        </div>
                        <p className="text-sm text-slate-500 mt-2 pl-8">Comece um ETP do zero.</p>
                    </div>
                </button>
                {etpTemplates.map((template, index) => (
                    <button 
                        key={template.id}
                        onClick={() => handleCreateFromTemplate(template)}
                        className={`w-full text-left p-4 rounded-lg transition-colors border flex flex-col justify-between h-full ${etpTemplateColors[index % etpTemplateColors.length]}`}
                    >
                        <div>
                            <div className="flex items-center gap-3">
                                <Icon name="file-alt" className="text-current text-xl opacity-70" />
                                <p className="font-bold">{template.name}</p>
                            </div>
                            <p className="text-sm opacity-90 mt-2 pl-8">{template.description}</p>
                        </div>
                    </button>
                ))}
            </div>
        </div>

        {/* TR Templates */}
        <div>
            <h3 className="text-lg font-bold text-purple-800 mb-3 border-b-2 border-purple-200 pb-2">Termo de Referência (TR)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <button 
                    onClick={() => handleCreateNewDocument('tr')}
                    className="w-full text-left p-4 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border-2 border-dashed border-slate-300 flex flex-col justify-between h-full"
                >
                    <div>
                        <div className="flex items-center gap-3">
                            <Icon name="file" className="text-slate-500 text-xl" />
                            <p className="font-bold text-slate-700">Documento em Branco</p>
                        </div>
                        <p className="text-sm text-slate-500 mt-2 pl-8">Comece um TR do zero.</p>
                    </div>
                </button>
                {trTemplates.map((template, index) => (
                    <button 
                        key={template.id}
                        onClick={() => handleCreateFromTemplate(template)}
                        className={`w-full text-left p-4 rounded-lg transition-colors border flex flex-col justify-between h-full ${trTemplateColors[index % trTemplateColors.length]}`}
                    >
                        <div>
                            <div className="flex items-center gap-3">
                                <Icon name="gavel" className="text-current text-xl opacity-70" />
                                <p className="font-bold">{template.name}</p>
                            </div>
                            <p className="text-sm opacity-90 mt-2 pl-8">{template.description}</p>
                        </div>
                    </button>
                ))}
            </div>
        </div>
      </div>
    </Modal>
    
    <Modal 
      isOpen={isRagPreviewModalOpen} 
      onClose={() => {
        setIsRagPreviewModalOpen(false);
        setViewingAttachment(null);
      }} 
      title={`Pré-visualização: ${viewingAttachment?.name}`}
      maxWidth="max-w-4xl"
    >
      { viewingAttachment && (
        <div className="w-full h-[70vh] bg-slate-100 rounded-lg border flex items-center justify-center">
            {isLoadingPreview ? (
                <div className="flex flex-col items-center gap-2 text-slate-600">
                    <Icon name="spinner" className="fa-spin text-3xl" />
                    <span>A carregar pré-visualização...</span>
                </div>
            ) : previewContent ? (
                <div className="w-full h-full bg-white overflow-auto rounded-lg">
                    {previewContent.type === 'text' ? (
                        <pre className="text-sm whitespace-pre-wrap font-mono bg-slate-50 p-6 h-full">{previewContent.content}</pre>
                    ) : (
                        <div className="p-2 sm:p-8 bg-slate-100 min-h-full">
                            <div className="prose max-w-4xl mx-auto p-8 bg-white shadow-lg" dangerouslySetInnerHTML={{ __html: previewContent.content }} />
                        </div>
                    )}
                </div>
            ) : viewingAttachment.type.startsWith('image/') ? (
                <img src={getAttachmentDataUrl(viewingAttachment)} alt={viewingAttachment.name} className="max-w-full max-h-full object-contain" />
            ) : viewingAttachment.type === 'application/pdf' ? (
                <object data={getAttachmentDataUrl(viewingAttachment)} type="application/pdf" width="100%" height="100%">
                    <p className="p-4 text-center text-slate-600">O seu navegador não suporta a pré-visualização de PDFs. <a href={getAttachmentDataUrl(viewingAttachment)} download={viewingAttachment.name} className="text-blue-600 hover:underline">Clique aqui para fazer o download.</a></p>
                </object>
            ) : (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                    <Icon name="file-download" className="text-5xl text-slate-400 mb-4" />
                    <p className="text-slate-700 text-lg mb-2">A pré-visualização não está disponível para este tipo de ficheiro.</p>
                    <p className="text-slate-500 mb-6 text-sm">({viewingAttachment.type})</p>
                    <a 
                        href={getAttachmentDataUrl(viewingAttachment)} 
                        download={viewingAttachment.name}
                        className="inline-flex items-center gap-2 bg-blue-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        <Icon name="download" />
                        Fazer Download
                    </a>
                </div>
            )}
        </div>
      )}
    </Modal>
    
    <Modal
        isOpen={!!generatedContentModal}
        onClose={() => setGeneratedContentModal(null)}
        title={`Conteúdo Gerado por IA para: ${generatedContentModal?.title}`}
        maxWidth="max-w-3xl"
        footer={
          <div className="flex justify-end gap-3">
            <button onClick={() => setGeneratedContentModal(null)} className="bg-slate-200 text-slate-700 font-bold py-2 px-4 rounded-lg hover:bg-slate-300 transition-colors">
              Cancelar
            </button>
            <button
              onClick={() => {
                if (generatedContentModal) {
                  handleSectionChange(generatedContentModal.docType, generatedContentModal.sectionId, generatedContentModal.content);
                  setGeneratedContentModal(null);
                  addNotification('success', 'Sucesso', 'O conteúdo foi inserido na seção.');
                }
              }}
              className="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Icon name="check" className="mr-2" /> Usar este Texto
            </button>
          </div>
        }
      >
        <div className="bg-slate-50 p-4 rounded-lg max-h-[60vh] overflow-y-auto">
            {generatedContentModal && <ContentRenderer htmlContent={generatedContentModal.content} />}
        </div>
      </Modal>

    {installPrompt && !isInstallBannerVisible && (
        <button
            onClick={handleInstallClick}
            className="fixed bottom-44 right-8 bg-green-600 text-white w-12 h-12 rounded-full shadow-lg flex items-center justify-center text-xl hover:bg-green-700 transition-transform transform hover:scale-110 z-50"
            title="Instalar App"
          >
            <Icon name="download" />
        </button>
    )}
    <button
      onClick={() => setIsNewDocModalOpen(true)}
      className="fixed bottom-28 right-8 bg-pink-600 text-white w-12 h-12 rounded-full shadow-lg flex items-center justify-center text-2xl hover:bg-pink-700 transition-transform transform hover:scale-110 z-50"
      title="Criar Novo Documento"
    >
      <Icon name="plus" />
    </button>
    {installPrompt && isInstallBannerVisible && (
        <InstallPWA
            onInstall={handleInstallClick}
            onDismiss={handleDismissInstallBanner}
        />
    )}

    {/* Notifications Container */}
    <div className="fixed top-5 right-5 z-[100] w-full max-w-sm">
        {notifications.map((notification) => (
          <Notification
            key={notification.id}
            notification={notification}
            onClose={removeNotification}
          />
        ))}
    </div>
    </div>
  );
};

export default App;