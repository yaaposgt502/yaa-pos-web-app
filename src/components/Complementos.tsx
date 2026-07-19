import React, { useState, useRef } from 'react';
import { UserFile, AppConfig } from '../types';
import { 
  FileText, 
  Upload, 
  Trash2, 
  Eye, 
  Bot, 
  Sparkles, 
  Send, 
  FolderOpen, 
  Lock,
  AlertCircle,
  FileCode,
  Image,
  Loader2
} from 'lucide-react';

interface ComplementosProps {
  files: UserFile[];
  config: AppConfig;
  onUploadFile: (file: File) => Promise<UserFile>;
  onDeleteFile: (id: string) => Promise<{ success: boolean }>;
  onAskAI: (prompt: string) => Promise<{ reply: string }>;
  onRefreshData: () => void;
}

export default function Complementos({ files, config, onUploadFile, onDeleteFile, onAskAI, onRefreshData }: ComplementosProps) {
  const [activeSubTab, setActiveSubTab] = useState<'files' | 'ai'>('files');
  const [isUploading, setIsUploading] = useState(false);
  
  // Drag and drop states
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Chat states
  const [chatInput, setChatInput] = useState('');
  const [chatLog, setChatLog] = useState<Array<{ sender: 'user' | 'bot'; text: string }>>([
    { sender: 'bot', text: `¡Hola! Soy tu Asistente de IA para **Yaa POS**. Puedo ayudarte a analizar las ventas de hoy, alertarte sobre productos que están venciendo, sugerir reabastecimiento o darte consejos financieros basados en tu catálogo real. ¿Qué te gustaría consultar hoy?` }
  ]);
  const [aiLoading, setAiLoading] = useState(false);

  // Convert bytes to human-readable size
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Get file icon based on mime type
  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <Image className="w-8 h-8 text-blue-500" />;
    if (mimeType.includes('pdf')) return <FileText className="w-8 h-8 text-red-500" />;
    return <FileCode className="w-8 h-8 text-slate-500" />;
  };

  // Drag over handler
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  // Drag leave handler
  const handleDragLeave = () => {
    setIsDragging(false);
  };

  // Drop handler
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      await handleFileSubmit(droppedFile);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      await handleFileSubmit(selectedFile);
    }
  };

  const handleFileSubmit = async (file: File) => {
    setIsUploading(true);
    try {
      await onUploadFile(file);
      onRefreshData();
    } catch (err: any) {
      alert(err.message || 'Error al cargar el archivo');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteFile = async (id: string) => {
    if (confirm('¿Está seguro de eliminar este archivo? Se borrará permanentemente del servidor.')) {
      try {
        await onDeleteFile(id);
        onRefreshData();
      } catch (err: any) {
        alert(err.message || 'Error al eliminar el archivo');
      }
    }
  };

  // Ask AI
  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userPrompt = chatInput;
    setChatLog(prev => [...prev, { sender: 'user', text: userPrompt }]);
    setChatInput('');
    setAiLoading(true);

    try {
      const res = await onAskAI(userPrompt);
      setChatLog(prev => [...prev, { sender: 'bot', text: res.reply }]);
    } catch (err: any) {
      setChatLog(prev => [...prev, { sender: 'bot', text: `Ocurrió un error al contactar al asistente: ${err.message}` }]);
    } finally {
      setAiLoading(false);
    }
  };

  const quickQuestions = [
    "Analiza el stock crítico del inventario",
    "¿Cuáles productos están próximos a vencer?",
    "Bríndame 3 consejos para mejorar ganancias hoy",
  ];

  return (
    <div id="complements-view" className="space-y-6 animate-in fade-in duration-200">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Complementos de Negocio</h1>
          <p className="text-sm text-slate-500">Gestione archivos en la nube y utilice el Asistente de IA (Gemini).</p>
        </div>

        {/* Tab Selector */}
        <div className="flex bg-slate-100 rounded-xl p-1 shrink-0">
          <button
            onClick={() => setActiveSubTab('files')}
            className={`text-xs font-semibold px-4 py-2 rounded-lg flex items-center gap-1.5 transition-all ${
              activeSubTab === 'files' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <FolderOpen className="w-4 h-4" /> Almacenamiento de Archivos
          </button>
          <button
            onClick={() => setActiveSubTab('ai')}
            className={`text-xs font-semibold px-4 py-2 rounded-lg flex items-center gap-1.5 transition-all ${
              activeSubTab === 'ai' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Bot className="w-4 h-4 text-blue-600" /> Asistente de IA (Gemini)
          </button>
        </div>
      </div>

      {activeSubTab === 'files' ? (
        /* FILE MANAGER TAB */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Side: Drag and Drop Uploader (4 Columns) */}
          <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-100 shadow-xs p-5 space-y-4">
            <h2 className="font-semibold text-slate-800 text-sm">Subir Documentos</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Resguarde facturas, listas de precios de proveedores, imágenes de productos o PDFs útiles. Cada usuario solo puede ver sus propios archivos.
            </p>

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer flex flex-col items-center justify-center space-y-3 transition-all ${
                isDragging 
                  ? 'border-blue-500 bg-blue-50/20' 
                  : 'border-slate-200 hover:border-blue-400 hover:bg-slate-50/50'
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                className="hidden"
                accept=".jpg,.jpeg,.png,.pdf,.csv,.xlsx,.docx,.txt"
              />
              
              {isUploading ? (
                <>
                  <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                  <span className="text-xs font-bold text-slate-600">Subiendo archivo al servidor...</span>
                </>
              ) : (
                <>
                  <div className="p-3 bg-slate-100 text-slate-500 rounded-full">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-700">Arrastre archivos aquí o haga clic</p>
                    <p className="text-[10px] text-slate-400">PDF, JPG, PNG, CSV o Excel (Máx 15MB)</p>
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center gap-2 text-[10px] text-emerald-600 bg-emerald-50 p-2.5 rounded-lg font-medium">
              <Lock className="w-3.5 h-3.5 shrink-0" />
              <span>Cifrado y particionado de seguridad activo.</span>
            </div>
          </div>

          {/* Right Side: List of Uploaded Files (8 Columns) */}
          <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-100 shadow-xs p-5 space-y-4">
            <h2 className="font-semibold text-slate-800 text-sm">Mis Archivos Guardados ({files.length})</h2>

            {files.length === 0 ? (
              <div className="py-16 text-center flex flex-col items-center justify-center text-slate-400 space-y-2 border border-dashed border-slate-200 rounded-xl">
                <FolderOpen className="w-8 h-8 text-slate-300" />
                <p className="text-sm font-semibold">No tiene archivos subidos</p>
                <p className="text-xs">Utilice el panel izquierdo para resguardar su primer archivo.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {files.map((file) => (
                  <div key={file.id} className="border border-slate-100 bg-slate-50/50 p-3.5 rounded-xl flex items-start gap-3.5 justify-between">
                    <div className="flex gap-2.5 min-w-0">
                      <div className="shrink-0">{getFileIcon(file.mimeType)}</div>
                      <div className="min-w-0 space-y-0.5">
                        <h4 className="text-xs font-bold text-slate-800 truncate" title={file.name}>{file.name}</h4>
                        <p className="text-[10px] text-slate-400 font-mono">{formatBytes(file.size)}</p>
                        <p className="text-[9px] text-slate-400 font-mono">Cargado: {new Date(file.uploadedAt).toLocaleDateString()}</p>
                      </div>
                    </div>

                    <div className="flex gap-1 shrink-0">
                      {/* View secure URL */}
                      <a 
                        href={file.path} 
                        target="_blank" 
                        rel="noreferrer"
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-white rounded-md border border-transparent hover:border-slate-100 shadow-xs transition-all"
                        title="Ver / Descargar"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </a>
                      <button
                        onClick={() => handleDeleteFile(file.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-white rounded-md border border-transparent hover:border-slate-100 shadow-xs transition-all"
                        title="Eliminar"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* SMART GEMINI AI CHAT TAB */
        <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-6 flex flex-col h-[520px]">
          
          {/* Chat Window header */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4 shrink-0">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1">
                  Asistente Comercial Inteligente
                  <Sparkles className="w-4 h-4 text-amber-500 fill-amber-400 animate-pulse" />
                </h3>
                <p className="text-[10px] text-slate-400 font-medium">Analiza stock, vencimientos e ingresos en tiempo real</p>
              </div>
            </div>
            <div className="text-[10px] text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full font-bold flex items-center gap-1 font-mono">
              <Lock className="w-3 h-3" /> Datos Protegidos
            </div>
          </div>

          {/* Chat conversations scroll log */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-1 min-h-0 text-sm">
            {chatLog.map((msg, i) => (
              <div 
                key={i} 
                className={`flex gap-3 max-w-[85%] ${msg.sender === 'user' ? 'ml-auto flex-row-reverse' : ''}`}
              >
                <div className={`p-2.5 rounded-2xl leading-relaxed text-xs ${
                  msg.sender === 'user' 
                    ? 'bg-blue-600 text-white rounded-tr-none' 
                    : 'bg-slate-100 text-slate-800 rounded-tl-none border border-slate-150'
                }`}>
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                </div>
              </div>
            ))}

            {aiLoading && (
              <div className="flex gap-3 max-w-[80%]">
                <div className="bg-slate-50 border border-slate-100 p-2.5 rounded-2xl rounded-tl-none text-slate-500 text-xs flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  <span>Gemini está analizando tus registros financieros y de inventario...</span>
                </div>
              </div>
            )}
          </div>

          {/* Quick prompt recommendations */}
          {chatLog.length === 1 && !aiLoading && (
            <div className="pt-4 shrink-0 space-y-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Sugerencias Rápidas:</span>
              <div className="flex flex-wrap gap-2">
                {quickQuestions.map((q, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => { setChatInput(q); }}
                    className="text-[10px] bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 text-slate-600 hover:text-blue-700 px-2.5 py-1.5 rounded-lg font-medium transition-colors cursor-pointer"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Chat input box form */}
          <form onSubmit={handleSendChat} className="flex gap-3 border-t border-slate-100 pt-4 mt-4 shrink-0">
            <input
              type="text"
              placeholder="Pregúntale a Gemini sobre tus stock, vencimientos, gastos o ideas para vender más..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              className="flex-1 text-xs border border-slate-200 rounded-xl px-4 py-3 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              disabled={aiLoading}
              required
            />
            <button
              type="submit"
              disabled={aiLoading || !chatInput.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white p-3 rounded-xl transition-colors shrink-0 cursor-pointer disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
