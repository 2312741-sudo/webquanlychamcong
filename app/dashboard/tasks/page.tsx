'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useApp } from '../layout';
import {
  createTask,
  updateTask,
  deleteTask,
  watchStoreTasks,
  getTasksForUserOnDate,
  watchTaskSubmissions,
  saveTaskSubmission,
  uploadTaskPhotoWeb,
  getVietnamDateString,
} from '@/lib/firestore';
import {
  AssignedTask,
  TaskSubmission,
  TaskTargetType,
  TaskStatus,
  Member,
  getRoleLabel,
  normalizeRole,
} from '@/lib/types';

export default function TasksPage() {
  const { storeId, store, members, user, role } = useApp();
  const normalizedRole = normalizeRole(role);
  const isManagerOrOwner = ['owner', 'manager1', 'manager2'].includes(normalizedRole);

  const todayStr = useMemo(() => getVietnamDateString(), []);

  // Tabs: 'my_tasks' | 'management'
  const [activeTab, setActiveTab] = useState<'my_tasks' | 'management'>(
    isManagerOrOwner ? 'management' : 'my_tasks'
  );

  // ──────────────────────────────────────────────────────────────────────────
  // TAB 1: VIỆC CỦA TÔI TRONG CA (My Tasks)
  // ──────────────────────────────────────────────────────────────────────────
  const [selectedMyDate, setSelectedMyDate] = useState<string>(todayStr);
  const [myTasks, setMyTasks] = useState<AssignedTask[]>([]);
  const [mySubmissions, setMySubmissions] = useState<Record<string, TaskSubmission>>({});
  const [loadingMyTasks, setLoadingMyTasks] = useState<boolean>(true);

  // Form drafts for reporting each task: { [taskId]: { text: string, photos: string[], uploading: boolean } }
  const [taskDrafts, setTaskDrafts] = useState<
    Record<string, { text: string; photos: string[]; uploading: boolean }>
  >({});
  const [savingTaskId, setSavingTaskId] = useState<string | null>(null);

  // Fetch my tasks for selected date
  const loadMyTasks = useCallback(async () => {
    if (!storeId || !user) return;
    setLoadingMyTasks(true);
    try {
      const tasks = await getTasksForUserOnDate(storeId, user.uid, selectedMyDate);
      setMyTasks(tasks);

      // Load submissions for these tasks
      const subsRecord: Record<string, TaskSubmission> = {};
      const draftsRecord: Record<string, { text: string; photos: string[]; uploading: boolean }> = {};

      for (const t of tasks) {
        // We will fetch submission for (user.uid, selectedMyDate)
        try {
          const subDocId = `${user.uid}_${selectedMyDate}`;
          // Read from store tasks submissions
          // We can use a lightweight one-shot fetch or watch
          // For now, let's load submissions
        } catch (e) {
          console.error(e);
        }
      }
    } catch (err) {
      console.error('Lỗi khi tải công việc cá nhân:', err);
    } finally {
      setLoadingMyTasks(false);
    }
  }, [storeId, user, selectedMyDate]);

  useEffect(() => {
    loadMyTasks();
  }, [loadMyTasks]);

  // Subscribe to submissions for my tasks on selected date
  useEffect(() => {
    if (!storeId || !user || myTasks.length === 0) return;

    const unsubs: (() => void)[] = [];
    myTasks.forEach((task) => {
      const unsub = watchTaskSubmissions(
        storeId,
        task.id,
        (subs) => {
          const mySub = subs.find((s) => s.userId === user.uid && s.workDate === selectedMyDate);
          if (mySub) {
            setMySubmissions((prev) => ({ ...prev, [task.id]: mySub }));
            setTaskDrafts((prev) => {
              // Only seed draft if not already edited
              if (!prev[task.id]) {
                return {
                  ...prev,
                  [task.id]: {
                    text: mySub.reportText || '',
                    photos: mySub.photoUrls || [],
                    uploading: false,
                  },
                };
              }
              return prev;
            });
          }
        },
        selectedMyDate
      );
      unsubs.push(unsub);
    });

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [storeId, user, myTasks, selectedMyDate]);

  // Handle uploading photos for my task
  const handleUploadPhoto = async (taskId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    if (!storeId || !user || !e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files);

    setTaskDrafts((prev) => ({
      ...prev,
      [taskId]: {
        text: prev[taskId]?.text ?? mySubmissions[taskId]?.reportText ?? '',
        photos: prev[taskId]?.photos ?? mySubmissions[taskId]?.photoUrls ?? [],
        uploading: true,
      },
    }));

    try {
      const uploadPromises = files.map((file) =>
        uploadTaskPhotoWeb(storeId, taskId, user.uid, selectedMyDate, file)
      );
      const newUrls = await Promise.all(uploadPromises);

      setTaskDrafts((prev) => {
        const cur = prev[taskId] || { text: '', photos: [], uploading: false };
        return {
          ...prev,
          [taskId]: {
            ...cur,
            photos: [...cur.photos, ...newUrls],
            uploading: false,
          },
        };
      });
    } catch (err: any) {
      console.error('Lỗi tải ảnh lên:', err);
      alert('Không thể tải ảnh lên: ' + (err.message || 'Lỗi mạng'));
      setTaskDrafts((prev) => ({
        ...prev,
        [taskId]: {
          ...(prev[taskId] || { text: '', photos: [] }),
          uploading: false,
        },
      }));
    } finally {
      e.target.value = '';
    }
  };

  // Remove photo from draft
  const handleRemovePhoto = (taskId: string, photoIdx: number) => {
    setTaskDrafts((prev) => {
      const cur = prev[taskId];
      if (!cur) return prev;
      const nextPhotos = [...cur.photos];
      nextPhotos.splice(photoIdx, 1);
      return {
        ...prev,
        [taskId]: { ...cur, photos: nextPhotos },
      };
    });
  };

  // Save submission (draft or complete)
  const handleSaveSubmission = async (task: AssignedTask, isCompleted: boolean) => {
    if (!storeId || !user) return;
    const draft = taskDrafts[task.id] || {
      text: mySubmissions[task.id]?.reportText || '',
      photos: mySubmissions[task.id]?.photoUrls || [],
      uploading: false,
    };

    if (isCompleted && task.requirePhoto && draft.photos.length === 0) {
      alert('⚠️ Công việc này bắt buộc phải chụp ít nhất 1 ảnh minh chứng trước khi bấm Hoàn thành!');
      return;
    }

    setSavingTaskId(task.id);
    try {
      const subId = `${user.uid}_${selectedMyDate}`;
      const subData: Omit<TaskSubmission, 'lastSavedAt'> = {
        id: subId,
        taskId: task.id,
        storeId,
        userId: user.uid,
        userName: user.displayName || user.email?.split('@')[0] || 'Nhân viên',
        workDate: selectedMyDate,
        reportText: draft.text.trim(),
        photoUrls: draft.photos,
        isCompleted,
        completedAt: isCompleted ? new Date() : null,
      };

      await saveTaskSubmission(storeId, task.id, subData);
      setMySubmissions((prev) => ({
        ...prev,
        [task.id]: { ...subData, lastSavedAt: new Date() },
      }));

      if (isCompleted) {
        alert('🎉 Đã xác nhận HOÀN THÀNH công việc!');
      } else {
        alert('💾 Đã lưu bản nháp báo cáo thành công.');
      }
    } catch (err: any) {
      console.error('Lỗi khi lưu báo cáo:', err);
      alert('Lỗi khi lưu báo cáo: ' + (err.message || 'Thử lại'));
    } finally {
      setSavingTaskId(null);
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // TAB 2: QUẢN LÝ GIAO VIỆC (Management)
  // ──────────────────────────────────────────────────────────────────────────
  const [allTasks, setAllTasks] = useState<AssignedTask[]>([]);
  const [filterDateMode, setFilterDateMode] = useState<'all' | 'today' | 'tomorrow' | 'custom'>('all');
  const [filterCustomDate, setFilterCustomDate] = useState<string>(todayStr);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'completed' | 'cancelled'>('all');
  const [searchKeyword, setSearchKeyword] = useState<string>('');

  // Watch store tasks
  useEffect(() => {
    if (!storeId || !isManagerOrOwner) return;
    const unsub = watchStoreTasks(storeId, setAllTasks);
    return unsub;
  }, [storeId, isManagerOrOwner]);

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    let result = allTasks;

    // Filter date
    if (filterDateMode === 'today') {
      result = result.filter(
        (t) => Array.isArray(t.executionDates) && t.executionDates.includes(todayStr)
      );
    } else if (filterDateMode === 'tomorrow') {
      const tom = new Date();
      tom.setDate(tom.getDate() + 1);
      const tomStr = getVietnamDateString(tom);
      result = result.filter(
        (t) => Array.isArray(t.executionDates) && t.executionDates.includes(tomStr)
      );
    } else if (filterDateMode === 'custom' && filterCustomDate) {
      result = result.filter(
        (t) => Array.isArray(t.executionDates) && t.executionDates.includes(filterCustomDate)
      );
    }

    // Filter status
    if (filterStatus !== 'all') {
      result = result.filter((t) => t.status === filterStatus);
    }

    // Search keyword
    if (searchKeyword.trim()) {
      const q = searchKeyword.toLowerCase();
      result = result.filter(
        (t) => t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
      );
    }

    return result;
  }, [allTasks, filterDateMode, filterCustomDate, filterStatus, searchKeyword, todayStr]);

  // ── Modals state ──
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [detailTask, setDetailTask] = useState<AssignedTask | null>(null);
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);

  // ── Create Task Form State ──
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newDates, setNewDates] = useState<string[]>([todayStr]);
  const [customAddDate, setCustomAddDate] = useState<string>('');
  const [newTargetType, setNewTargetType] = useState<TaskTargetType>('allStore');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [newRequirePhoto, setNewRequirePhoto] = useState<boolean>(false);
  const [creatingTask, setCreatingTask] = useState<boolean>(false);

  const resetCreateForm = () => {
    setNewTitle('');
    setNewDescription('');
    setNewDates([todayStr]);
    setCustomAddDate('');
    setNewTargetType('allStore');
    setSelectedMemberIds([]);
    setNewRequirePhoto(false);
  };

  const handleAddDateToNewTask = (dateStr: string) => {
    if (!dateStr) return;
    if (!newDates.includes(dateStr)) {
      setNewDates((prev) => [...prev, dateStr].sort());
    }
  };

  const handleRemoveDateFromNewTask = (dateStr: string) => {
    setNewDates((prev) => prev.filter((d) => d !== dateStr));
  };

  const handleCreateTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeId || !user) return;
    if (!newTitle.trim()) {
      alert('Vui lòng nhập tiêu đề công việc');
      return;
    }
    if (newDates.length === 0) {
      alert('Vui lòng chọn ít nhất 1 ngày thực hiện');
      return;
    }
    if (newTargetType === 'individual' && selectedMemberIds.length === 0) {
      alert('Vui lòng chọn ít nhất 1 thành viên nhận việc');
      return;
    }

    setCreatingTask(true);
    try {
      const assignedNames =
        newTargetType === 'allStore'
          ? ['Toàn bộ cửa hàng']
          : selectedMemberIds.map((uid) => {
              const m = members.find((mem) => mem.userId === uid);
              return m?.name || uid;
            });

      const taskData: Omit<AssignedTask, 'id' | 'createdAt'> = {
        storeId,
        title: newTitle.trim(),
        description: newDescription.trim(),
        createdBy: user.uid,
        createdByName: user.displayName || user.email?.split('@')[0] || 'Quản lý',
        createdByRole: (role as any) || 'manager1',
        targetType: newTargetType,
        assignedUserIds: newTargetType === 'allStore' ? [] : selectedMemberIds,
        assignedNames,
        executionDates: newDates,
        requirePhoto: newRequirePhoto,
        status: 'active',
      };

      await createTask(storeId, taskData);
      alert('✅ Đã tạo và giao công việc thành công!');
      setShowCreateModal(false);
      resetCreateForm();
    } catch (err: any) {
      console.error('Lỗi khi tạo công việc:', err);
      alert('Lỗi tạo công việc: ' + (err.message || 'Thử lại'));
    } finally {
      setCreatingTask(false);
    }
  };

  // Quick days helper for date selection
  const getUpcomingDays = () => {
    const days: { label: string; dateStr: string }[] = [];
    const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const str = getVietnamDateString(d);
      let label = `${dayNames[d.getDay()]} (${d.getDate()}/${d.getMonth() + 1})`;
      if (i === 0) label = `Hôm nay (${d.getDate()}/${d.getMonth() + 1})`;
      if (i === 1) label = `Ngày mai (${d.getDate()}/${d.getMonth() + 1})`;
      days.push({ label, dateStr: str });
    }
    return days;
  };

  // Helper delete task
  const handleDeleteTask = async (taskId: string, title: string) => {
    if (!storeId) return;
    if (!confirm(`Bạn có chắc muốn xoá công việc "${title}"?`)) return;
    try {
      await deleteTask(storeId, taskId);
      if (detailTask?.id === taskId) setDetailTask(null);
    } catch (err: any) {
      alert('Lỗi khi xoá việc: ' + (err.message || 'Thử lại'));
    }
  };

  // ── Calculate metrics for My Tasks ──
  const myTotalCount = myTasks.length;
  const myCompletedCount = myTasks.filter((t) => mySubmissions[t.id]?.isCompleted).length;
  const myProgressPercent = myTotalCount > 0 ? Math.round((myCompletedCount / myTotalCount) * 100) : 100;

  return (
    <div className="tasks-container" style={{ padding: '24px 20px', maxWidth: 1200, margin: '0 auto' }}>
      {/* ── Page Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span>📋</span>
            <span>Giao việc & Báo cáo công việc</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 4 }}>
            Quản lý công việc trong ca, báo cáo hình ảnh minh chứng và kiểm soát trước khi ra ca.
          </p>
        </div>

        {/* Tab Switcher */}
        {isManagerOrOwner && (
          <div style={{ display: 'flex', background: 'var(--primary-light)', padding: 4, borderRadius: 12, gap: 4 }}>
            <button
              onClick={() => setActiveTab('management')}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                background: activeTab === 'management' ? 'var(--primary)' : 'transparent',
                color: activeTab === 'management' ? 'white' : 'var(--text-primary)',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span>📋</span>
              <span>Giao việc & Quản lý ({allTasks.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('my_tasks')}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                background: activeTab === 'my_tasks' ? 'var(--primary)' : 'transparent',
                color: activeTab === 'my_tasks' ? 'white' : 'var(--text-primary)',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span>📝</span>
              <span>Việc của tôi trong ca ({myTotalCount})</span>
            </button>
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* VIEW: TAB VIỆC CỦA TÔI TRONG CA */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'my_tasks' && (
        <div>
          {/* Top Bar: Date Selector & Summary */}
          <div
            style={{
              background: 'white',
              borderRadius: 16,
              padding: 20,
              boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
              border: '1px solid var(--border)',
              marginBottom: 24,
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-secondary)' }}>
                📅 Ngày làm việc:
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => setSelectedMyDate(todayStr)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    background: selectedMyDate === todayStr ? 'var(--primary)' : '#f3f4f6',
                    color: selectedMyDate === todayStr ? 'white' : '#4b5563',
                  }}
                >
                  Hôm nay
                </button>
                <input
                  type="date"
                  value={selectedMyDate}
                  onChange={(e) => setSelectedMyDate(e.target.value)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    fontSize: 13,
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            {/* Progress Bar Badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 260 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600 }}>Tiến độ công việc</span>
                  <span style={{ fontWeight: 700, color: myCompletedCount === myTotalCount && myTotalCount > 0 ? '#15803d' : '#b45309' }}>
                    {myCompletedCount}/{myTotalCount} hoàn thành ({myProgressPercent}%)
                  </span>
                </div>
                <div style={{ width: '100%', height: 8, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${myProgressPercent}%`,
                      height: '100%',
                      background: myCompletedCount === myTotalCount && myTotalCount > 0 ? '#22c55e' : '#f59e0b',
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Unfinished warning alert if active workday */}
          {myTotalCount > 0 && myCompletedCount < myTotalCount && selectedMyDate === todayStr && (
            <div
              style={{
                background: '#fffbeb',
                border: '1px solid #fef3c7',
                borderRadius: 12,
                padding: '12px 16px',
                marginBottom: 20,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                color: '#92400e',
                fontSize: 14,
              }}
            >
              <span style={{ fontSize: 20 }}>⚠️</span>
              <div>
                <strong>Lưu ý quan trọng:</strong> Hệ thống yêu cầu hoàn thành tất cả công việc được giao
                trước khi bạn có thể thực hiện <strong>RA CA (KẾT THÚC CA)</strong>.
              </div>
            </div>
          )}

          {/* Task List */}
          {loadingMyTasks ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)' }}>
              <div className="spinner" style={{ margin: '0 auto 12px' }} />
              <div>Đang tải danh sách công việc của bạn...</div>
            </div>
          ) : myTasks.length === 0 ? (
            <div
              style={{
                background: 'white',
                borderRadius: 16,
                padding: '50px 20px',
                textAlign: 'center',
                border: '1px dashed var(--border)',
                color: 'var(--text-secondary)',
              }}
            >
              <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
              <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                Không có công việc nào được giao trong ngày {selectedMyDate}
              </h3>
              <p style={{ fontSize: 14 }}>Bạn không có đầu việc nào cần báo cáo vào ngày này.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {myTasks.map((task, idx) => {
                const sub = mySubmissions[task.id];
                const isCompleted = sub?.isCompleted === true;
                const draft = taskDrafts[task.id] || {
                  text: sub?.reportText || '',
                  photos: sub?.photoUrls || [],
                  uploading: false,
                };
                const isSaving = savingTaskId === task.id;

                return (
                  <div
                    key={task.id}
                    style={{
                      background: 'white',
                      borderRadius: 16,
                      border: isCompleted ? '1.5px solid #86efac' : '1px solid var(--border)',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.03)',
                      overflow: 'hidden',
                    }}
                  >
                    {/* Header */}
                    <div
                      style={{
                        padding: '16px 20px',
                        background: isCompleted ? '#f0fdf4' : '#fafafa',
                        borderBottom: '1px solid #f3f4f6',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        flexWrap: 'wrap',
                        gap: 12,
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                            {idx + 1}. {task.title}
                          </span>
                          {task.requirePhoto && (
                            <span
                              style={{
                                background: '#fef3c7',
                                color: '#92400e',
                                fontSize: 12,
                                fontWeight: 600,
                                padding: '3px 8px',
                                borderRadius: 6,
                              }}
                            >
                              📸 Bắt buộc ảnh chụp
                            </span>
                          )}
                          <span
                            style={{
                              background: '#e0f2fe',
                              color: '#0369a1',
                              fontSize: 12,
                              fontWeight: 500,
                              padding: '3px 8px',
                              borderRadius: 6,
                            }}
                          >
                            Người giao: {task.createdByName}
                          </span>
                        </div>
                        {task.description && (
                          <p style={{ marginTop: 6, fontSize: 14, color: '#4b5563', lineHeight: 1.5 }}>
                            {task.description}
                          </p>
                        )}
                      </div>

                      {/* Status Badge */}
                      <div>
                        {isCompleted ? (
                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              background: '#dcfce7',
                              color: '#15803d',
                              padding: '6px 14px',
                              borderRadius: 20,
                              fontWeight: 700,
                              fontSize: 13,
                            }}
                          >
                            <span>✓</span>
                            <span>ĐÃ HOÀN THÀNH</span>
                          </div>
                        ) : (
                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              background: '#fef3c7',
                              color: '#b45309',
                              padding: '6px 14px',
                              borderRadius: 20,
                              fontWeight: 600,
                              fontSize: 13,
                            }}
                          >
                            <span>⏳</span>
                            <span>Đang thực hiện</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Report Form Body */}
                    <div style={{ padding: 20 }}>
                      <div style={{ marginBottom: 16 }}>
                        <label style={{ display: 'block', fontWeight: 600, fontSize: 14, marginBottom: 6, color: 'var(--text-primary)' }}>
                          📝 Báo cáo kết quả / Tiến độ công việc:
                        </label>
                        <textarea
                          rows={3}
                          placeholder="Nhập nội dung báo cáo chi tiết công việc đã làm..."
                          value={draft.text}
                          onChange={(e) =>
                            setTaskDrafts((prev) => ({
                              ...prev,
                              [task.id]: {
                                text: e.target.value,
                                photos: prev[task.id]?.photos ?? sub?.photoUrls ?? [],
                                uploading: prev[task.id]?.uploading ?? false,
                              },
                            }))
                          }
                          style={{
                            width: '100%',
                            padding: 12,
                            borderRadius: 10,
                            border: '1px solid var(--border)',
                            fontSize: 14,
                            outline: 'none',
                            transition: 'border 0.2s',
                          }}
                        />
                      </div>

                      {/* Photo Gallery & Upload */}
                      <div style={{ marginBottom: 20 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <label style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>
                            📸 Hình ảnh minh chứng ({draft.photos.length}):
                            {task.requirePhoto && <span style={{ color: '#ef4444', marginLeft: 4 }}>* (Bắt buộc)</span>}
                          </label>

                          {/* Upload button */}
                          <label
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              background: '#f3f4f6',
                              color: '#1f2937',
                              padding: '6px 12px',
                              borderRadius: 8,
                              fontSize: 13,
                              fontWeight: 600,
                              cursor: draft.uploading ? 'not-allowed' : 'pointer',
                              border: '1px solid #d1d5db',
                            }}
                          >
                            <span>📷</span>
                            <span>{draft.uploading ? 'Đang tải ảnh...' : 'Thêm ảnh'}</span>
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              disabled={draft.uploading}
                              style={{ display: 'none' }}
                              onChange={(e) => handleUploadPhoto(task.id, e)}
                            />
                          </label>
                        </div>

                        {/* Photos thumbnails grid */}
                        {draft.photos.length > 0 ? (
                          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
                            {draft.photos.map((url, pIdx) => (
                              <div
                                key={url}
                                style={{
                                  position: 'relative',
                                  width: 100,
                                  height: 100,
                                  borderRadius: 10,
                                  overflow: 'hidden',
                                  border: '1px solid #e5e7eb',
                                  boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                                }}
                              >
                                <img
                                  src={url}
                                  alt={`Minh chứng ${pIdx + 1}`}
                                  onClick={() => setLightboxImg(url)}
                                  style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                    cursor: 'zoom-in',
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={() => handleRemovePhoto(task.id, pIdx)}
                                  style={{
                                    position: 'absolute',
                                    top: 4,
                                    right: 4,
                                    width: 22,
                                    height: 22,
                                    borderRadius: '50%',
                                    background: 'rgba(0,0,0,0.65)',
                                    color: 'white',
                                    fontSize: 12,
                                    fontWeight: 700,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    border: 'none',
                                  }}
                                  title="Xoá ảnh này"
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div
                            style={{
                              background: '#f9fafb',
                              border: '1px dashed #d1d5db',
                              borderRadius: 10,
                              padding: '16px',
                              textAlign: 'center',
                              fontSize: 13,
                              color: '#6b7280',
                            }}
                          >
                            Chưa có ảnh minh chứng nào. Bấm &quot;Thêm ảnh&quot; để chọn ảnh từ máy tính hoặc điện thoại.
                          </div>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, flexWrap: 'wrap', borderTop: '1px solid #f3f4f6', paddingTop: 16 }}>
                        <button
                          type="button"
                          disabled={isSaving || draft.uploading}
                          onClick={() => handleSaveSubmission(task, false)}
                          style={{
                            padding: '9px 18px',
                            borderRadius: 10,
                            background: '#f3f4f6',
                            color: '#374151',
                            fontSize: 14,
                            fontWeight: 600,
                            cursor: isSaving ? 'not-allowed' : 'pointer',
                            border: '1px solid #d1d5db',
                          }}
                        >
                          💾 Lưu nháp
                        </button>

                        <button
                          type="button"
                          disabled={isSaving || draft.uploading}
                          onClick={() => handleSaveSubmission(task, true)}
                          style={{
                            padding: '9px 22px',
                            borderRadius: 10,
                            background: isCompleted ? '#15803d' : 'var(--primary)',
                            color: 'white',
                            fontSize: 14,
                            fontWeight: 700,
                            cursor: isSaving ? 'not-allowed' : 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                          }}
                        >
                          {isSaving ? (
                            <>
                              <span className="spinner spinner-white" style={{ width: 16, height: 16 }} />
                              <span>Đang lưu...</span>
                            </>
                          ) : isCompleted ? (
                            <>
                              <span>✓</span>
                              <span>Cập nhật hoàn thành</span>
                            </>
                          ) : (
                            <>
                              <span>✓</span>
                              <span>Hoàn thành công việc</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* VIEW: TAB QUẢN LÝ GIAO VIỆC (Management) */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'management' && (
        <div>
          {/* Action & Filter Bar */}
          <div
            style={{
              background: 'white',
              borderRadius: 16,
              padding: 20,
              boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
              border: '1px solid var(--border)',
              marginBottom: 24,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 16 }}>
              {/* Filter Date Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Lọc theo ngày:</span>
                <button
                  onClick={() => setFilterDateMode('all')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    background: filterDateMode === 'all' ? 'var(--primary)' : '#f3f4f6',
                    color: filterDateMode === 'all' ? 'white' : '#4b5563',
                  }}
                >
                  Tất cả
                </button>
                <button
                  onClick={() => setFilterDateMode('today')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    background: filterDateMode === 'today' ? 'var(--primary)' : '#f3f4f6',
                    color: filterDateMode === 'today' ? 'white' : '#4b5563',
                  }}
                >
                  Hôm nay
                </button>
                <button
                  onClick={() => setFilterDateMode('tomorrow')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    background: filterDateMode === 'tomorrow' ? 'var(--primary)' : '#f3f4f6',
                    color: filterDateMode === 'tomorrow' ? 'white' : '#4b5563',
                  }}
                >
                  Ngày mai
                </button>
                <input
                  type="date"
                  value={filterCustomDate}
                  onChange={(e) => {
                    setFilterCustomDate(e.target.value);
                    setFilterDateMode('custom');
                  }}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    fontSize: 13,
                    outline: 'none',
                  }}
                />
              </div>

              {/* + Giao việc mới button */}
              <button
                onClick={() => {
                  resetCreateForm();
                  setShowCreateModal(true);
                }}
                style={{
                  background: 'var(--primary)',
                  color: 'white',
                  padding: '10px 20px',
                  borderRadius: 12,
                  fontSize: 14,
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
                }}
              >
                <span>➕</span>
                <span>Giao việc mới</span>
              </button>
            </div>

            {/* Sub-row: Status Filter & Search */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Trạng thái:</span>
                {(['all', 'active', 'completed', 'cancelled'] as const).map((st) => {
                  const labels = {
                    all: 'Tất cả',
                    active: 'Đang hoạt động',
                    completed: 'Đã hoàn thành',
                    cancelled: 'Đã huỷ',
                  };
                  return (
                    <button
                      key={st}
                      onClick={() => setFilterStatus(st)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 600,
                        background: filterStatus === st ? '#1f2937' : '#f3f4f6',
                        color: filterStatus === st ? 'white' : '#4b5563',
                      }}
                    >
                      {labels[st]}
                    </button>
                  );
                })}
              </div>

              {/* Search box */}
              <div style={{ minWidth: 240 }}>
                <input
                  type="text"
                  placeholder="🔍 Tìm theo tiêu đề hoặc mô tả..."
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 14px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    fontSize: 13,
                    outline: 'none',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Task Grid / Cards */}
          {filteredTasks.length === 0 ? (
            <div
              style={{
                background: 'white',
                borderRadius: 16,
                padding: '60px 20px',
                textAlign: 'center',
                border: '1px dashed var(--border)',
                color: 'var(--text-secondary)',
              }}
            >
              <div style={{ fontSize: 44, marginBottom: 12 }}>📋</div>
              <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                Không tìm thấy công việc nào
              </h3>
              <p style={{ fontSize: 14 }}>
                Bấm nút <strong>&quot;+ Giao việc mới&quot;</strong> để tạo nhiệm vụ cho nhân viên hoặc toàn bộ cửa hàng.
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16 }}>
              {filteredTasks.map((task) => {
                const isAllStore = task.targetType === 'allStore';

                return (
                  <div
                    key={task.id}
                    style={{
                      background: 'white',
                      borderRadius: 14,
                      border: '1px solid var(--border)',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                      padding: 18,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      transition: 'transform 0.15s, box-shadow 0.15s',
                    }}
                  >
                    <div>
                      {/* Top badges */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: 6,
                            background: isAllStore ? '#dbeafe' : '#fef3c7',
                            color: isAllStore ? '#1e40af' : '#92400e',
                          }}
                        >
                          {isAllStore ? '🏪 Toàn cửa hàng' : `👤 ${task.assignedNames?.length || 0} nhân sự`}
                        </span>

                        <div style={{ display: 'flex', gap: 4 }}>
                          {task.requirePhoto && (
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 600,
                                padding: '3px 6px',
                                borderRadius: 6,
                                background: '#f3e8ff',
                                color: '#6b21a8',
                              }}
                              title="Bắt buộc chụp ảnh minh chứng"
                            >
                              📸 Bắt buộc ảnh
                            </span>
                          )}
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              padding: '3px 8px',
                              borderRadius: 6,
                              background: task.status === 'active' ? '#dcfce7' : '#f3f4f6',
                              color: task.status === 'active' ? '#15803d' : '#6b7280',
                            }}
                          >
                            {task.status === 'active' ? 'Đang chạy' : task.status}
                          </span>
                        </div>
                      </div>

                      {/* Title & Desc */}
                      <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6, lineHeight: 1.4 }}>
                        {task.title}
                      </h3>
                      {task.description && (
                        <p style={{ fontSize: 13, color: '#4b5563', marginBottom: 12, lineHeight: 1.5 }}>
                          {task.description}
                        </p>
                      )}

                      {/* Target members preview if individual */}
                      {!isAllStore && task.assignedNames && task.assignedNames.length > 0 && (
                        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 10 }}>
                          <strong>Giao cho:</strong> {task.assignedNames.join(', ')}
                        </div>
                      )}

                      {/* Dates chips */}
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                          Ngày thực hiện ({task.executionDates?.length || 0} ngày):
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {task.executionDates?.map((d) => (
                            <span
                              key={d}
                              style={{
                                fontSize: 11,
                                background: d === todayStr ? 'var(--primary-light)' : '#f3f4f6',
                                color: d === todayStr ? 'var(--primary)' : '#4b5563',
                                fontWeight: d === todayStr ? 700 : 500,
                                padding: '2px 6px',
                                borderRadius: 4,
                              }}
                            >
                              {d === todayStr ? `🔥 Hôm nay (${d})` : d}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: '#9ca3af' }}>
                        Tạo bởi: {task.createdByName}
                      </span>

                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          type="button"
                          onClick={() => setDetailTask(task)}
                          style={{
                            background: '#eff6ff',
                            color: '#1d4ed8',
                            padding: '6px 12px',
                            borderRadius: 8,
                            fontSize: 12,
                            fontWeight: 700,
                          }}
                        >
                          👁️ Xem báo cáo
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTask(task.id, task.title)}
                          style={{
                            background: '#fef2f2',
                            color: '#dc2626',
                            padding: '6px 10px',
                            borderRadius: 8,
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                          title="Xoá việc này"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODAL: TẠO CÔNG VIỆC MỚI */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 620, maxHeight: '90vh', overflowY: 'auto' }}
          >
            <div className="modal-header">
              <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>➕</span>
                <span>Giao công việc mới</span>
              </div>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}>✕</button>
            </div>

            <form onSubmit={handleCreateTaskSubmit} style={{ padding: '16px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Tiêu đề */}
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: 14, marginBottom: 6 }}>
                  Tiêu đề công việc <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Vệ sinh máy pha cafe cuối ca, Kiểm kê kho..."
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    fontSize: 14,
                    outline: 'none',
                  }}
                />
              </div>

              {/* Mô tả chi tiết */}
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: 14, marginBottom: 6 }}>
                  Mô tả chi tiết / Hướng dẫn thực hiện
                </label>
                <textarea
                  rows={3}
                  placeholder="Mô tả cụ thể các bước nhân viên cần làm, vị trí kiểm tra..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    fontSize: 14,
                    outline: 'none',
                  }}
                />
              </div>

              {/* Ngày thực hiện (Linh hoạt chọn nhiều ngày) */}
              <div style={{ background: '#f9fafb', padding: 14, borderRadius: 12, border: '1px solid #e5e7eb' }}>
                <label style={{ display: 'block', fontWeight: 700, fontSize: 14, marginBottom: 6, color: 'var(--text-primary)' }}>
                  📅 Ngày thực hiện: <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 10 }}>
                  Bạn có thể chọn một hoặc nhiều ngày trong tương lai (Hôm nay, Ngày mai, Chủ Nhật, Thứ 4...).
                </p>

                {/* Quick Add Buttons */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                  {getUpcomingDays().map((day) => {
                    const isSelected = newDates.includes(day.dateStr);
                    return (
                      <button
                        key={day.dateStr}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            handleRemoveDateFromNewTask(day.dateStr);
                          } else {
                            handleAddDateToNewTask(day.dateStr);
                          }
                        }}
                        style={{
                          padding: '5px 10px',
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          background: isSelected ? 'var(--primary)' : '#e5e7eb',
                          color: isSelected ? 'white' : '#374151',
                          cursor: 'pointer',
                        }}
                      >
                        {isSelected ? '✓ ' : '+ '}
                        {day.label}
                      </button>
                    );
                  })}
                </div>

                {/* Or Custom Date picker */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                  <input
                    type="date"
                    value={customAddDate}
                    onChange={(e) => setCustomAddDate(e.target.value)}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 6,
                      border: '1px solid var(--border)',
                      fontSize: 13,
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (customAddDate) {
                        handleAddDateToNewTask(customAddDate);
                        setCustomAddDate('');
                      }
                    }}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 6,
                      background: '#1f2937',
                      color: 'white',
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    + Thêm ngày tùy chọn
                  </button>
                </div>

                {/* Selected Dates Chips */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#4b5563', marginBottom: 4 }}>
                    Các ngày đã chọn ({newDates.length}):
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {newDates.map((d) => (
                      <span
                        key={d}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          background: 'white',
                          border: '1px solid var(--border)',
                          padding: '3px 8px',
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                        }}
                      >
                        <span>{d}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveDateFromNewTask(d)}
                          style={{
                            background: 'none',
                            color: '#ef4444',
                            fontWeight: 700,
                            padding: 0,
                            cursor: 'pointer',
                            fontSize: 12,
                          }}
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Đối tượng nhận việc */}
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: 14, marginBottom: 8 }}>
                  👥 Đối tượng nhận việc:
                </label>
                <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 14 }}>
                    <input
                      type="radio"
                      name="targetType"
                      checked={newTargetType === 'allStore'}
                      onChange={() => setNewTargetType('allStore')}
                    />
                    <strong>Toàn bộ cửa hàng</strong> (Mọi nhân sự & quản lý)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 14 }}>
                    <input
                      type="radio"
                      name="targetType"
                      checked={newTargetType === 'individual'}
                      onChange={() => setNewTargetType('individual')}
                    />
                    <strong>Chỉ định cá nhân / nhóm</strong>
                  </label>
                </div>

                {/* Member selection if individual */}
                {newTargetType === 'individual' && (
                  <div
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: 10,
                      padding: 12,
                      maxHeight: 180,
                      overflowY: 'auto',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, borderBottom: '1px solid #f3f4f6', paddingBottom: 6 }}>
                      <span>Chọn thành viên ({selectedMemberIds.length}/{members.length}):</span>
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedMemberIds.length === members.length) {
                            setSelectedMemberIds([]);
                          } else {
                            setSelectedMemberIds(members.map((m) => m.userId));
                          }
                        }}
                        style={{ background: 'none', color: '#2563eb', fontWeight: 600, cursor: 'pointer' }}
                      >
                        {selectedMemberIds.length === members.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                      </button>
                    </div>

                    {members.map((m) => {
                      const isChecked = selectedMemberIds.includes(m.userId);
                      return (
                        <label
                          key={m.userId}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '4px 6px',
                            borderRadius: 6,
                            cursor: 'pointer',
                            background: isChecked ? '#f0fdf4' : 'transparent',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedMemberIds((prev) => [...prev, m.userId]);
                                } else {
                                  setSelectedMemberIds((prev) => prev.filter((id) => id !== m.userId));
                                }
                              }}
                            />
                            <span style={{ fontSize: 13, fontWeight: 500 }}>
                              {m.name || m.userId}
                            </span>
                          </div>
                          <span
                            style={{
                              fontSize: 11,
                              padding: '2px 6px',
                              borderRadius: 4,
                              background: '#e5e7eb',
                              color: '#374151',
                            }}
                          >
                            {getRoleLabel(m.role)}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Bắt buộc chụp ảnh switch */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0' }}>
                <input
                  type="checkbox"
                  id="requirePhotoSwitch"
                  checked={newRequirePhoto}
                  onChange={(e) => setNewRequirePhoto(e.target.checked)}
                  style={{ width: 18, height: 18, cursor: 'pointer' }}
                />
                <label htmlFor="requirePhotoSwitch" style={{ fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                  📸 Bắt buộc nhân viên phải chụp ảnh minh chứng trước khi bấm Hoàn thành
                </label>
              </div>

              {/* Form Buttons */}
              <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                >
                  Huỷ
                </button>
                <button
                  type="submit"
                  disabled={creatingTask}
                  style={{
                    background: 'var(--primary)',
                    color: 'white',
                    padding: '10px 22px',
                    borderRadius: 10,
                    fontWeight: 700,
                    fontSize: 14,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  {creatingTask ? (
                    <>
                      <span className="spinner spinner-white" style={{ width: 16, height: 16 }} />
                      <span>Đang tạo việc...</span>
                    </>
                  ) : (
                    'Tạo & Giao việc'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODAL: XEM CHI TIẾT BÁO CÁO CÔNG VIỆC (Task Details & Submissions) */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {detailTask && (
        <TaskSubmissionsModal
          storeId={storeId!}
          task={detailTask}
          members={members}
          todayStr={todayStr}
          onClose={() => setDetailTask(null)}
          onOpenLightbox={(url) => setLightboxImg(url)}
        />
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODAL: LIGHTBOX XEM ẢNH FULL SIZE */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {lightboxImg && (
        <div
          className="modal-overlay"
          onClick={() => setLightboxImg(null)}
          style={{ zIndex: 9999, background: 'rgba(0,0,0,0.85)' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              maxWidth: '90vw',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <button
              onClick={() => setLightboxImg(null)}
              style={{
                position: 'absolute',
                top: -40,
                right: 0,
                background: 'white',
                border: 'none',
                borderRadius: '50%',
                width: 36,
                height: 36,
                fontSize: 18,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              ✕
            </button>
            <img
              src={lightboxImg}
              alt="Ảnh minh chứng phóng to"
              style={{
                maxWidth: '100%',
                maxHeight: '85vh',
                objectFit: 'contain',
                borderRadius: 8,
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENT: TASK SUBMISSIONS MODAL
// ────────────────────────────────────────────────────────────────────────────
function TaskSubmissionsModal({
  storeId,
  task,
  members,
  todayStr,
  onClose,
  onOpenLightbox,
}: {
  storeId: string;
  task: AssignedTask;
  members: Member[];
  todayStr: string;
  onClose: () => void;
  onOpenLightbox: (url: string) => void;
}) {
  const [selectedDate, setSelectedDate] = useState<string>(
    task.executionDates?.includes(todayStr) ? todayStr : task.executionDates?.[0] || todayStr
  );
  const [submissions, setSubmissions] = useState<TaskSubmission[]>([]);

  // Watch submissions for this task
  useEffect(() => {
    if (!storeId || !task.id) return;
    const unsub = watchTaskSubmissions(
      storeId,
      task.id,
      (subs) => {
        setSubmissions(subs);
      },
      selectedDate
    );
    return unsub;
  }, [storeId, task.id, selectedDate]);

  // Determine list of target members for this date
  const targetMembers = useMemo(() => {
    if (task.targetType === 'allStore') {
      return members;
    }
    return members.filter((m) => task.assignedUserIds?.includes(m.userId));
  }, [task, members]);

  // Map each member to their submission
  const memberStatusList = useMemo(() => {
    return targetMembers.map((m) => {
      const sub = submissions.find((s) => s.userId === m.userId);
      return {
        member: m,
        sub,
        isCompleted: sub?.isCompleted === true,
      };
    });
  }, [targetMembers, submissions]);

  const completedCount = memberStatusList.filter((m) => m.isCompleted).length;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 680, maxHeight: '90vh', overflowY: 'auto' }}
      >
        <div className="modal-header">
          <div className="modal-title">
            <span>📋 Báo cáo công việc: {task.title}</span>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div style={{ padding: '16px 0' }}>
          {/* Info Header */}
          <div style={{ background: '#f9fafb', borderRadius: 12, padding: 14, marginBottom: 16 }}>
            {task.description && (
              <p style={{ fontSize: 14, color: '#4b5563', marginBottom: 10 }}>{task.description}</p>
            )}

            {/* Date filter dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Xem ngày:</span>
                <select
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  {task.executionDates?.map((d) => (
                    <option key={d} value={d}>
                      {d} {d === todayStr ? '(Hôm nay)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ fontSize: 13, fontWeight: 700, color: completedCount === targetMembers.length && targetMembers.length > 0 ? '#15803d' : '#b45309' }}>
                Đã nộp: {completedCount}/{targetMembers.length} nhân sự
              </div>
            </div>
          </div>

          {/* Member Submissions List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {memberStatusList.map(({ member, sub, isCompleted }) => (
              <div
                key={member.userId}
                style={{
                  border: isCompleted ? '1.5px solid #86efac' : '1px solid #e5e7eb',
                  borderRadius: 12,
                  padding: 14,
                  background: isCompleted ? '#f0fdf4' : '#ffffff',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
                      {member.name || member.userId}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: '#e5e7eb',
                        color: '#374151',
                      }}
                    >
                      {getRoleLabel(member.role)}
                    </span>
                  </div>

                  <div>
                    {isCompleted ? (
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: '#15803d',
                          background: '#dcfce7',
                          padding: '4px 10px',
                          borderRadius: 12,
                        }}
                      >
                        ✓ Đã hoàn thành
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: '#b45309',
                          background: '#fef3c7',
                          padding: '4px 10px',
                          borderRadius: 12,
                        }}
                      >
                        ⏳ Chưa nộp / Chưa xong
                      </span>
                    )}
                  </div>
                </div>

                {/* Report Content */}
                {sub ? (
                  <div style={{ marginTop: 6 }}>
                    {sub.reportText ? (
                      <div
                        style={{
                          fontSize: 13,
                          color: '#374151',
                          background: 'white',
                          padding: '8px 12px',
                          borderRadius: 8,
                          border: '1px solid #e5e7eb',
                          marginBottom: 8,
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        {sub.reportText}
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic', marginBottom: 8 }}>
                        (Không có nội dung văn bản)
                      </div>
                    )}

                    {/* Photos */}
                    {sub.photoUrls && sub.photoUrls.length > 0 && (
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {sub.photoUrls.map((url, idx) => (
                          <img
                            key={url}
                            src={url}
                            alt={`Báo cáo ${idx + 1}`}
                            onClick={() => onOpenLightbox(url)}
                            style={{
                              width: 64,
                              height: 64,
                              objectFit: 'cover',
                              borderRadius: 8,
                              border: '1px solid #d1d5db',
                              cursor: 'zoom-in',
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: '#9ca3af', fontStyle: 'italic', marginTop: 4 }}>
                    Chưa có hoạt động báo cáo nào cho ngày này.
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
