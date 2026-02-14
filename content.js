const VIDEOS_TO_REMOVE = 1000;
const VIDEO_SELECTOR = 'ytd-playlist-video-renderer';

// Tarjimalar lug'ati
const TRANS = {
  menu: ['menu', 'action', 'more', 'опции', 'amallar', 'boshqa', 'variantlar', 'действия'],
  delete: ['delete', 'remove', 'udaalit', 'удалить', 'olib tashlash', 'o\'chirish', 'yo\'q qilish']
};

// Logger
function log(msg, type = 'info') {
  const styles = {
    info: 'color: #3498db; font-weight: bold;',
    success: 'color: #2ecc71; font-weight: bold;',
    error: 'color: #e74c3c; font-weight: bold;',
    warn: 'color: #f39c12; font-weight: bold;'
  };
  console.log(`%c[UnlikeHelper] ${msg}`, styles[type] || styles.info);
}

// Helper: Kutish
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper: Elementni kutish
async function waitFor(selector, timeout = 2000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const el = document.querySelector(selector);
    if (el) return el;
    await wait(100);
  }
  return null;
}

// 1. Menyu tugmasini topish
function findMenuButton(videoEl) {
  const iconBtns = videoEl.querySelectorAll('yt-icon-button');
  if (iconBtns.length > 0) {
    return iconBtns[iconBtns.length - 1];
  }

  const buttons = videoEl.querySelectorAll('button');
  for (const btn of buttons) {
    const label = (btn.getAttribute('aria-label') || '').toLowerCase();
    if (TRANS.menu.some(k => label.includes(k))) return btn;
  }
  return null;
}

// 2. Popup ichidan "O'chirish" tugmasini topish va bosish
async function clickDeleteInPopup() {
  const popup = await waitFor('ytd-menu-popup-renderer', 1500);
  if (!popup) return false;

  await wait(200);

  const items = Array.from(popup.querySelectorAll('ytd-menu-service-item-renderer, tp-yt-paper-item'));
  const deleteBtn = items.find(item => {
    const text = (item.innerText || item.textContent || '').toLowerCase();
    return TRANS.delete.some(k => text.includes(k));
  });

  if (deleteBtn) {
    log(`Tugma topildi: ${deleteBtn.textContent.trim()}`, 'info');
    deleteBtn.click();
    return true;
  }

  return false;
}

// Asosiy logika: Bitta videoni o'chirish
async function removeSingleVideo(videoEl) {
  try {
    videoEl.scrollIntoView({ behavior: 'auto', block: 'center' });

    const menuBtn = findMenuButton(videoEl);
    if (!menuBtn) {
      log('Menyu tugmasi topilmadi', 'warn');
      return false;
    }

    menuBtn.click();

    const clicked = await clickDeleteInPopup();

    if (clicked) {
      //log('O\'chirish buyrug\'i yuborildi', 'success');
      videoEl.style.display = 'none';
      videoEl.setAttribute('data-removed', 'true');
      await wait(500);
      return true;
    } else {
      document.body.click();
      log('Delete tugmasi topilmadi', 'error');
      return false;
    }
  } catch (e) {
    log(`Xatolik: ${e.message}`, 'error');
    return false;
  }
}

// 3. Page Refresh Logic
function handleRefreshLogic() {
  const isRetrying = sessionStorage.getItem('unlike_retry') === 'true';
  const videos = document.querySelectorAll(VIDEO_SELECTOR);

  if (videos.length === 0) {
    if (!isRetrying) {
      log('Videolar tugadi, lekin ishonch hosil qilish uchun sahifa yangilanmoqda...', 'warn');
      sessionStorage.setItem('unlike_retry', 'true');
      window.location.reload();
      return true; // Reload bo'lyapti
    } else {
      log('Sahifa yangilandi va videolar topilmadi. Jarayon chindan ham tugadi.', 'success');
      sessionStorage.removeItem('unlike_retry');
      return true; // Tugadi
    }
  } else {
    // Videolar bor, demak davom etamiz
    if (isRetrying) {
      log('Sahifa yangilandi, videolar topildi. Davom etamiz...', 'info');
      // Flagni o'chirib turamiz, toki yana tugagunicha
      sessionStorage.removeItem('unlike_retry');
    }
    return false; // Tugamadi, davom etish kerak
  }
}

// 4. Background Tab Optimization
function getDynamicWait(ms) {
  if (document.hidden) {
    // Orqa fonda vizual narsalarni kutish shart emas
    return Math.max(100, ms / 2);
  }
  return ms;
}

async function startProcess() {
  log('Jarayon boshlandi (v2.1 - Refresh & Background Fix)...', 'success');

  if (handleRefreshLogic()) {
    return;
  }

  let count = 0;
  let fails = 0;

  while (count < VIDEOS_TO_REMOVE) {
    const videos = Array.from(document.querySelectorAll(VIDEO_SELECTOR))
      .filter(v => v.style.display !== 'none' && !v.hasAttribute('data-removed'));

    if (videos.length === 0) {
      if (handleRefreshLogic()) return;
      break;
    }

    const currentVideo = videos[0];
    const waitTime = getDynamicWait(800);

    const success = await removeSingleVideo(currentVideo);

    if (success) {
      count++;
      fails = 0;
      await wait(waitTime);
    } else {
      fails++;
      log(`O'chirish muvaffaqiyatsiz. Qayta urinish ${fails}/3`, 'warn');
      await wait(getDynamicWait(2000));

      if (fails >= 3) {
        log('Ketma-ket xatoliklar, keyingi videoga o\'tamiz...', 'error');
        currentVideo.style.display = 'none';
        currentVideo.setAttribute('data-removed', 'skipped');
        fails = 0;
      }
    }
  }

  handleRefreshLogic();
}

// Ishga tushirish
if (window.location.href.includes('youtube.com/playlist?list=LL')) {
  // DOM to'liq yuklangach
  const observer = new MutationObserver((mutations, obs) => {
    const v = document.querySelector(VIDEO_SELECTOR);
    if (v) {
      obs.disconnect(); // Bir marta topilsa bo'ldi
      setTimeout(startProcess, 1000);
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}
