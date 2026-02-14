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
  // Eng aniq usul: yt-icon-button (odatda video qatorining oxirida bo'ladi)
  const iconBtns = videoEl.querySelectorAll('yt-icon-button');
  if (iconBtns.length > 0) {
    // Ko'pincha oxirgi tugma menyu bo'ladi
    return iconBtns[iconBtns.length - 1];
  }

  // Fallback: barcha buttonlarni tekshirish
  const buttons = videoEl.querySelectorAll('button');
  for (const btn of buttons) {
    const label = (btn.getAttribute('aria-label') || '').toLowerCase();
    if (TRANS.menu.some(k => label.includes(k))) return btn;
  }
  return null;
}

// 2. Popup ichidan "O'chirish" tugmasini topish va bosish
async function clickDeleteInPopup() {
  // Popup ochilishini kutamiz
  const popup = await waitFor('ytd-menu-popup-renderer', 1500);
  if (!popup) return false;

  // Biroz render bo'lishini kutish
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
    // 1. Videoni ko'rinadigan zonaga olib kelish (muhm!)
    videoEl.scrollIntoView({ behavior: 'auto', block: 'center' });

    // 2. Menyu tugmasini topish
    const menuBtn = findMenuButton(videoEl);
    if (!menuBtn) {
      log('Menyu tugmasi topilmadi', 'warn');
      return false;
    }

    // 3. Menyuni ochish
    menuBtn.click();

    // 4. "Delete" tugmasini popup ichidan bosish
    const clicked = await clickDeleteInPopup();

    if (clicked) {
      log('O\'chirish buyrug\'i yuborildi', 'success');

      // 5. MUHIM: Videoni darhol yashirish (Youtube o'chirgunicha kutib o'tirmaymiz)
      // Bu bizga keyingi siklda xuddi shu videoni qayta tanlamaslikka yordam beradi
      videoEl.style.display = 'none';
      videoEl.setAttribute('data-removed', 'true');

      // Youtube animatsiyasi va popup yopilishi uchun ozgina pauza
      await wait(500);
      return true;
    } else {
      // Agar delete topilmasa, menyuni yopish uchun tashqariga bosamiz
      document.body.click();
      log('Delete tugmasi topilmadi', 'error');
      return false;
    }
  } catch (e) {
    log(`Xatolik: ${e.message}`, 'error');
    return false;
  }
}

async function startProcess() {
  log('Jarayon boshlandi (Optimized v3)...', 'success');

  let count = 0;
  let fails = 0;

  while (count < VIDEOS_TO_REMOVE) {
    // Faqat hali o'chirilmagan (biz yashirmagan) videolarni olamiz
    // data-removed=true bo'lmagan va ko'rinib turgan videolar
    const videos = Array.from(document.querySelectorAll(VIDEO_SELECTOR))
      .filter(v => v.style.display !== 'none' && !v.hasAttribute('data-removed'));

    if (videos.length === 0) {
      log('Barcha videolar tugadi!', 'success');
      break;
    }

    // Har doim eng birinchi turgan videoni olamiz
    const currentVideo = videos[0];

    log(`Video #${count + 1} qayta ishlanmoqda...`, 'info');
    const success = await removeSingleVideo(currentVideo);

    if (success) {
      count++;
      fails = 0;
      // Spam hisoblanmaslik uchun har bir videodan keyin minimal pauza
      await wait(800);
    } else {
      fails++;
      log(`O'chirish muvaffaqiyatsiz. Qayta urinish ${fails}/3`, 'warn');
      await wait(2000); // Xatolik bo'lsa ko'proq kutamiz

      if (fails >= 3) {
        log('Ketma-ket xatoliklar, keyingi videoga o\'tamiz...', 'error');
        // Bu videoni o'tkazib yuborish uchun uni baribir yashiramiz
        currentVideo.style.display = 'none';
        currentVideo.setAttribute('data-removed', 'skipped');
        fails = 0;
      }
    }
  }

  log(`Tugadi! Jami ${count} ta video olib tashlandi.`, 'success');
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
