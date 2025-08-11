document.addEventListener('DOMContentLoaded', () => {
  const scheduleForm = document.getElementById('schedule-form');
  const scheduleIdInput = document.getElementById('schedule-id');
  const sourceIdSelect = document.getElementById('source-id');
  const cronExpressionInput = document.getElementById('cron-expression');
  const isActiveCheckbox = document.getElementById('is-active');
  const schedulesTableBody = document.getElementById('schedules-table-body');
  const cancelEditButton = document.getElementById('cancel-edit');

  let sources = [];

  // نمایش پیام خطا
  function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'alert alert-danger alert-dismissible fade show';
    errorDiv.innerHTML = `
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.querySelector('main').insertBefore(errorDiv, document.querySelector('.card'));
    setTimeout(() => errorDiv.remove(), 5000);
  }

  // نمایش پیام موفقیت
  function showSuccess(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'alert alert-success alert-dismissible fade show';
    successDiv.innerHTML = `
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.querySelector('main').insertBefore(successDiv, document.querySelector('.card'));
    setTimeout(() => successDiv.remove(), 3000);
  }

  // بررسی احراز هویت
  function checkAuth() {
    // اگر کوکی احراز هویت وجود ندارد، به صفحه ورود هدایت کن
    const authToken = document.cookie.split(';').find(c => c.trim().startsWith('auth_token='));
    if (!authToken) {
      window.location.href = '/admin';
      return false;
    }
    return true;
  }

  async function fetchSources() {
    try {
      const response = await fetch('/api/sources');
      if (response.status === 401) {
        window.location.href = '/admin';
        return;
      }
      if (!response.ok) {
        throw new Error(`خطا در دریافت منابع: ${response.status}`);
      }
      const data = await response.json();
      sources = data.sources || [];
      sourceIdSelect.innerHTML = sources.map(source => `<option value="${source.id}">${source.name}</option>`).join('');
    } catch (error) {
      console.error('Error fetching sources:', error);
      showError('خطا در دریافت لیست منابع خبری');
    }
  }

  async function fetchSchedules() {
    try {
      const response = await fetch('/api/schedules');
      if (response.status === 401) {
        window.location.href = '/admin';
        return;
      }
      if (!response.ok) {
        throw new Error(`خطا در دریافت زمان‌بندی‌ها: ${response.status}`);
      }
      const schedules = await response.json();
      renderSchedules(schedules);
    } catch (error) {
      console.error('Error fetching schedules:', error);
      showError('خطا در دریافت لیست زمان‌بندی‌ها');
    }
  }

  function renderSchedules(schedules) {
    schedulesTableBody.innerHTML = '';
    schedules.forEach(schedule => {
      const source = sources.find(s => s.id === schedule.source_id);
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${schedule.id}</td>
        <td>${source ? source.name : 'N/A'}</td>
        <td>${schedule.cron_expression}</td>
        <td>${schedule.is_active ? 'بله' : 'خیر'}</td>
        <td>${schedule.last_run}</td>
        <td>${schedule.next_run}</td>
        <td>
          <button class="btn btn-sm btn-primary edit-btn" data-id="${schedule.id}">ویرایش</button>
          <button class="btn btn-sm btn-danger delete-btn" data-id="${schedule.id}">حذف</button>
          <button class="btn btn-sm btn-success run-btn" data-id="${schedule.id}">اجرای دستی</button>
        </td>
      `;
      schedulesTableBody.appendChild(row);
    });
  }

  scheduleForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = scheduleIdInput.value;
    const sourceId = sourceIdSelect.value;
    const cronExpression = cronExpressionInput.value;
    const isActive = isActiveCheckbox.checked;

    const method = id ? 'PUT' : 'POST';
    const url = id ? `/api/schedules/${id}` : '/api/schedules';

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_id: sourceId, cron_expression: cronExpression, is_active: isActive })
      });
      if (response.ok) {
        resetForm();
        showSuccess(id ? 'زمان‌بندی با موفقیت به‌روزرسانی شد' : 'زمان‌بندی جدید با موفقیت ایجاد شد');
        fetchSchedules();
      } else if (response.status === 401) {
        window.location.href = '/admin';
      } else {
        const error = await response.json();
        showError(`خطا: ${error.message || 'خطای نامشخص'}`);
      }
    } catch (error) {
      console.error('Error saving schedule:', error);
    }
  });

  schedulesTableBody.addEventListener('click', async (e) => {
    if (e.target.classList.contains('edit-btn')) {
      const id = e.target.dataset.id;
      const response = await fetch(`/api/schedules/${id}`);
      const schedule = await response.json();
      scheduleIdInput.value = schedule.id;
      sourceIdSelect.value = schedule.source_id;
      cronExpressionInput.value = schedule.cron_expression;
      isActiveCheckbox.checked = schedule.is_active;
    }

    if (e.target.classList.contains('run-btn')) {
      const id = e.target.dataset.id;
      if (confirm('آیا می‌خواهید این وظیفه را به صورت دستی اجرا کنید؟')) {
        try {
          const response = await fetch(`/api/schedules/${id}/run`, { method: 'POST' });
          if (response.ok) {
            showSuccess('وظیفه با موفقیت برای اجرا ارسال شد.');
          } else if (response.status === 401) {
            window.location.href = '/admin';
          } else {
            const error = await response.json();
            showError(`خطا در اجرای دستی: ${error.message || 'خطای نامشخص'}`);
          }
        } catch (error) {
          console.error('Error running schedule manually:', error);
        }
      }
    }

    if (e.target.classList.contains('delete-btn')) {
      const id = e.target.dataset.id;
      if (confirm('آیا از حذف این زمان‌بندی مطمئن هستید؟')) {
        try {
          const response = await fetch(`/api/schedules/${id}`, { method: 'DELETE' });
          if (response.ok) {
            showSuccess('زمان‌بندی با موفقیت حذف شد');
            fetchSchedules();
          } else if (response.status === 401) {
            window.location.href = '/admin';
          } else {
            const error = await response.json();
            showError(`خطا در حذف: ${error.message || 'خطای نامشخص'}`);
          }
        } catch (error) {
          console.error('Error deleting schedule:', error);
        }
      }
    }
  });

  cancelEditButton.addEventListener('click', () => {
    resetForm();
  });

  function resetForm() {
    scheduleForm.reset();
    scheduleIdInput.value = '';
  }

  async function init() {
    // بررسی احراز هویت
    if (!checkAuth()) {
      return;
    }
    
    try {
      await fetchSources();
      await fetchSchedules();
    } catch (error) {
      console.error('خطا در بارگذاری اولیه:', error);
      showError('خطا در بارگذاری اطلاعات اولیه');
    }
  }

  init();
});