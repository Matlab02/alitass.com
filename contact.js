(() => {
  const form = document.querySelector('#requestForm');
  if (!form) return;

  const fileInput = document.querySelector('#attachment');
  const fileName = document.querySelector('#attachmentName');
  const submitButton = form.querySelector('[type="submit"]');
  const maxFileSize = 10 * 1024 * 1024;
  const initialButtonText = submitButton.textContent;

  const showToast = message => {
    if (typeof window.toast === 'function') return window.toast(message);
    const element = document.querySelector('#toast');
    if (!element) return;
    element.textContent = message;
    element.classList.add('show');
    setTimeout(() => element.classList.remove('show'), 2600);
  };

  const formatSize = bytes => {
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
  };

  const updateAttachmentName = () => {
    const file = fileInput.files[0];
    fileName.textContent = file ? `${file.name} · ${formatSize(file.size)}` : 'Fayl seçilməyib';
  };

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (file && file.size > maxFileSize) {
      fileInput.value = '';
      updateAttachmentName();
      showToast('Faylın həcmi 10 MB-dan çox olmamalıdır.');
      return;
    }
    updateAttachmentName();
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const attachment = fileInput.files[0];
    if (attachment && attachment.size > maxFileSize) {
      showToast('Faylın həcmi 10 MB-dan çox olmamalıdır.');
      return;
    }

    const payload = new FormData(form);
    submitButton.disabled = true;
    submitButton.textContent = 'Göndərilir...';

    try {
      const response = await fetch('api/contact.php', {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: payload,
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) {
        throw new Error(result.message || 'Mesajı göndərmək mümkün olmadı.');
      }

      // Eyni brauzerdəki demo admin panelində də sorğu görünür.
      try {
        const messages = JSON.parse(localStorage.getItem('alitass-messages') || '[]');
        messages.unshift({
          name: payload.get('full_name'),
          phone: payload.get('phone'),
          company: payload.get('company'),
          message: payload.get('message'),
          attachment: result.attachment || null,
          date: new Date().toLocaleDateString('az-AZ'),
        });
        localStorage.setItem('alitass-messages', JSON.stringify(messages));
      } catch (_) {
        // Serverə göndəriş uğurlu olduqda local preview xətası sorğunu dayandırmamalıdır.
      }

      form.reset();
      updateAttachmentName();
      showToast('Mesajınız qəbul edildi! Tezliklə sizinlə əlaqə saxlayacağıq. 🐰');
    } catch (error) {
      showToast(error.message || 'Göndərmək alınmadı. Yenidən cəhd edin.');
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = initialButtonText;
    }
  });
})();
