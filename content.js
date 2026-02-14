const VIDEOS_TO_REMOVE = 1000;
const VIDEO_SELECTOR = 'ytd-playlist-video-renderer';

const TRANS = {
  menu: ['menu', 'action', 'more', 'опции', 'amallar', 'boshqa', 'variantlar', 'действия'],
  delete: ['delete', 'remove', 'udaalit', 'удалить', 'olib tashlash', 'o\'chirish', 'yo\'q qilish']
};

function log(msg, type = 'info') {
  const styles = {
    info: 'color: #3498db; font-weight: bold;',
    success: 'color: #2ecc71; font-weight: bold;',
    error: 'color: #e74c3c; font-weight: bold;',
    warn: 'color: #f39c12; font-weight: bold;'
  };
  console.log(`%c[UnlikeHelper] ${msg}`, styles[type] || styles.info);
}

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function waitFor(selector, timeout = 2000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const el = document.querySelector(selector);
    if (el) return el;
    await wait(100);
  }
  return null;
}

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
    log(`Button found: ${deleteBtn.textContent.trim()}`, 'info');
    deleteBtn.click();
    return true;
  }

  return false;
}

async function removeSingleVideo(videoEl) {
  try {
    videoEl.scrollIntoView({ behavior: 'auto', block: 'center' });

    const menuBtn = findMenuButton(videoEl);
    if (!menuBtn) {
      log('Menu button not found', 'warn');
      return false;
    }

    menuBtn.click();

    const clicked = await clickDeleteInPopup();

    if (clicked) {
      videoEl.style.display = 'none';
      videoEl.setAttribute('data-removed', 'true');
      await wait(500);
      return true;
    } else {
      document.body.click();
      log('Delete button not found', 'error');
      return false;
    }
  } catch (e) {
    log(`Error: ${e.message}`, 'error');
    return false;
  }
}

function handleRefreshLogic() {
  const isRetrying = sessionStorage.getItem('unlike_retry') === 'true';
  const videos = document.querySelectorAll(VIDEO_SELECTOR);

  if (videos.length === 0) {
    if (!isRetrying) {
      log('Videos finished, refreshing page to verify...', 'warn');
      sessionStorage.setItem('unlike_retry', 'true');
      window.location.reload();
      return true;
    } else {
      log('Page refreshed and no videos found. Process completed.', 'success');
      sessionStorage.removeItem('unlike_retry');
      return true;
    }
  } else {
    if (isRetrying) {
      log('Page refreshed, videos found. Continuing...', 'info');
      sessionStorage.removeItem('unlike_retry');
    }
    return false;
  }
}

function getDynamicWait(ms) {
  if (document.hidden) {
    return Math.max(100, ms / 2);
  }
  return ms;
}

async function startProcess() {
  log('Process started (v2.1 - Refresh & Background Fix)...', 'success');

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
      log(`Removal failed. Retry ${fails}/3`, 'warn');
      await wait(getDynamicWait(2000));

      if (fails >= 3) {
        log('Consecutive errors, skipping to next video...', 'error');
        currentVideo.style.display = 'none';
        currentVideo.setAttribute('data-removed', 'skipped');
        fails = 0;
      }
    }
  }

  handleRefreshLogic();
}

if (window.location.href.includes('youtube.com/playlist?list=LL')) {
  const observer = new MutationObserver((mutations, obs) => {
    const v = document.querySelector(VIDEO_SELECTOR);
    if (v) {
      obs.disconnect();
      setTimeout(startProcess, 1000);
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}
