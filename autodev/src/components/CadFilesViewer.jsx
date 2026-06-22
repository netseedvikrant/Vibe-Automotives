import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Box, ExternalLink, RefreshCcw, ChevronDown, ChevronUp, Layers } from 'lucide-react';
import { supabase } from '../lib/supabase';

/**
 * CadFilesViewer — read-only panel showing all CAD revisions uploaded by the
 * Design Engineer for a given program. Embed this wherever reviewers need to
 * inspect design artefacts (Chief, Quality, Program Manager).
 *
 * Props:
 *   programId  — Supabase UUID of the program whose CAD files to display.
 *   programName — Human-readable label shown in the panel header.
 *   defaultOpen — whether the collapsible panel starts expanded (default: true).
 */
const CadFilesViewer = ({ programId, programName, defaultOpen = true, onSelectFile = null }) => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    if (programId) fetchCadFiles();
  }, [programId]);

  const fetchCadFiles = async () => {
    if (!programId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('cad_files')
        .select('*')
        .eq('program_id', programId)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const SUPABASE_URL = 'https://smkgmfgbuioclfbuuynl.supabase.co';

      const enriched = (data || []).map((file) => {
        const rawUrl = file.file_url || '';

        // Case 1: Already a full https URL (all Design Dashboard uploads)
        if (rawUrl.startsWith('https://') || rawUrl.startsWith('http://')) {
          return { ...file, resolved_url: rawUrl };
        }

        // Case 2: Relative "storage/cad_models/..." path → reconstruct CDN URL
        if (rawUrl.startsWith('storage/cad_models/')) {
          const path = rawUrl.replace('storage/cad_models/', '');
          return { ...file, resolved_url: `${SUPABASE_URL}/storage/v1/object/public/cad_models/${path}` };
        }

        // Case 3: Try to get the path from description "Storage: {path} | ..."
        const storagePath = extractStoragePath(file);
        if (storagePath) {
          return { ...file, resolved_url: `${SUPABASE_URL}/storage/v1/object/public/cad_models/${storagePath}` };
        }

        // Case 4: Bare path
        if (rawUrl && !rawUrl.includes('://')) {
          return { ...file, resolved_url: `${SUPABASE_URL}/storage/v1/object/public/cad_models/${rawUrl}` };
        }

        return { ...file, resolved_url: '' };
      });

      setFiles(enriched);
    } catch (err) {
      console.error('CadFilesViewer: fetch error', err);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Extract the Supabase Storage object path from a cad_files record.
   * Priority:
   *  1. description field: "Storage: {path} | Task: ..."  (set by DesignDashboard upload)
   *  2. Peel the path from a full https URL
   *  3. Strip legacy "storage/cad_models/" prefix
   */
  const extractStoragePath = (file) => {
    // 1. From description (most reliable)
    if (file.description) {
      const m = file.description.match(/^Storage:\s*([^\s|]+)/);
      if (m && m[1]) return m[1].trim();
    }
    const url = file.file_url || '';
    if (!url) return null;
    // 2. Full https Supabase URL
    const marker = '/object/public/cad_models/';
    const idx = url.indexOf(marker);
    if (idx !== -1) return url.slice(idx + marker.length);
    // 3. Legacy relative path
    if (url.startsWith('storage/cad_models/')) return url.replace('storage/cad_models/', '');
    // 4. Bare path (no scheme)
    if (!url.includes('://')) return url;
    return null;
  };

  const statusColor = (status) => {
    if (status === 'Frozen') return { color: '#1d4ed8', bg: 'rgba(29, 78, 216, 0.12)', border: 'rgba(29, 78, 216, 0.3)' };
    if (status === 'Approved') return { color: '#00ff9d', bg: 'rgba(0,255,157,0.1)', border: 'rgba(0,255,157,0.3)' };
    return { color: '#000000', bg: 'rgba(0,0,0,0.05)', border: 'rgba(0,0,0,0.1)' };
  };

  const getFileIcon = (fileName = '') => {
    const ext = (fileName || '').split('.').pop().toLowerCase();
    const icons = { step: '📐', stp: '📐', iges: '📐', igs: '📐', stl: '🧱', obj: '🧱', pdf: '📄', dwg: '📏', dxf: '📏' };
    return icons[ext] || '📁';
  };

  return (
    <div style={{
      width: '100%',
      boxSizing: 'border-box',
      border: '1px solid rgba(29, 78, 216, 0.2)',
      borderRadius: '12px',
      overflow: 'hidden',
      marginBottom: '16px',
      background: 'rgba(29, 78, 216, 0.03)',
    }}>
      {/* Header / Toggle */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '14px 18px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          borderBottom: open ? '1px solid rgba(29, 78, 216, 0.15)' : 'none',
        }}
      >
        <Layers size={18} color="#1d4ed8" />
        <span style={{ flex: 1, textAlign: 'left', fontWeight: 700, fontSize: '0.92rem', color: '#000000' }}>
          CAD Revisions{programName ? ` — ${programName}` : ''}
          {files.length > 0 && (
            <span style={{ marginLeft: '8px', fontSize: '0.75rem', fontWeight: 600,
              color: '#1d4ed8', background: 'rgba(29, 78, 216, 0.12)', padding: '2px 8px',
              borderRadius: '20px', border: '1px solid rgba(29, 78, 216, 0.25)' }}>
              {files.length} file{files.length !== 1 ? 's' : ''}
            </span>
          )}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); fetchCadFiles(); }}
          title="Refresh"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#000000', padding: '2px 6px' }}
        >
          <RefreshCcw size={14} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
        </button>
        {open ? <ChevronUp size={16} color="#000000" /> : <ChevronDown size={16} color="#000000" />}
      </button>

      {/* Body */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="cad-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {loading ? (
                <div style={{ textAlign: 'center', color: '#000000', padding: '20px', fontSize: '0.88rem' }}>
                  Loading CAD files...
                </div>
              ) : files.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#000000', padding: '20px', fontSize: '0.88rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <Box size={32} style={{ opacity: 0.3 }} />
                  <span>No CAD files uploaded yet for this program.</span>
                </div>
              ) : files.map((file, idx) => {
                const sc = statusColor(file.status);
                return (
                  <div
                    key={file.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '10px 14px',
                      background: idx === 0 ? 'rgba(29,78,216,0.05)' : 'rgba(0,0,0,0.02)',
                      borderRadius: '8px',
                      border: `1px solid ${idx === 0 ? 'rgba(29,78,216,0.15)' : 'rgba(0,0,0,0.08)'}`,
                    }}
                  >
                    {/* File type icon */}
                    <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>{getFileIcon(file.file_name)}</span>

                    {/* File info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.88rem', color: idx === 0 ? '#1d4ed8' : '#000000' }}>
                          {file.version || 'v?'}
                        </span>
                        {idx === 0 && (
                          <span style={{ fontSize: '0.65rem', fontWeight: 700, background: 'rgba(29,78,216,0.15)',
                            color: '#1d4ed8', padding: '1px 6px', borderRadius: '10px', border: '1px solid rgba(29,78,216,0.3)' }}>
                            LATEST
                          </span>
                        )}
                        <span style={{ fontSize: '0.7rem', padding: '1px 8px', borderRadius: '10px',
                          background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, fontWeight: 600 }}>
                          {file.status || 'In Progress'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#000000', marginTop: '2px',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {file.file_name}
                      </div>
                      {file.description && (
                        <div style={{ fontSize: '0.75rem', color: '#000000', marginTop: '2px',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {file.description}
                        </div>
                      )}
                    </div>

                    {/* Date */}
                    <div style={{ fontSize: '0.75rem', color: '#000000', flexShrink: 0, textAlign: 'right' }}>
                      {new Date(file.created_at).toLocaleDateString()}<br />
                      <span style={{ fontSize: '0.7rem' }}>{new Date(file.created_at).toLocaleTimeString()}</span>
                    </div>

                    {/* Open link — resolved URL built at fetch time */}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {onSelectFile && file.resolved_url && (
                        <button
                          onClick={() => onSelectFile(file)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0,
                            padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--accent)',
                            background: 'var(--accent)', color: '#ffffff', fontSize: '0.78rem', fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          👁️ Review CAD
                        </button>
                      )}
                      {file.resolved_url ? (
                        <a
                          href={file.resolved_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={`Open: ${file.file_name}`}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0,
                            padding: '6px 12px', borderRadius: '6px', textDecoration: 'none',
                            background: 'rgba(29, 78, 216, 0.1)', color: '#1d4ed8',
                            border: '1px solid rgba(29, 78, 216, 0.2)', fontSize: '0.78rem', fontWeight: 600
                          }}
                        >
                          <ExternalLink size={13} /> Open
                        </a>
                      ) : (
                        <span title="File could not be found in storage" style={{
                          fontSize: '0.72rem', color: '#604050', flexShrink: 0,
                          padding: '4px 8px', border: '1px solid rgba(255,80,80,0.15)',
                          borderRadius: '6px', background: 'rgba(255,80,80,0.05)'
                        }}>⚠ File Missing</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CadFilesViewer;
