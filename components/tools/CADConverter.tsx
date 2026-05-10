import React, { useState, useRef } from 'react';
import { Upload, Download, AlertCircle, CheckCircle, Clock, X } from 'lucide-react';

interface ConversionJob {
  jobId: string;
  status: 'queued' | 'processing' | 'succeeded' | 'failed' | 'cancelled';
  progress: number;
  sourceFile: string;
  sourceExt: string;
  createdAt: string;
  error?: string;
  result?: { downloadUrl: string };
}

interface CADConverterProps {
  compact?: boolean;
}

export default function CADConverter({ compact = false }: CADConverterProps) {
  const [jobs, setJobs] = useState<ConversionJob[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.toLowerCase().split('.').pop();
    if (!['dwg', 'dgn'].includes(ext || '')) {
      setError('Chỉ hỗ trợ file DWG hoặc DGN');
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setError('File vượt quá 50MB');
      return;
    }

    setError(null);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/conversions/upload', {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Upload thất bại');
      }

      const data = await response.json();
      setJobs([data, ...jobs]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      pollJobStatus(data.jobId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi upload');
    } finally {
      setUploading(false);
    }
  };

  const pollJobStatus = async (jobId: string) => {
    const maxAttempts = 180;
    let attempts = 0;

    const poll = async () => {
      try {
        const response = await fetch(`/api/conversions/${jobId}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
          },
        });

        if (!response.ok) throw new Error('Không thể lấy trạng thái');

        const job = await response.json();
        setJobs(prev => prev.map(j => j.jobId === jobId ? job : j));

        if (['succeeded', 'failed', 'cancelled'].includes(job.status)) return;

        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 1000);
        }
      } catch (err) {
        console.error('Poll error:', err);
      }
    };

    poll();
  };

  const handleCancel = async (jobId: string) => {
    try {
      const response = await fetch(`/api/conversions/${jobId}/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
        },
      });

      if (!response.ok) throw new Error('Hủy thất bại');

      setJobs(prev => prev.map(j =>
        j.jobId === jobId ? { ...j, status: 'cancelled' as const } : j
      ));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi hủy job');
    }
  };

  const handleDownload = (job: ConversionJob) => {
    if (job.result?.downloadUrl) {
      const link = document.createElement('a');
      link.href = job.result.downloadUrl;
      link.download = `${job.sourceFile.split('.')[0]}.geojson`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'succeeded':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'processing':
      case 'queued':
        return <Clock className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'cancelled':
        return <X className="w-5 h-5 text-gray-500" />;
      default:
        return null;
    }
  };

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      queued: 'Chờ xử lý',
      processing: 'Đang xử lý',
      succeeded: 'Thành công',
      failed: 'Thất bại',
      cancelled: 'Đã hủy',
    };
    return statusMap[status] || status;
  };

  if (compact) {
    return (
      <div className="space-y-3">
        <input
          ref={fileInputRef}
          type="file"
          accept=".dwg,.dgn"
          onChange={handleFileSelect}
          disabled={uploading}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg text-sm font-medium transition"
        >
          <Upload className="w-4 h-4" />
          {uploading ? 'Đang upload...' : 'Chọn file DWG/DGN'}
        </button>

        {error && (
          <div className="flex gap-2 p-3 bg-red-900/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-2 max-h-64 overflow-y-auto">
          {jobs.map(job => (
            <div key={job.jobId} className="p-2 bg-slate-700/50 rounded-lg text-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {getStatusIcon(job.status)}
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium text-white">{job.sourceFile}</p>
                    <p className="text-xs text-gray-400">{getStatusText(job.status)}</p>
                  </div>
                </div>
              </div>
              {job.status === 'processing' && (
                <div className="w-full bg-slate-600 rounded-full h-1 mt-1">
                  <div
                    className="bg-blue-500 h-1 rounded-full transition-all"
                    style={{ width: `${job.progress}%` }}
                  />
                </div>
              )}
              <div className="flex gap-1 mt-1">
                {job.status === 'succeeded' && (
                  <button
                    onClick={() => handleDownload(job)}
                    className="flex-1 px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-medium transition"
                  >
                    <Download className="w-3 h-3 inline mr-1" />
                    Tải
                  </button>
                )}
                {['queued', 'processing'].includes(job.status) && (
                  <button
                    onClick={() => handleCancel(job.jobId)}
                    className="flex-1 px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-medium transition"
                  >
                    Hủy
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-slate-800 rounded-lg border border-slate-700">
      <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
        <Upload className="w-6 h-6 text-blue-400" />
        Chuyển đổi CAD (DWG/DGN)
      </h2>

      <div className="space-y-6">
        <div className="border-2 border-dashed border-slate-600 rounded-lg p-8 text-center hover:border-blue-500 transition cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".dwg,.dgn"
            onChange={handleFileSelect}
            disabled={uploading}
            className="hidden"
          />
          <Upload className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <p className="text-white font-medium mb-1">Kéo file hoặc click để chọn</p>
          <p className="text-sm text-slate-400">Hỗ trợ DWG, DGN (tối đa 50MB)</p>
          {uploading && <p className="text-blue-400 text-sm mt-2">Đang upload...</p>}
        </div>

        {error && (
          <div className="flex gap-3 p-4 bg-red-900/20 border border-red-500/50 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-400 font-medium">Lỗi</p>
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          </div>
        )}

        {jobs.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-white">Lịch sử chuyển đổi</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {jobs.map(job => (
                <div key={job.jobId} className="p-4 bg-slate-700/50 rounded-lg border border-slate-600">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      {getStatusIcon(job.status)}
                      <div className="flex-1">
                        <p className="text-white font-medium">{job.sourceFile}</p>
                        <p className="text-sm text-slate-400">{getStatusText(job.status)}</p>
                        {job.error && <p className="text-sm text-red-400 mt-1">{job.error}</p>}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-400">
                        {new Date(job.createdAt).toLocaleString('vi-VN')}
                      </p>
                    </div>
                  </div>

                  {job.status === 'processing' && (
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-slate-400 mb-1">
                        <span>Tiến độ</span>
                        <span>{job.progress}%</span>
                      </div>
                      <div className="w-full bg-slate-600 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full transition-all"
                          style={{ width: `${job.progress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 mt-3">
                    {job.status === 'succeeded' && (
                      <button
                        onClick={() => handleDownload(job)}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition"
                      >
                        <Download className="w-4 h-4" />
                        Tải GeoJSON
                      </button>
                    )}
                    {['queued', 'processing'].includes(job.status) && (
                      <button
                        onClick={() => handleCancel(job.jobId)}
                        className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition"
                      >
                        Hủy
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
