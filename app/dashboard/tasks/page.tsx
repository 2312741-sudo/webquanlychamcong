'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useApp } from '../layout';
import {
  createTask,
  updateTask,
  deleteTask,
  watchStoreTasks,
  filterTasksForUserOnDate,
  getTasksForUserOnDate,
  watchTaskSubmissions,
  saveTaskSubmission,
  uploadTaskPhotoWeb,
  getVietnamDateString,
  watchWeekSchedule,
} from '@/lib/firestore';
import {
  AssignedTask,
  TaskSubmission,
  TaskTargetType,
  TaskStatus,
  Member,
  Store,
  ScheduleModel,
  getRoleLabel,
  normalizeRole,
} from '@/lib/types';
import {
  getMondayOfWeek,
  getUserIdsInDepartmentOnDate,
  isDateMatchingTask,
} from '@/lib/departmentUtils';

export default function TasksPage() {
  const { storeId, store, members, currentMember, user, role } = useApp();
  const normalizedRole = normalizeRole(role);
  const isManagerOrOwner = ['owner', 'manager1', 'manager2'].includes(normalizedRole);

  const todayStr = useMemo(() => getVietnamDateString(), []);

  // Tabs: 'my_tasks' | 'management'
  const [activeTab, setActiveTab] = useState<'my_tasks' | 'management'>(
    isManagerOrOwner ? 'management' : 'my_tasks'
  );

  // ── Store-wide Tasks Listener (Realtime in-memory cache for 0ms date switching) ──
  const [allTasks, setAllTasks] = useState<AssignedTask[]>([]);
  const [tasksLoaded, setTasksLoaded] = useState<boolean>(false);

  useEffect(() => {
    if (!storeId) return;
    const unsub = watchStoreTasks(storeId, (tasks) => {
      setAllTasks(tasks);
      setTasksLoaded(true);
    });
    return unsub;
  }, [storeId]);

  // Week schedules cache by weekStart (e.g. '2026-10-19')
  const [weekSchedules, setWeekSchedules] = useState<Record<string, ScheduleModel | null>>({});

  // ──────────────────────────────────────────────────────────────────────────
  // TAB 1: VIỆC CỦA TÔI TRONG CA (My Tasks)
  // ──────────────────────────────────────────────────────────────────────────
  const [selectedMyDate, setSelectedMyDate] = useState<string>(todayStr);
  const [mySubmissions, setMySubmissions] = useState<Record<string, TaskSubmission>>({});

  // Form drafts for reporting each task: { [taskId]: { text: string, photos: string[], uploading: boolean } }
  const [taskDrafts, setTaskDrafts] = useState<
    Record<string, { text: string; photos: string[]; uploading: boolean }>
  >({});
  const [savingTaskId, setSavingTaskId] = useState<string | null>(null);

  // Subscribe to week schedule for selected date if not yet loaded
  const currentWeekStart = useMemo(() => getMondayOfWeek(selectedMyDate), [selectedMyDate]);
  useEffect(() => {
    if (!storeId || !currentWeekStart) return;
    if (weekSchedules[currentWeekStart] !== undefined) return;
    const unsub = watchWeekSchedule(storeId, currentWeekStart, (sched) => {
      setWeekSchedules((prev) => ({ ...prev, [currentWeekStart]: sched }));
    });
    return unsub;
  }, [storeId, currentWeekStart, weekSchedules]);

  // Pure in-memory filtering: 0ms instant response when switching dates!
  const myTasks = useMemo(() => {
    if (!user) return [];
    return filterTasksForUserOnDate({
      tasks: allTasks,
      userId: user.uid,
      dateStr: selectedMyDate,
      userDepartment: currentMember?.department,
      schedule: weekSchedules[currentWeekStart] ?? null,
      storeDepartments: store?.departments,
    });
  }, [allTasks, user, selectedMyDate, currentMember?.department, weekSchedules, currentWeekStart, store?.departments]);

  const loadingMyTasks = !tasksLoaded;

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
  const [filterDateMode, setFilterDateMode] = useState<'all' | 'today' | 'tomorrow' | 'custom'>('all');
  const [filterCustomDate, setFilterCustomDate] = useState<string>(todayStr);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'completed' | 'cancelled'>('all');
  const [searchKeyword, setSearchKeyword] = useState<string>('');

  // Filtered tasks using isDateMatchingTask (supports repeatDaily & repeatDaysOfWeek)
  const filteredTasks = useMemo(() => {
    let result = allTasks;

    // Filter date
    if (filterDateMode === 'today') {
      result = result.filter((t) => isDateMatchingTask(todayStr, t));
    } else if (filterDateMode === 'tomorrow') {
      const tom = new Date();
      tom.setDate(tom.getDate() + 1);
      const tomStr = getVietnamDateString(tom);
      result = result.filter((t) => isDateMatchingTask(tomStr, t));
    } else if (filterDateMode === 'custom' && filterCustomDate) {
      result = result.filter((t) => isDateMatchingTask(filterCustomDate, t));
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
  const [editingTask, setEditingTask] = useState<AssignedTask | null>(null);
  const [detailTask, setDetailTask] = useState<AssignedTask | null>(null);
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);

  // ── Create Task Form State ──
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  // Recurrence mode: 0: Ngày cụ thể, 1: Lặp mỗi ngày, 2: Lặp theo thứ hàng tuần
  const [newRepeatMode, setNewRepeatMode] = useState<number>(0);
  const [newRepeatDaysOfWeek, setNewRepeatDaysOfWeek] = useState<number[]>([]);
  const [newDates, setNewDates] = useState<string[]>([todayStr]);
  const [customAddDate, setCustomAddDate] = useState<string>('');
  const [newTargetType, setNewTargetType] = useState<TaskTargetType>('allStore');
  const [newDepartmentIds, setNewDepartmentIds] = useState<string[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [newRequirePhoto, setNewRequirePhoto] = useState<boolean>(false);
  const [creatingTask, setCreatingTask] = useState<boolean>(false);

  const resetCreateForm = () => {
    setNewTitle('');
    setNewDescription('');
    setNewRepeatMode(0);
    setNewRepeatDaysOfWeek([]);
    setNewDates([todayStr]);
    setCustomAddDate('');
    setNewTargetType('allStore');
    setNewDepartmentIds([]);
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

  const handleToggleDayOfWeek = (day: number) => {
    setNewRepeatDaysOfWeek((prev) => {
      if (prev.includes(day)) {
        return prev.filter((d) => d !== day);
      } else {
        return [...prev, day].sort((a, b) => a - b);
      }
    });
  };

  const handleCreateTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeId || !user) return;
    if (!newTitle.trim()) {
      alert('Vui lòng nhập tiêu đề công việc');
      return;
    }

    const isRepeatDaily = newRepeatMode === 1;
    const isRepeatDaysOfWeek = newRepeatMode === 2;
    const sortedDaysOfWeek = isRepeatDaysOfWeek ? [...newRepeatDaysOfWeek].sort((a, b) => a - b) : [];

    if (newRepeatMode === 0 && newDates.length === 0) {
      alert('Vui lòng chọn ít nhất 1 ngày thực hiện');
      return;
    }

    if (isRepeatDaysOfWeek && sortedDaysOfWeek.length === 0) {
      alert('Vui lòng chọn ít nhất một thứ trong tuần để lặp lại');
      return;
    }

    if (newTargetType === 'individual' && selectedMemberIds.length === 0) {
      alert('Vui lòng chọn ít nhất 1 thành viên nhận việc');
      return;
    }
    if (newTargetType === 'department' && newDepartmentIds.length === 0) {
      alert('Vui lòng chọn ít nhất một bộ phận nhận việc');
      return;
    }

    // Generate fallback executionDates for next 60 days
    const finalDates: string[] = [];
    const base = new Date();
    if (isRepeatDaysOfWeek) {
      for (let i = 0; i < 60; i++) {
        const d = new Date(base);
        d.setDate(base.getDate() + i);
        const jsDay = d.getDay();
        const isoDay = jsDay === 0 ? 7 : jsDay;
        if (sortedDaysOfWeek.includes(isoDay)) {
          finalDates.push(getVietnamDateString(d));
        }
      }
    } else if (isRepeatDaily) {
      for (let i = 0; i < 60; i++) {
        const d = new Date(base);
        d.setDate(base.getDate() + i);
        finalDates.push(getVietnamDateString(d));
      }
    } else {
      finalDates.push(...newDates);
    }

    setCreatingTask(true);
    try {
      let assignedNames: string[] = [];
      let assignedUserIds: string[] = [];
      const selectedDeptNames: string[] = [];

      if (newTargetType === 'allStore') {
        assignedNames = ['Toàn bộ cửa hàng'];
        assignedUserIds = [];
      } else if (newTargetType === 'department') {
        const depts = store?.departments || [];
        for (const dId of newDepartmentIds) {
          const d = depts.find((dept: any) => dept.id === dId);
          if (d) selectedDeptNames.push(d.name);
        }

        const deptMembers = members.filter((m) => {
          if (!m.department || !m.department.trim()) return false;
          const mDept = m.department.trim().toLowerCase();
          return newDepartmentIds.some((dId) => {
            const d = depts.find((dept: any) => dept.id === dId);
            if (!d) return false;
            const sId = d.id.trim().toLowerCase();
            const sName = d.name.trim().toLowerCase();
            const sShort = d.shortName?.trim().toLowerCase();
            return mDept === sId || mDept === sName || (sShort && mDept === sShort);
          });
        });

        const combinedIds = Array.from(new Set([...deptMembers.map((m) => m.userId), ...selectedMemberIds]));
        assignedUserIds = combinedIds;
        assignedNames = combinedIds.map((uid) => members.find((m) => m.userId === uid)?.name || uid);
      } else {
        assignedUserIds = selectedMemberIds;
        assignedNames = selectedMemberIds.map((uid) => {
          const m = members.find((mem) => mem.userId === uid);
          return m?.name || uid;
        });
      }

      const taskData: Omit<AssignedTask, 'id' | 'createdAt'> = {
        storeId,
        title: newTitle.trim(),
        description: newDescription.trim(),
        createdBy: user.uid,
        createdByName: user.displayName || user.email?.split('@')[0] || 'Quản lý',
        createdByRole: (role as any) || 'manager1',
        targetType: newTargetType,
        assignedUserIds,
        assignedNames,
        executionDates: finalDates,
        repeatDaily: isRepeatDaily,
        repeatDaysOfWeek: sortedDaysOfWeek,
        requirePhoto: newRequirePhoto,
        status: 'active',
        ...(newTargetType === 'department'
          ? {
              targetDepartmentId: newDepartmentIds[0] || '',
              targetDepartmentName: selectedDeptNames[0] || '',
              targetDepartmentIds: newDepartmentIds,
              targetDepartmentNames: selectedDeptNames,
            }
          : {}),
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
                          {task.repeatDaily ? (
                            <span
                              style={{
                                background: '#ecfdf5',
                                color: '#047857',
                                fontSize: 12,
                                fontWeight: 700,
                                padding: '3px 8px',
                                borderRadius: 6,
                              }}
                            >
                              🔁 Lặp mỗi ngày
                            </span>
                          ) : task.repeatDaysOfWeek && task.repeatDaysOfWeek.length > 0 ? (
                            <span
                              style={{
                                background: '#ecfdf5',
                                color: '#047857',
                                fontSize: 12,
                                fontWeight: 700,
                                padding: '3px 8px',
                                borderRadius: 6,
                              }}
                            >
                              🗓️ Lặp thứ {task.repeatDaysOfWeek.map(d => d === 7 ? 'CN' : `T${d + 1}`).join(', ')}
                            </span>
                          ) : null}
                          {task.targetType === 'department' && (
                            <span
                              style={{
                                background: '#ede9fe',
                                color: '#6d28d9',
                                fontSize: 12,
                                fontWeight: 600,
                                padding: '3px 8px',
                                borderRadius: 6,
                              }}
                            >
                              🏢 {(task.targetDepartmentNames && task.targetDepartmentNames.length > 0 ? task.targetDepartmentNames.join(', ') : task.targetDepartmentName) || 'Bộ phận'}
                            </span>
                          )}
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

                          {/* Upload button - strictly camera capture */}
                          <label
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              background: '#fef3c7',
                              color: '#92400e',
                              padding: '7px 14px',
                              borderRadius: 8,
                              fontSize: 13,
                              fontWeight: 600,
                              cursor: draft.uploading ? 'not-allowed' : 'pointer',
                              border: '1px solid #fde68a',
                            }}
                            title="Bắt buộc chụp ảnh trực tiếp tại thời điểm hoàn thành"
                          >
                            <span>📷</span>
                            <span>{draft.uploading ? 'Đang tải ảnh...' : 'Chụp ảnh trực tiếp'}</span>
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              multiple
                              disabled={draft.uploading}
                              style={{ display: 'none' }}
                              onChange={(e) => handleUploadPhoto(task.id, e)}
                            />
                          </label>
                        </div>

                        {/* Locked library notice */}
                        <div
                          style={{
                            padding: '8px 12px',
                            background: '#fffbeb',
                            border: '1px solid #fef3c7',
                            borderRadius: 8,
                            fontSize: 12,
                            color: '#92400e',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            marginBottom: 10,
                          }}
                        >
                          <span>🔒</span>
                          <span>
                            <strong>Đã khóa chọn từ thư viện:</strong> Bắt buộc chụp ảnh trực tiếp từ camera tại thời điểm hoàn thành để xác thực.
                          </span>
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
                const isDept = task.targetType === 'department';

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
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              padding: '3px 8px',
                              borderRadius: 6,
                              background: isAllStore ? '#dbeafe' : isDept ? '#ede9fe' : '#fef3c7',
                              color: isAllStore ? '#1e40af' : isDept ? '#6d28d9' : '#92400e',
                            }}
                          >
                            {isAllStore
                              ? '🏪 Toàn cửa hàng'
                              : isDept
                              ? `🏢 Bộ phận: ${task.targetDepartmentNames && task.targetDepartmentNames.length > 0 ? task.targetDepartmentNames.join(', ') : (task.targetDepartmentName || 'Bộ phận')}`
                              : `👤 ${task.assignedNames?.length || 0} nhân sự`}
                          </span>

                          {task.repeatDaily ? (
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                padding: '3px 8px',
                                borderRadius: 6,
                                background: '#ecfdf5',
                                color: '#047857',
                              }}
                            >
                              🔁 Lặp mỗi ngày
                            </span>
                          ) : task.repeatDaysOfWeek && task.repeatDaysOfWeek.length > 0 ? (
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                padding: '3px 8px',
                                borderRadius: 6,
                                background: '#ecfdf5',
                                color: '#047857',
                              }}
                            >
                              🗓️ Lặp thứ {task.repeatDaysOfWeek.map(d => d === 7 ? 'CN' : `T${d + 1}`).join(', ')}
                            </span>
                          ) : null}
                        </div>

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

                      {/* Target preview */}
                      {isDept && (
                        <div style={{ fontSize: 12, color: '#6d28d9', marginBottom: 10 }}>
                          <strong>Áp dụng cho:</strong> Bộ phận {task.targetDepartmentNames && task.targetDepartmentNames.length > 0 ? task.targetDepartmentNames.join(', ') : task.targetDepartmentName}
                          {task.assignedNames && task.assignedNames.length > 0 && ` (${task.assignedNames.length} nhân viên)`}
                        </div>
                      )}
                      {!isAllStore && !isDept && task.assignedNames && task.assignedNames.length > 0 && (
                        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 10 }}>
                          <strong>Giao cho:</strong> {task.assignedNames.join(', ')}
                        </div>
                      )}

                      {/* Dates chips */}
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                          {task.repeatDaily || (task.repeatDaysOfWeek && task.repeatDaysOfWeek.length > 0) ? 'Lịch thực hiện:' : `Ngày thực hiện (${task.executionDates?.length || 0} ngày):`}
                        </div>
                        {task.repeatDaily ? (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#047857', background: '#ecfdf5', padding: '3px 8px', borderRadius: 6 }}>
                            <span>🔁 Tự động lặp lại mỗi ngày</span>
                          </div>
                        ) : task.repeatDaysOfWeek && task.repeatDaysOfWeek.length > 0 ? (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#047857', background: '#ecfdf5', padding: '3px 8px', borderRadius: 6 }}>
                            <span>🗓️ Lặp vào thứ {task.repeatDaysOfWeek.map(d => d === 7 ? 'CN' : `T${d + 1}`).join(', ')} hàng tuần</span>
                          </div>
                        ) : (
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
                        )}
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
                          onClick={() => setEditingTask(task)}
                          style={{
                            background: '#fef3c7',
                            color: '#b45309',
                            padding: '6px 12px',
                            borderRadius: 8,
                            fontSize: 12,
                            fontWeight: 700,
                            border: '1px solid #fde68a',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                          title="Chỉnh sửa công việc này"
                        >
                          ✏️ Sửa việc
                        </button>
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

              {/* Ngày thực hiện & Lặp lại */}
              <div style={{ background: '#f9fafb', padding: 14, borderRadius: 12, border: '1px solid #e5e7eb' }}>
                <label style={{ display: 'block', fontWeight: 700, fontSize: 14, marginBottom: 8, color: 'var(--text-primary)' }}>
                  📅 Thời gian thực hiện & Lặp lại: <span style={{ color: '#ef4444' }}>*</span>
                </label>

                {/* Segment buttons for repeat mode */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 14 }}>
                  <button
                    type="button"
                    onClick={() => setNewRepeatMode(0)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: newRepeatMode === 0 ? '1.5px solid var(--primary)' : '1px solid #d1d5db',
                      background: newRepeatMode === 0 ? 'var(--primary)' : 'white',
                      color: newRepeatMode === 0 ? 'white' : '#374151',
                    }}
                  >
                    📅 Ngày cụ thể
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewRepeatMode(1)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: newRepeatMode === 1 ? '1.5px solid #10b981' : '1px solid #d1d5db',
                      background: newRepeatMode === 1 ? '#10b981' : 'white',
                      color: newRepeatMode === 1 ? 'white' : '#374151',
                    }}
                  >
                    🔁 Lặp mỗi ngày
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNewRepeatMode(2);
                      if (newRepeatDaysOfWeek.length === 0) {
                        const jsDay = new Date().getDay();
                        setNewRepeatDaysOfWeek([jsDay === 0 ? 7 : jsDay]);
                      }
                    }}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: newRepeatMode === 2 ? '1.5px solid #6366f1' : '1px solid #d1d5db',
                      background: newRepeatMode === 2 ? '#6366f1' : 'white',
                      color: newRepeatMode === 2 ? 'white' : '#374151',
                    }}
                  >
                    🗓️ Lặp theo thứ
                  </button>
                </div>

                {/* Mode 1: Lặp mỗi ngày */}
                {newRepeatMode === 1 && (
                  <div style={{ padding: '12px 14px', background: '#f0fdf4', border: '1px dashed #86efac', borderRadius: 8, fontSize: 13, color: '#166534', lineHeight: 1.5 }}>
                    ✓ <strong>Lặp mỗi ngày:</strong> Công việc sẽ tự động áp dụng cho các ca làm việc hàng ngày (được lập lịch sẵn cho 60 ngày tiếp theo). Nhân viên làm việc ca nào trong ngày đều sẽ nhận được nhiệm vụ.
                  </div>
                )}

                {/* Mode 2: Lặp theo thứ hàng tuần */}
                {newRepeatMode === 2 && (
                  <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 10, padding: 12 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: '#5b21b6', marginBottom: 8 }}>
                      Chọn một hoặc nhiều thứ trong tuần để lặp lại:
                    </div>

                    {/* Day-of-week buttons */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 12 }}>
                      {[
                        { day: 1, label: 'Thứ 2' },
                        { day: 2, label: 'Thứ 3' },
                        { day: 3, label: 'Thứ 4' },
                        { day: 4, label: 'Thứ 5' },
                        { day: 5, label: 'Thứ 6' },
                        { day: 6, label: 'Thứ 7' },
                        { day: 7, label: 'Chủ Nhật' },
                      ].map(({ day, label }) => {
                        const isSelected = newRepeatDaysOfWeek.includes(day);
                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() => handleToggleDayOfWeek(day)}
                            style={{
                              padding: '10px 4px',
                              borderRadius: 8,
                              fontSize: 12.5,
                              fontWeight: 700,
                              cursor: 'pointer',
                              border: isSelected ? '1.5px solid #6366f1' : '1px solid #c7d2fe',
                              background: isSelected ? '#6366f1' : 'white',
                              color: isSelected ? 'white' : '#4338ca',
                              transition: 'all 0.15s ease',
                              textAlign: 'center',
                            }}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Quick Presets */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                      <span style={{ fontSize: 11.5, color: '#6d28d9', fontWeight: 600 }}>Chọn nhanh:</span>
                      {[
                        { label: 'T2, T4, T6', days: [1, 3, 5] },
                        { label: 'T3, T5, T7', days: [2, 4, 6] },
                        { label: 'Cuối tuần (T7, CN)', days: [6, 7] },
                        { label: 'Ngày thường (T2 - T6)', days: [1, 2, 3, 4, 5] },
                        { label: 'Cả tuần', days: [1, 2, 3, 4, 5, 6, 7] },
                      ].map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => setNewRepeatDaysOfWeek(preset.days)}
                          style={{
                            padding: '3px 8px',
                            borderRadius: 6,
                            background: '#ede9fe',
                            color: '#5b21b6',
                            fontSize: 11.5,
                            fontWeight: 600,
                            border: '1px solid #ddd6fe',
                            cursor: 'pointer',
                          }}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>

                    <div style={{ fontSize: 12, color: '#6d28d9', marginTop: 10 }}>
                      ✓ Đã chọn: <strong>{newRepeatDaysOfWeek.length > 0 ? newRepeatDaysOfWeek.map(d => d === 7 ? 'Chủ Nhật' : `Thứ ${d + 1}`).join(', ') : 'Chưa chọn thứ nào'}</strong>. Công việc sẽ tự động xuất hiện vào các ngày này hàng tuần.
                    </div>
                  </div>
                )}

                {/* Mode 0: Ngày cụ thể */}
                {newRepeatMode === 0 && (
                  <>
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
                  </>
                )}
              </div>

              {/* Đối tượng nhận việc */}
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: 14, marginBottom: 8 }}>
                  👥 Đối tượng nhận việc:
                </label>
                <div style={{ display: 'flex', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 14 }}>
                    <input
                      type="radio"
                      name="targetType"
                      checked={newTargetType === 'allStore'}
                      onChange={() => {
                        setNewTargetType('allStore');
                        setNewDepartmentIds([]);
                      }}
                    />
                    <strong>Toàn bộ cửa hàng</strong> (Mọi nhân sự & quản lý)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 14 }}>
                    <input
                      type="radio"
                      name="targetType"
                      checked={newTargetType === 'department'}
                      onChange={() => {
                        setNewTargetType('department');
                        if (newDepartmentIds.length === 0 && store?.departments && store.departments.length > 0) {
                          setNewDepartmentIds([store.departments[0].id]);
                        }
                      }}
                    />
                    <strong>Theo bộ phận</strong>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 14 }}>
                    <input
                      type="radio"
                      name="targetType"
                      checked={newTargetType === 'individual'}
                      onChange={() => {
                        setNewTargetType('individual');
                        setNewDepartmentIds([]);
                      }}
                    />
                    <strong>Chỉ định cá nhân / nhóm</strong>
                  </label>
                </div>

                {/* Department selection (Multi-department support) */}
                {newTargetType === 'department' && (
                  <div
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: 10,
                      padding: 12,
                      background: '#fafafa',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      marginBottom: 12,
                    }}
                  >
                    {(!store?.departments || store.departments.length === 0) ? (
                      <div style={{ fontSize: 13, color: '#b45309', padding: '6px 0' }}>
                        ⚠️ Cửa hàng chưa có danh sách bộ phận. Vui lòng vào Cài đặt cửa hàng để thiết lập bộ phận (ví dụ: Pha chế, Thu ngân, Bếp, Phục vụ...).
                      </div>
                    ) : (
                      <>
                        <div style={{ background: '#ede9fe', color: '#6d28d9', padding: '8px 12px', borderRadius: 8, fontSize: 12, marginBottom: 8, lineHeight: 1.4 }}>
                          💡 <strong>Tự động theo ca:</strong> Cho phép chọn một hoặc NHIỀU bộ phận cùng lúc. Công việc sẽ tự động giao cho các nhân sự có ca làm việc thuộc các bộ phận này theo từng ngày (dựa theo Lịch làm việc tuần / Bộ phận của nhân viên).
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontSize: 12.5, fontWeight: 700, color: '#4b5563' }}>
                            Chọn các bộ phận nhận việc ({newDepartmentIds.length}/{store.departments.length}):
                          </span>
                          {store.departments.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                if (newDepartmentIds.length === store.departments!.length) {
                                  setNewDepartmentIds([]);
                                } else {
                                  setNewDepartmentIds(store.departments!.map((d) => d.id));
                                }
                              }}
                              style={{
                                background: 'none',
                                color: '#2563eb',
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: 'pointer',
                                border: 'none',
                                padding: '2px 4px',
                              }}
                            >
                              {newDepartmentIds.length === store.departments.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                            </button>
                          )}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
                          {store.departments.map((dept) => {
                            const isSelected = newDepartmentIds.includes(dept.id);
                            const deptMembers = members.filter(
                              (m) => m.department && (
                                m.department.trim().toLowerCase() === dept.id.trim().toLowerCase() ||
                                m.department.trim().toLowerCase() === dept.name.trim().toLowerCase() ||
                                (dept.shortName && m.department.trim().toLowerCase() === dept.shortName.trim().toLowerCase())
                              )
                            );
                            return (
                              <label
                                key={dept.id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '10px 12px',
                                  borderRadius: 8,
                                  cursor: 'pointer',
                                  border: isSelected ? '1.5px solid #2563eb' : '1px solid #e5e7eb',
                                  background: isSelected ? '#eff6ff' : 'white',
                                  transition: 'all 0.15s ease',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setNewDepartmentIds((prev) => [...prev, dept.id]);
                                      } else {
                                        setNewDepartmentIds((prev) => prev.filter((id) => id !== dept.id));
                                      }
                                    }}
                                  />
                                  <div>
                                    <span style={{ fontWeight: 600, fontSize: 13.5, color: isSelected ? '#1e40af' : '#1f2937' }}>
                                      {dept.name}
                                    </span>
                                    {dept.shortName && (
                                      <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 4 }}>
                                        ({dept.shortName})
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <span
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 600,
                                    padding: '2px 8px',
                                    borderRadius: 10,
                                    background: isSelected ? '#dbeafe' : '#f3f4f6',
                                    color: isSelected ? '#1e40af' : '#4b5563',
                                  }}
                                >
                                  {deptMembers.length} NV
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                )}

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
          store={store}
          task={detailTask}
          members={members}
          todayStr={todayStr}
          onClose={() => setDetailTask(null)}
          onOpenLightbox={(url) => setLightboxImg(url)}
          onEditTask={(task) => {
            setDetailTask(null);
            setEditingTask(task);
          }}
        />
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODAL: CHỈNH SỬA CÔNG VIỆC (Edit Task) */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {editingTask && (
        <EditTaskModal
          storeId={storeId!}
          task={editingTask}
          members={members}
          store={store}
          todayStr={todayStr}
          onClose={() => setEditingTask(null)}
          onSuccess={() => setEditingTask(null)}
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
  store,
  task,
  members,
  todayStr,
  onClose,
  onOpenLightbox,
  onEditTask,
}: {
  storeId: string;
  store?: Store | null;
  task: AssignedTask;
  members: Member[];
  todayStr: string;
  onClose: () => void;
  onOpenLightbox: (url: string) => void;
  onEditTask?: (task: AssignedTask) => void;
}) {
  const [selectedDate, setSelectedDate] = useState<string>(
    task.executionDates?.includes(todayStr) ? todayStr : task.executionDates?.[0] || todayStr
  );
  const [submissions, setSubmissions] = useState<TaskSubmission[]>([]);
  const [schedule, setSchedule] = useState<ScheduleModel | null>(null);

  // Watch week schedule of the week containing selectedDate
  useEffect(() => {
    if (!storeId || !selectedDate) return;
    const weekStart = getMondayOfWeek(selectedDate);
    const unsub = watchWeekSchedule(storeId, weekStart, (sched) => {
      setSchedule(sched);
    });
    return unsub;
  }, [storeId, selectedDate]);

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

  // Determine list of target members for this date (dynamic based on schedule & department)
  const targetMembers = useMemo(() => {
    if (task.targetType === 'allStore') {
      return members;
    }
    if (task.targetType === 'department') {
      const deptMemberIds = getUserIdsInDepartmentOnDate({
        dateStr: selectedDate,
        targetDeptId: task.targetDepartmentId,
        targetDeptName: task.targetDepartmentName,
        targetDeptIds: task.targetDepartmentIds,
        targetDeptNames: task.targetDepartmentNames,
        allMembers: members,
        schedule,
        storeDepartments: store?.departments,
      });
      const combinedIds = Array.from(new Set([
        ...deptMemberIds,
        ...(task.assignedUserIds || []),
      ]));
      return members.filter((m) => combinedIds.includes(m.userId));
    }
    return members.filter((m) => task.assignedUserIds?.includes(m.userId));
  }, [task, members, selectedDate, schedule, store?.departments]);

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
        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="modal-title">
            <span>📋 Báo cáo công việc: {task.title}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {onEditTask && (
              <button
                type="button"
                onClick={() => onEditTask(task)}
                style={{
                  background: '#fef3c7',
                  color: '#b45309',
                  border: '1px solid #fde68a',
                  padding: '5px 12px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                ✏️ Sửa việc
              </button>
            )}
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>
        </div>

        <div style={{ padding: '16px 0' }}>
          {/* Info Header */}
          <div style={{ background: '#f9fafb', borderRadius: 12, padding: 14, marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {task.targetType === 'allStore' && (
                <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: '#dbeafe', color: '#1e40af' }}>
                  🏪 Toàn cửa hàng
                </span>
              )}
              {task.targetType === 'department' && (
                <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: '#ede9fe', color: '#6d28d9' }}>
                  🏢 Bộ phận: {task.targetDepartmentNames && task.targetDepartmentNames.length > 0 ? task.targetDepartmentNames.join(', ') : (task.targetDepartmentName || 'Bộ phận')}
                </span>
              )}
              {task.targetType === 'individual' && (
                <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: '#fef3c7', color: '#92400e' }}>
                  👤 Chỉ định cá nhân
                </span>
              )}
              {task.repeatDaily ? (
                <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: '#ecfdf5', color: '#047857' }}>
                  🔁 Lặp mỗi ngày
                </span>
              ) : task.repeatDaysOfWeek && task.repeatDaysOfWeek.length > 0 ? (
                <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: '#ecfdf5', color: '#047857' }}>
                  🗓️ Lặp thứ {task.repeatDaysOfWeek.map(d => d === 7 ? 'CN' : `T${d + 1}`).join(', ')} hàng tuần
                </span>
              ) : null}
              {task.requirePhoto && (
                <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6, background: '#f3e8ff', color: '#6b21a8' }}>
                  📸 Bắt buộc ảnh
                </span>
              )}
            </div>
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

