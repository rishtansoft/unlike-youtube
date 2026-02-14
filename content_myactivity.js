
const TRANS = {
    delete: ['delete', 'remove', 'udaalit', 'удалить', 'olib tashlash', 'o\'chirish', 'yo\'q qilish']
};

function log(msg, type = 'info') {
    const styles = {
        info: 'color: #3498db; font-weight: bold;',
        success: 'color: #2ecc71; font-weight: bold;',
        error: 'color: #e74c3c; font-weight: bold;',
        warn: 'color: #f39c12; font-weight: bold;'
    };
    console.log(`%c[MyActivityHelper] ${msg}`, styles[type] || styles.info);
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

function injectStartButton() {
    if (document.getElementById('my-activity-helper-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'my-activity-helper-btn';
    btn.innerText = 'Start Deleting Comments';
    btn.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 9999;
    padding: 15px 25px;
    background-color: #d93025;
    color: white;
    border: none;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    font-family: 'Google Sans', Roboto, sans-serif;
    font-size: 16px;
    font-weight: 500;
    cursor: pointer;
    transition: transform 0.2s, background-color 0.2s;
  `;

    btn.onmouseover = () => btn.style.backgroundColor = '#b02018';
    btn.onmouseout = () => btn.style.backgroundColor = '#d93025';
    btn.onclick = () => {
        btn.innerText = 'Running...';
        btn.disabled = true;
        btn.style.opacity = '0.8';
        startDeletionProcess();
    };

    document.body.appendChild(btn);
    log('Start button injected', 'success');
}

async function clickConfirmDelete() {
    await wait(500);
    const dialogs = document.querySelectorAll('[role="dialog"]');
    const activeDialog = Array.from(dialogs).find(d => d.offsetParent !== null);

    if (activeDialog) {
        const buttons = activeDialog.querySelectorAll('button');
        for (const btn of buttons) {
            const text = (btn.innerText || btn.textContent || '').toLowerCase();
            if (TRANS.delete.some(k => text.includes(k))) {
                log('Confirm delete button found in modal', 'info');
                btn.click();
                return true;
            }
        }
    }

    return false;
}

async function startDeletionProcess() {
    let deletedCount = 0;
    let fails = 0;

    log('Starting deletion process...', 'info');

    while (true) {
        const buttons = Array.from(document.querySelectorAll('button')).filter(btn => {
            const label = (btn.getAttribute('aria-label') || '').toLowerCase();
            return TRANS.delete.some(k => label.includes(k)) && btn.offsetParent !== null; // Text match and visible
        });

        if (buttons.length === 0) {
            log('No more delete buttons found. Scrolling...', 'warn');
            window.scrollTo(0, document.body.scrollHeight);
            await wait(2000);

            const newButtons = Array.from(document.querySelectorAll('button')).filter(btn => {
                const label = (btn.getAttribute('aria-label') || '').toLowerCase();
                return TRANS.delete.some(k => label.includes(k)) && btn.offsetParent !== null;
            });

            if (newButtons.length === 0) {
                log('Process finished using scroll check. No more items loaded.', 'success');
                alert('All visible comments deleted!');
                document.getElementById('my-activity-helper-btn').innerText = 'Done!';
                return;
            }
        }

        const btn = buttons[0];
        try {
            btn.scrollIntoView({ behavior: 'auto', block: 'center' });
            await wait(300);
            btn.click();

            await wait(500);
            const modalHandled = await clickConfirmDelete();

            if (modalHandled) {
                log('Confirmed deletion in modal.', 'info');
                await wait(500);
            }

            deletedCount++;
            fails = 0;
            log(`Deleted item #${deletedCount}`, 'success');

            await wait(1500);

        } catch (e) {
            log(`Error deleting item: ${e.message}`, 'error');
            fails++;
            if (fails > 5) {
                log('Too many errors, stopping.', 'error');
                break;
            }
            await wait(2000);
        }
    }
}

if (location.href.includes('myactivity.google.com')) {
    window.addEventListener('load', () => setTimeout(injectStartButton, 1500));
    setTimeout(injectStartButton, 2000);
}
