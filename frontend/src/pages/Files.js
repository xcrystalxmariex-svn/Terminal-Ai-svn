import React, { useState, useEffect } from 'react';
import { Folder, File, ChevronRight, ArrowLeft, RefreshCw, Trash2, Plus, Save, Loader2 } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { API_ENDPOINTS } from '../config';
import { useToast } from '../hooks/use-toast';

export default function FilesPage() {
  const { theme } = useTheme();
  const { toast } = useToast();
  const [currentPath, setCurrentPath] = useState('/');
  const [items, setItems] = useState([]);
  const [parentPath, setParentPath] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadDirectory(currentPath);
  }, [currentPath]);

  const loadDirectory = async (path) => {
    setLoading(true);
    setSelectedFile(null);
    try {
      const res = await fetch(`${API_ENDPOINTS.files}?path=${encodeURIComponent(path)}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
        setParentPath(data.parent);
      } else {
        const err = await res.json();
        toast({ title: 'Error', description: err.detail, variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const openFile = async (item) => {
    if (item.is_dir) {
      setCurrentPath(item.path);
      return;
    }
    try {
      const res = await fetch(`${API_ENDPOINTS.filesRead}?path=${encodeURIComponent(item.path)}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedFile(data);
        setFileContent(data.content);
        setEditMode(false);
      } else {
        const err = await res.json();
        toast({ title: 'Error', description: err.detail, variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const saveFile = async () => {
    if (!selectedFile) return;
    setSaving(true);
    try {
      const res = await fetch(API_ENDPOINTS.filesWrite, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: selectedFile.path, content: fileContent }),
      });
      if (res.ok) {
        toast({ title: 'Saved', description: 'File saved successfully' });
        setEditMode(false);
      } else {
        const err = await res.json();
        toast({ title: 'Error', description: err.detail, variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const deleteItem = async (item) => {
    if (!window.confirm(`Delete ${item.name}?`)) return;
    try {
      const res = await fetch(`${API_ENDPOINTS.files}?path=${encodeURIComponent(item.path)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        toast({ title: 'Deleted', description: item.name });
        loadDirectory(currentPath);
      } else {
        const err = await res.json();
        toast({ title: 'Error', description: err.detail, variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const createFolder = async () => {
    const name = window.prompt('Folder name:');
    if (!name) return;
    try {
      const res = await fetch(API_ENDPOINTS.filesMkdir, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: `${currentPath}/${name}`.replace('//', '/') }),
      });
      if (res.ok) {
        toast({ title: 'Created', description: name });
        loadDirectory(currentPath);
      } else {
        const err = await res.json();
        toast({ title: 'Error', description: err.detail, variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const formatSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div
      data-testid="files-page"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: theme.background,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          borderBottom: `1px solid ${theme.border}`,
        }}
      >
        <span style={{ fontSize: '16px', fontWeight: 700, letterSpacing: '0.5px' }}>Files</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            data-testid="create-folder-btn"
            onClick={createFolder}
            style={{
              padding: '6px',
              borderRadius: '6px',
              border: `1px solid ${theme.border}`,
              background: 'transparent',
              color: theme.textDim,
              cursor: 'pointer',
            }}
          >
            <Plus size={16} />
          </button>
          <button
            data-testid="refresh-btn"
            onClick={() => loadDirectory(currentPath)}
            style={{
              padding: '6px',
              borderRadius: '6px',
              border: `1px solid ${theme.border}`,
              background: 'transparent',
              color: theme.textDim,
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Path bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 16px',
          borderBottom: `1px solid ${theme.border}`,
          background: theme.secondary,
        }}
      >
        {parentPath && (
          <button
            data-testid="go-back-btn"
            onClick={() => setCurrentPath(parentPath)}
            style={{
              padding: '4px',
              borderRadius: '4px',
              border: 'none',
              background: 'transparent',
              color: theme.textDim,
              cursor: 'pointer',
            }}
          >
            <ArrowLeft size={16} />
          </button>
        )}
        <span style={{ fontSize: '13px', color: theme.textDim, fontFamily: 'monospace' }}>
          {currentPath}
        </span>
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* File list */}
        <div
          style={{
            width: selectedFile ? '40%' : '100%',
            borderRight: selectedFile ? `1px solid ${theme.border}` : 'none',
            overflow: 'auto',
          }}
        >
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
              <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: theme.primary }} />
            </div>
          ) : items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: theme.textDim }}>
              <Folder size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
              <p>Empty directory</p>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.path}
                data-testid={`file-item-${item.name}`}
                onClick={() => openFile(item)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 16px',
                  cursor: 'pointer',
                  borderBottom: `1px solid ${theme.border}`,
                  background: selectedFile?.path === item.path ? theme.secondary : 'transparent',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                  {item.is_dir ? (
                    <Folder size={18} style={{ color: theme.warning, flexShrink: 0 }} />
                  ) : (
                    <File size={18} style={{ color: theme.textDim, flexShrink: 0 }} />
                  )}
                  <span
                    style={{
                      fontSize: '14px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.name}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', color: theme.textDim }}>{formatSize(item.size)}</span>
                  {!item.is_dir && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteItem(item);
                      }}
                      style={{
                        padding: '4px',
                        border: 'none',
                        background: 'transparent',
                        color: theme.error,
                        cursor: 'pointer',
                        opacity: 0.5,
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                  {item.is_dir && <ChevronRight size={16} style={{ color: theme.textDim }} />}
                </div>
              </div>
            ))
          )}
        </div>

        {/* File viewer/editor */}
        {selectedFile && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 16px',
                borderBottom: `1px solid ${theme.border}`,
                background: theme.secondary,
              }}
            >
              <span style={{ fontSize: '13px', fontWeight: 600 }}>{selectedFile.name}</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                {editMode ? (
                  <button
                    data-testid="save-file-btn"
                    onClick={saveFile}
                    disabled={saving}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      border: 'none',
                      background: theme.primary,
                      color: theme.background,
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 600,
                    }}
                  >
                    <Save size={14} /> {saving ? 'Saving...' : 'Save'}
                  </button>
                ) : (
                  <button
                    data-testid="edit-file-btn"
                    onClick={() => setEditMode(true)}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      border: `1px solid ${theme.border}`,
                      background: 'transparent',
                      color: theme.textDim,
                      cursor: 'pointer',
                      fontSize: '12px',
                    }}
                  >
                    Edit
                  </button>
                )}
              </div>
            </div>
            {editMode ? (
              <textarea
                data-testid="file-editor"
                value={fileContent}
                onChange={(e) => setFileContent(e.target.value)}
                style={{
                  flex: 1,
                  padding: '12px',
                  border: 'none',
                  background: theme.background,
                  color: theme.foreground,
                  fontSize: '13px',
                  fontFamily: 'monospace',
                  lineHeight: '1.5',
                  resize: 'none',
                }}
              />
            ) : (
              <pre
                data-testid="file-viewer"
                style={{
                  flex: 1,
                  padding: '12px',
                  margin: 0,
                  overflow: 'auto',
                  fontSize: '13px',
                  lineHeight: '1.5',
                  color: theme.foreground,
                }}
              >
                {selectedFile.content}
              </pre>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