// ────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENT: EDIT TASK MODAL
// ────────────────────────────────────────────────────────────────────────────
function EditTaskModal({
  storeId,
  task,
  members,
  store,
  todayStr,
  onClose,
  onSuccess,
}: {
  storeId: string;
  task: AssignedTask;
  members: Member[];
  store: any;
  todayStr: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [title, setTitle] = useState(task.title || '');
  const [description, setDescription] = useState(task.description || '');
  const [status, setStatus] = useState<TaskStatus>(task.status || 'active');
  const [targetType, setTargetType] = useState<TaskTargetType>(task.targetType || 'allStore');
  const [departmentIds, setDepartmentIds] = useState<string[]>(() => {
    if (task.targetDepartmentIds && task.targetDepartmentIds.length > 0) {
      return task.targetDepartmentIds;
    }
    if (task.targetDepartmentId) {
      return [task.targetDepartmentId];
    }
    return [];
  });
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>(task.assignedUserIds || []);
  const [repeatMode, setRepeatMode] = useState<number>(() => {
    if (task.repeatDaily) return 1;
    if (task.repeatDaysOfWeek && task.repeatDaysOfWeek.length > 0) return 2;
    return 0;
  });
  const [repeatDaysOfWeek, setRepeatDaysOfWeek] = useState<number[]>(task.repeatDaysOfWeek || []);
  const [dates, setDates] = useState<string[]>(task.executionDates || [todayStr]);
  const [customAddDate, setCustomAddDate] = useState<string>('');
  const [requirePhoto, setRequirePhoto] = useState<boolean>(task.requirePhoto || false);
  const [saving, setSaving] = useState<boolean>(false);

  const handleAddDate = (dateStr: string) => {
    if (!dateStr) return;
    if (!dates.includes(dateStr)) {
      setDates((prev) => [...prev, dateStr].sort());
    }
  };

  const handleRemoveDate = (dateStr: string) => {
    setDates((prev) => prev.filter((d) => d !== dateStr));
  };

  const handleToggleDayOfWeek = (day: number) => {
    setRepeatDaysOfWeek((prev) => {
      if (prev.includes(day)) {
        return prev.filter((d) => d !== day);
      } else {
        return [...prev, day].sort((a, b) => a - b);
      }
    });
  };

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeId || !task.id) return;

    if (!title.trim()) {
      alert('Vui lòng nhập tiêu đề công việc');
      return;
    }

    const isRepeatDaily = repeatMode === 1;
    const isRepeatDaysOfWeek = repeatMode === 2;
    const sortedDaysOfWeek = isRepeatDaysOfWeek ? [...repeatDaysOfWeek].sort((a, b) => a - b) : [];

    if (repeatMode === 0 && dates.length === 0) {
      alert('Vui lòng chọn ít nhất 1 ngày thực hiện');
      return;
    }

    if (isRepeatDaysOfWeek && sortedDaysOfWeek.length === 0) {
      alert('Vui lòng chọn ít nhất một thứ trong tuần để lặp lại');
      return;
    }

    if (targetType === 'individual' && selectedMemberIds.length === 0) {
      alert('Vui lòng chọn ít nhất 1 thành viên nhận việc');
      return;
    }

    if (targetType === 'department' && departmentIds.length === 0) {
      alert('Vui lòng chọn ít nhất một bộ phận nhận việc');
      return;
    }

    // Generate fallback executionDates for next 60 days
    const finalDates: string[] = [];
    const base = new Date();
    if (isRepeatDaysOfWeek) {
      for (let i = 0; i < 60; i++) {
        const d = new Date(base);
        d.setDate(base.getDate() + i);
        const jsDay = d.getDay();
        const isoDay = jsDay === 0 ? 7 : jsDay;
        if (sortedDaysOfWeek.includes(isoDay)) {
          finalDates.push(getVietnamDateString(d));
        }
      }
    } else if (isRepeatDaily) {
      for (let i = 0; i < 60; i++) {
        const d = new Date(base);
        d.setDate(base.getDate() + i);
        finalDates.push(getVietnamDateString(d));
      }
    } else {
      finalDates.push(...dates);
    }

    setSaving(true);
    try {
      let assignedNames: string[] = [];
      let assignedUserIds: string[] = [];
      const selectedDeptNames: string[] = [];

      if (targetType === 'allStore') {
        assignedNames = ['Toàn bộ cửa hàng'];
        assignedUserIds = [];
      } else if (targetType === 'department') {
        const depts = store?.departments || [];
        for (const dId of departmentIds) {
          const d = depts.find((dept: any) => dept.id === dId);
          if (d) selectedDeptNames.push(d.name);
        }

        const deptMembers = members.filter((m) => {
          if (!m.department || !m.department.trim()) return false;
          const mDept = m.department.trim().toLowerCase();
          return departmentIds.some((dId) => {
            const d = depts.find((dept: any) => dept.id === dId);
            if (!d) return false;
            const sId = d.id.trim().toLowerCase();
            const sName = d.name.trim().toLowerCase();
            const sShort = d.shortName?.trim().toLowerCase();
            return mDept === sId || mDept === sName || (sShort && mDept === sShort);
          });
        });

        const combinedIds = Array.from(new Set([...deptMembers.map((m) => m.userId), ...selectedMemberIds]));
        assignedUserIds = combinedIds;
        assignedNames = combinedIds.map((uid) => members.find((m) => m.userId === uid)?.name || uid);
      } else {
        assignedUserIds = selectedMemberIds;
        assignedNames = selectedMemberIds.map((uid) => {
          const m = members.find((mem) => mem.userId === uid);
          return m?.name || uid;
        });
      }

      const updateData: Partial<AssignedTask> = {
        title: title.trim(),
        description: description.trim(),
        status,
        targetType,
        assignedUserIds,
        assignedNames,
        executionDates: finalDates,
        repeatDaily: isRepeatDaily,
        repeatDaysOfWeek: sortedDaysOfWeek,
        requirePhoto,
        targetDepartmentId: targetType === 'department' ? (departmentIds[0] || '') : '',
        targetDepartmentName: targetType === 'department' ? (selectedDeptNames[0] || '') : '',
        targetDepartmentIds: targetType === 'department' ? departmentIds : [],
        targetDepartmentNames: targetType === 'department' ? selectedDeptNames : [],
      };

      await updateTask(storeId, task.id, updateData);
      alert('✅ Cập nhật công việc thành công!');
      onSuccess();
    } catch (err: any) {
      console.error('Lỗi khi cập nhật công việc:', err);
      alert('Lỗi cập nhật: ' + (err.message || 'Thử lại'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 620, maxHeight: '90vh', overflowY: 'auto' }}
      >
        <div className="modal-header">
          <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>✏️</span>
            <span>Chỉnh sửa công việc: {task.title}</span>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '16px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Trạng thái công việc */}
          <div style={{ background: '#f8fafc', padding: 12, borderRadius: 10, border: '1px solid #e2e8f0' }}>
            <label style={{ display: 'block', fontWeight: 700, fontSize: 13, marginBottom: 8, color: '#1e293b' }}>
              Trạng thái công việc:
            </label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[
                { val: 'active', label: '⚡ Đang thực hiện', color: '#16a34a', bg: '#f0fdf4' },
                { val: 'completed', label: '✓ Đã hoàn thành', color: '#2563eb', bg: '#eff6ff' },
                { val: 'cancelled', label: '✕ Đã hủy', color: '#dc2626', bg: '#fef2f2' },
                { val: 'archived', label: '📁 Lưu trữ', color: '#6b7280', bg: '#f3f4f6' },
              ].map((s) => {
                const isSelected = status === s.val;
                return (
                  <button
                    key={s.val}
                    type="button"
                    onClick={() => setStatus(s.val as TaskStatus)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 8,
                      fontSize: 12.5,
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: isSelected ? `2px solid ${s.color}` : '1px solid #d1d5db',
                      background: isSelected ? s.bg : '#ffffff',
                      color: isSelected ? s.color : '#4b5563',
                    }}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tiêu đề */}
          <div>
            <label style={{ display: 'block', fontWeight: 600, fontSize: 14, marginBottom: 6 }}>
              Tiêu đề công việc <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Nhập tiêu đề công việc..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
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
              placeholder="Mô tả cụ thể các bước nhân viên cần làm..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
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

          {/* Thời gian thực hiện & Lặp lại */}
          <div style={{ background: '#f9fafb', padding: 14, borderRadius: 12, border: '1px solid #e5e7eb' }}>
            <label style={{ display: 'block', fontWeight: 700, fontSize: 14, marginBottom: 8, color: 'var(--text-primary)' }}>
              📅 Thời gian thực hiện & Lặp lại: <span style={{ color: '#ef4444' }}>*</span>
            </label>

            {/* Segment buttons for repeat mode */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 14 }}>
              <button
                type="button"
                onClick={() => setRepeatMode(0)}
                style={{
                  padding: '8px 10px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: repeatMode === 0 ? '1.5px solid var(--primary)' : '1px solid #d1d5db',
                  background: repeatMode === 0 ? 'var(--primary)' : 'white',
                  color: repeatMode === 0 ? 'white' : '#374151',
                }}
              >
                📅 Ngày cụ thể
              </button>
              <button
                type="button"
                onClick={() => setRepeatMode(1)}
                style={{
                  padding: '8px 10px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: repeatMode === 1 ? '1.5px solid #10b981' : '1px solid #d1d5db',
                  background: repeatMode === 1 ? '#10b981' : 'white',
                  color: repeatMode === 1 ? 'white' : '#374151',
                }}
              >
                🔁 Lặp mỗi ngày
              </button>
              <button
                type="button"
                onClick={() => {
                  setRepeatMode(2);
                  if (repeatDaysOfWeek.length === 0) {
                    const jsDay = new Date().getDay();
                    setRepeatDaysOfWeek([jsDay === 0 ? 7 : jsDay]);
                  }
                }}
                style={{
                  padding: '8px 10px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: repeatMode === 2 ? '1.5px solid #6366f1' : '1px solid #d1d5db',
                  background: repeatMode === 2 ? '#6366f1' : 'white',
                  color: repeatMode === 2 ? 'white' : '#374151',
                }}
              >
                🗓️ Lặp theo thứ
              </button>
            </div>

            {/* Mode 1: Lặp mỗi ngày */}
            {repeatMode === 1 && (
              <div style={{ padding: '12px 14px', background: '#f0fdf4', border: '1px dashed #86efac', borderRadius: 8, fontSize: 13, color: '#166534', lineHeight: 1.5 }}>
                ✓ <strong>Lặp mỗi ngày:</strong> Công việc này tự động áp dụng hàng ngày (được lập lịch sẵn cho 60 ngày tiếp theo).
              </div>
            )}

            {/* Mode 2: Lặp theo thứ hàng tuần */}
            {repeatMode === 2 && (
              <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: '#5b21b6', marginBottom: 8 }}>
                  Chọn một hoặc nhiều thứ trong tuần để lặp lại:
                </div>

                {/* Day-of-week buttons */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 12 }}>
                  {[
                    { day: 1, label: 'Thứ 2' },
                    { day: 2, label: 'Thứ 3' },
                    { day: 3, label: 'Thứ 4' },
                    { day: 4, label: 'Thứ 5' },
                    { day: 5, label: 'Thứ 6' },
                    { day: 6, label: 'Thứ 7' },
                    { day: 7, label: 'Chủ Nhật' },
                  ].map(({ day, label }) => {
                    const isSelected = repeatDaysOfWeek.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => handleToggleDayOfWeek(day)}
                        style={{
                          padding: '10px 4px',
                          borderRadius: 8,
                          fontSize: 12.5,
                          fontWeight: 700,
                          cursor: 'pointer',
                          border: isSelected ? '1.5px solid #6366f1' : '1px solid #c7d2fe',
                          background: isSelected ? '#6366f1' : 'white',
                          color: isSelected ? 'white' : '#4338ca',
                          transition: 'all 0.15s ease',
                          textAlign: 'center',
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                {/* Quick Presets */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: 11.5, color: '#6d28d9', fontWeight: 600 }}>Chọn nhanh:</span>
                  {[
                    { label: 'T2, T4, T6', days: [1, 3, 5] },
                    { label: 'T3, T5, T7', days: [2, 4, 6] },
                    { label: 'Cuối tuần (T7, CN)', days: [6, 7] },
                    { label: 'Ngày thường (T2 - T6)', days: [1, 2, 3, 4, 5] },
                    { label: 'Cả tuần', days: [1, 2, 3, 4, 5, 6, 7] },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setRepeatDaysOfWeek(preset.days)}
                      style={{
                        padding: '3px 8px',
                        borderRadius: 6,
                        background: '#ede9fe',
                        color: '#5b21b6',
                        fontSize: 11.5,
                        fontWeight: 600,
                        border: '1px solid #ddd6fe',
                        cursor: 'pointer',
                      }}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <div style={{ fontSize: 12, color: '#6d28d9', marginTop: 10 }}>
                  ✓ Đã chọn: <strong>{repeatDaysOfWeek.length > 0 ? repeatDaysOfWeek.map(d => d === 7 ? 'Chủ Nhật' : `Thứ ${d + 1}`).join(', ') : 'Chưa chọn thứ nào'}</strong>.
                </div>
              </div>
            )}

            {/* Mode 0: Ngày cụ thể */}
            {repeatMode === 0 && (
              <>
                {/* Quick Add Buttons */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                  {getUpcomingDays().map((day) => {
                    const isSelected = dates.includes(day.dateStr);
                    return (
                      <button
                        key={day.dateStr}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            handleRemoveDate(day.dateStr);
                          } else {
                            handleAddDate(day.dateStr);
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

                {/* Custom Date picker */}
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
                        handleAddDate(customAddDate);
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
                    + Thêm ngày
                  </button>
                </div>

                {/* Selected Dates Chips */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#4b5563', marginBottom: 4 }}>
                    Các ngày thực hiện ({dates.length}):
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {dates.map((d) => (
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
                          onClick={() => handleRemoveDate(d)}
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
              </>
            )}
          </div>

          {/* Đối tượng nhận việc */}
          <div>
            <label style={{ display: 'block', fontWeight: 600, fontSize: 14, marginBottom: 8 }}>
              👥 Đối tượng nhận việc:
            </label>
            <div style={{ display: 'flex', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 14 }}>
                <input
                  type="radio"
                  name="editTargetType"
                  checked={targetType === 'allStore'}
                  onChange={() => {
                    setTargetType('allStore');
                    setDepartmentIds([]);
                  }}
                />
                <strong>Toàn bộ cửa hàng</strong>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 14 }}>
                <input
                  type="radio"
                  name="editTargetType"
                  checked={targetType === 'department'}
                  onChange={() => {
                    setTargetType('department');
                    if (departmentIds.length === 0 && store?.departments && store.departments.length > 0) {
                      setDepartmentIds([store.departments[0].id]);
                    }
                  }}
                />
                <strong>Theo bộ phận</strong>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 14 }}>
                <input
                  type="radio"
                  name="editTargetType"
                  checked={targetType === 'individual'}
                  onChange={() => {
                    setTargetType('individual');
                    setDepartmentIds([]);
                  }}
                />
                <strong>Chỉ định cá nhân / nhóm</strong>
              </label>
            </div>

            {/* Department selection (Multi-department support) */}
            {targetType === 'department' && (
              <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 10, padding: 12, marginBottom: 12 }}>
                {!store?.departments || store.departments.length === 0 ? (
                  <div style={{ fontSize: 13, color: '#dc2626' }}>
                    Cửa hàng chưa thiết lập danh sách bộ phận.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ background: '#ede9fe', color: '#6d28d9', padding: '8px 12px', borderRadius: 8, fontSize: 12, lineHeight: 1.4 }}>
                      💡 <strong>Tự động theo ca:</strong> Cho phép chọn một hoặc NHIỀU bộ phận cùng lúc. Công việc sẽ tự động giao cho các nhân sự có ca làm việc thuộc các bộ phận này theo từng ngày (dựa theo Lịch làm việc tuần / Bộ phận của nhân viên).
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: '#4b5563' }}>
                        Chọn các bộ phận nhận việc ({departmentIds.length}/{store.departments.length}):
                      </span>
                      {store.departments.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            if (departmentIds.length === store.departments!.length) {
                              setDepartmentIds([]);
                            } else {
                              setDepartmentIds(store.departments!.map((d: any) => d.id));
                            }
                          }}
                          style={{
                            background: 'none',
                            color: '#2563eb',
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: 'pointer',
                            border: 'none',
                            padding: '2px 4px',
                          }}
                        >
                          {departmentIds.length === store.departments.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                        </button>
                      )}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
                      {store.departments.map((dept: any) => {
                        const isSelected = departmentIds.includes(dept.id);
                        const deptMembers = members.filter(
                          (m) => m.department && (
                            m.department.trim().toLowerCase() === dept.id.trim().toLowerCase() ||
                            m.department.trim().toLowerCase() === dept.name.trim().toLowerCase() ||
                            (dept.shortName && m.department.trim().toLowerCase() === dept.shortName.trim().toLowerCase())
                          )
                        );
                        return (
                          <label
                            key={dept.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '8px 12px',
                              borderRadius: 8,
                              background: isSelected ? '#eff6ff' : '#ffffff',
                              border: isSelected ? '1.5px solid #3b82f6' : '1px solid #e2e8f0',
                              cursor: 'pointer',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setDepartmentIds((prev) => [...prev, dept.id]);
                                  } else {
                                    setDepartmentIds((prev) => prev.filter((id) => id !== dept.id));
                                  }
                                }}
                              />
                              <div>
                                <span style={{ fontWeight: 600, fontSize: 13.5, color: isSelected ? '#1e40af' : '#1f2937' }}>
                                  {dept.name}
                                </span>
                                {dept.shortName && (
                                  <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 4 }}>
                                    ({dept.shortName})
                                  </span>
                                )}
                              </div>
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: isSelected ? '#dbeafe' : '#f3f4f6', color: isSelected ? '#1e40af' : '#4b5563' }}>
                              {deptMembers.length} NV
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Member selection */}
            {targetType === 'individual' && (
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
                {members.map((mem) => {
                  const isChecked = selectedMemberIds.includes(mem.userId);
                  return (
                    <label
                      key={mem.userId}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        padding: '4px 6px',
                        borderRadius: 6,
                        background: isChecked ? '#eff6ff' : 'transparent',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedMemberIds((prev) => [...prev, mem.userId]);
                            } else {
                              setSelectedMemberIds((prev) => prev.filter((id) => id !== mem.userId));
                            }
                          }}
                        />
                        <span style={{ fontSize: 13, fontWeight: isChecked ? 600 : 400 }}>
                          {mem.name || mem.userId}
                        </span>
                      </div>
                      <span style={{ fontSize: 11, color: '#6b7280' }}>{getRoleLabel(mem.role)}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Switch Bắt buộc ảnh */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#f9fafb',
              padding: 12,
              borderRadius: 10,
              border: '1px solid var(--border)',
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>📸 Bắt buộc chụp ảnh minh chứng</div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>
                Khi bật, người làm việc phải chụp ảnh minh chứng thì mới được hoàn thành.
              </div>
            </div>
            <input
              type="checkbox"
              checked={requirePhoto}
              onChange={(e) => setRequirePhoto(e.target.checked)}
              style={{ width: 18, height: 18, cursor: 'pointer' }}
            />
          </div>

          {/* Action buttons */}
          <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
              Hủy
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
