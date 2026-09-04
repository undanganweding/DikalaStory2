import React, { useState, useEffect } from 'react';
import { ShieldCheck, Plus, Trash2, Play, CheckCircle2, AlertTriangle, Zap, Server, Edit3, X, Check } from 'lucide-react';

export const GeminiProjectManager: React.FC = () => {
  const [projects, setProjects] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editProjectId, setEditProjectId] = useState<string | null>(null);

  // Form State
  const [projectId, setProjectId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [priority, setPriority] = useState<number>(1);
  const [models, setModels] = useState<string>('gemini-3.8-flash, gemini-3.7-flash, gemini-3.1-pro');

  const [actionMessage, setActionMessage] = useState<{ id: string; text: string; success: boolean } | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/router/gemini-projects');
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || []);
        setLogs(data.logs || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId.trim() || !apiKey.trim()) return;

    try {
      const payload = {
        project_id: projectId.trim(),
        api_key: apiKey.trim(),
        priority: priority,
        models_available: models.split(',').map(m => m.trim()).filter(Boolean)
      };

      let res;
      if (editProjectId) {
        res = await fetch(`/api/router/gemini-projects/${editProjectId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch('/api/router/gemini-projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      if (res.ok) {
        setShowAddModal(false);
        setEditProjectId(null);
        setIsEditing(false);
        setProjectId('');
        setApiKey('');
        setPriority(1);
        setModels('gemini-3.8-flash, gemini-3.7-flash, gemini-3.1-pro');
        fetchProjects();
      } else {
        const err = await res.json();
        alert(`Error: ${err.error}`);
      }
    } catch (err: any) {
      alert(`Failed to save: ${err.message}`);
    }
  };
  const handleEditClick = (p: any) => {
    setIsEditing(true);
    setEditProjectId(p.project_id);
    setProjectId(p.project_id);
    setApiKey(p.api_key || '');
    setPriority(p.priority || 1);
    setModels((p.models_available || []).join(', '));
    setShowAddModal(true);
  };

  const handleDelete = async (id: string) => {
    if (deleteConfirmId !== id) {
      setDeleteConfirmId(id);
      return;
    }
    
    try {
      await fetch(`/api/router/gemini-projects/${id}`, { method: 'DELETE' });
      setDeleteConfirmId(null);
      fetchProjects();
    } catch (err) {
      console.error(err);
    }
  };

  const safeParseJson = async (res: Response) => {
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Server mengembalikan respon error (${res.status}): ${text.slice(0, 100)}`);
    }
  };

  const handleTest = async (id: string) => {
    try {
      setActionMessage({ id, text: 'Testing...', success: true });
      const res = await fetch(`/api/router/gemini-projects/${id}/test`, { method: 'POST' });
      const data = await safeParseJson(res);
      setActionMessage({
        id,
        text: data.success ? `Connected! Latency: ${data.latency}ms` : `Failed: ${data.message}`,
        success: data.success
      });
      fetchProjects();
    } catch (err: any) {
      setActionMessage({ id, text: `Test failed: ${err.message}`, success: false });
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      await fetch(`/api/router/gemini-projects/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !currentStatus })
      });
      fetchProjects();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="mt-6 space-y-4 border-t border-white/10 pt-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Server className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs font-bold uppercase font-mono text-zinc-200 tracking-wider">
            Multi-Project Credentials (Gemini Router)
          </h3>
        </div>
        <button
          onClick={() => {
            setIsEditing(false);
            setProjectId('');
            setApiKey('');
            setPriority(1);
            setModels('gemini-3.8-flash, gemini-3.7-flash, gemini-3.1-pro');
            setShowAddModal(true);
          }}
          className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold font-mono rounded-lg transition-colors"
        >
          <Plus className="w-3 h-3" /> Add Project
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {projects.map((p) => (
          <div key={p.project_id} className={`p-4 rounded-xl border ${p.enabled ? 'bg-[#121624] border-white/5' : 'bg-zinc-900/50 border-white/5 opacity-70'}`}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-white font-mono">{p.project_id}</h4>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono uppercase ${
                    p.health.status === 'healthy' ? 'bg-emerald-500/20 text-emerald-300' :
                    p.health.status === 'error' ? 'bg-red-500/20 text-red-300' :
                    'bg-yellow-500/20 text-yellow-300'
                  }`}>
                    {p.health.status}
                  </span>
                </div>
                <div className="text-[10px] text-zinc-500 font-mono mt-1">API Key: {p.api_key}</div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleToggleStatus(p.project_id, p.enabled)} className="p-1.5 hover:bg-white/10 rounded-lg text-zinc-400 transition-colors" title={p.enabled ? 'Disable' : 'Enable'}>
                   {p.enabled ? <ShieldCheck className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-amber-500" />}
                </button>
                <button onClick={() => handleEditClick(p)} className="p-1.5 hover:bg-white/10 rounded-lg text-blue-400 transition-colors" title="Edit Configuration">
                  <Edit3 className="w-4 h-4" />
                </button>
                <button onClick={() => handleTest(p.project_id)} className="p-1.5 hover:bg-white/10 rounded-lg text-indigo-400 transition-colors" title="Test Connection">
                  <Play className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(p.project_id)} className={`p-1.5 hover:bg-white/10 rounded-lg transition-colors ${deleteConfirmId === p.project_id ? 'text-red-500 bg-red-500/20 hover:bg-red-500/30' : 'text-red-400'}`} title={deleteConfirmId === p.project_id ? "Click again to confirm delete" : "Delete"}>
                  {deleteConfirmId === p.project_id ? <Check className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="bg-black/30 p-2 rounded text-center">
                <div className="text-[10px] text-zinc-500 uppercase font-mono">Priority</div>
                <div className="text-xs font-bold text-zinc-200">{p.priority}</div>
              </div>
              <div className="bg-black/30 p-2 rounded text-center">
                <div className="text-[10px] text-zinc-500 uppercase font-mono">RPM Used</div>
                <div className="text-xs font-bold text-zinc-200">{p.usage.rpm_used}/{p.quota.rpm}</div>
              </div>
              <div className="bg-black/30 p-2 rounded text-center">
                <div className="text-[10px] text-zinc-500 uppercase font-mono">Latency</div>
                <div className="text-xs font-bold text-zinc-200">{Math.round(p.health.latency)}ms</div>
              </div>
            </div>
            
            <div className="text-[10px] text-zinc-400 font-mono bg-black/20 p-2 rounded">
              <span className="text-zinc-500">Models: </span>
              {p.models_available.join(', ')}
            </div>

            {actionMessage?.id === p.project_id && (
              <div className={`mt-2 text-xs font-mono p-2 rounded ${actionMessage.success ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                {actionMessage.text}
              </div>
            )}
          </div>
        ))}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#0F131E] border border-white/10 p-6 rounded-2xl w-full max-w-md shadow-2xl relative">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-bold text-white mb-6 font-mono flex items-center gap-2">
              {isEditing ? <Edit3 className="w-5 h-5 text-blue-400" /> : <Plus className="w-5 h-5 text-emerald-400" />}
              {isEditing ? 'Edit Gemini Project' : 'Add Gemini Project'}
            </h2>

            <form onSubmit={handleSaveProject} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-zinc-400 mb-1">Google Project ID / Name</label>
                <input
                  type="text"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  disabled={isEditing}
                  className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono focus:border-indigo-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="e.g. gen-lang-client-0001"
                  required
                />
              </div>
              
              <div>
                <label className="block text-xs font-mono text-zinc-400 mb-1">Gemini API Key</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono focus:border-indigo-500 focus:outline-none"
                  placeholder={isEditing ? 'Leave empty (or masked) to keep current key' : 'AIza...'}
                  required={!isEditing}
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-zinc-400 mb-1">Priority (1 = Highest)</label>
                <input
                  type="number"
                  min="1"
                  value={priority}
                  onChange={(e) => setPriority(Number(e.target.value))}
                  className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono focus:border-indigo-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-zinc-400 mb-1">Supported Models (comma separated)</label>
                <input
                  type="text"
                  value={models}
                  onChange={(e) => setModels(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono focus:border-indigo-500 focus:outline-none"
                  required
                />
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-sm font-mono text-zinc-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-4 py-2 text-white text-sm font-bold font-mono rounded-lg transition-colors flex items-center gap-2 ${isEditing ? 'bg-blue-600 hover:bg-blue-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}
                >
                  <Check className="w-4 h-4" /> {isEditing ? 'Save Changes' : 'Save Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
