/* Presentation and accessibility only; official controls retain their click handlers. */
(() => {
  if (window.__amsSportsUI || window.__amsSportsUIPending) return;

  const start = () => {
    if (window.__amsSportsUI || !document.body) return;
    window.__amsSportsUIPending = false;
    window.__amsSportsUI = true;

    const set = (node, key, value) => {
      if (node.getAttribute(key) !== value) node.setAttribute(key, value);
    };
    const remove = (node, key) => {
      if (node.hasAttribute(key)) node.removeAttribute(key);
    };
    const hint = (anchor, id, text, before = false) => {
      let node = document.getElementById(id);
      if (!anchor) {
        node?.remove();
        return null;
      }
      if (!node) {
        node = document.createElement('p');
        node.id = id;
        node.className = 'ams-sports-hint';
        anchor.insertAdjacentElement(before ? 'beforebegin' : 'afterend', node);
      }
      if (node.textContent !== text) node.textContent = text;
      return node;
    };
    const english = () => {
      const pageLanguage = Array.from(document.body?.classList || []).find(name => /^lang-/i.test(name));
      if (pageLanguage) return /^lang-en(?:[_-]|$)/i.test(pageLanguage);
      return /^en(?:[_-]|$)/i.test(document.documentElement.lang || '');
    };
    let projectsExpanded = false;
    let lastSelectedProject = null;
    let lastSelectedDate = null;
    let trackedGrid = null;
    let trackedDateRail = null;
    let trackedDateRailListener = null;
    let pending = false;

    const syncGrid = grid => {
      if (!grid) return;
      const wrapper = grid.closest('.field-wrapper');
      const hasMore = grid.scrollWidth > grid.clientWidth + 1
        && grid.scrollLeft + grid.clientWidth < grid.scrollWidth - 1;
      wrapper?.classList.toggle('ams-has-more-courts', hasMore);
      const message = document.getElementById('ams-grid-hint');
      if (message) message.hidden = grid.scrollWidth <= grid.clientWidth + 1;
    };
    const syncDateRail = rail => {
      if (!rail) return;
      const hasMore = rail.scrollWidth > rail.clientWidth + 1
        && rail.scrollLeft + rail.clientWidth < rail.scrollWidth - 1;
      rail.parentElement?.classList.toggle('ams-has-more-dates', hasMore);
    };
    const revealDateInRail = (node, rail) => {
      const nodeRect = node.getBoundingClientRect();
      const railRect = rail.getBoundingClientRect();
      if (!nodeRect.width || !railRect.width) return;
      const delta = nodeRect.left < railRect.left ? nodeRect.left - railRect.left
        : nodeRect.right > railRect.right ? nodeRect.right - railRect.right : 0;
      if (delta) {
        const maxScroll = Math.max(0, rail.scrollWidth - rail.clientWidth);
        rail.scrollLeft = Math.max(0, Math.min(maxScroll, rail.scrollLeft + delta));
      }
    };

    const updateProjects = () => {
      const list = document.querySelector('.service-top-box');
      const inner = list?.closest('.service-top-inner');
      let toggle = document.getElementById('ams-project-toggle');
      if (!list || !inner) {
        toggle?.remove();
        hint(null, 'ams-project-hint', '');
        return;
      }

      const items = Array.from(list.querySelectorAll('.item'));
      const mobile = window.innerWidth < 768;
      const selectedIndex = items.findIndex(item => item.classList.contains('checked'));
      const selectedProject = selectedIndex >= 0
        ? `${selectedIndex}:${items[selectedIndex].querySelector('.service-name')?.textContent.trim() || items[selectedIndex].textContent.trim()}`
        : null;
      if (selectedProject && lastSelectedProject !== null && selectedProject !== lastSelectedProject)
        projectsExpanded = selectedIndex >= 8;
      if (selectedProject) lastSelectedProject = selectedProject;
      if (selectedIndex >= 8) projectsExpanded = true;
      const selectedRequiresExpansion = selectedIndex >= 8;

      if (!list.id) list.id = 'ams-service-projects';
      if (!toggle) {
        toggle = document.createElement('button');
        toggle.id = 'ams-project-toggle';
        toggle.type = 'button';
        toggle.className = 'ams-project-toggle';
        toggle.addEventListener('click', () => {
          projectsExpanded = !projectsExpanded;
          update();
        });
      }
      if (toggle.parentElement !== inner.parentElement) inner.insertAdjacentElement('afterend', toggle);

      list.classList.toggle('ams-projects-expanded', projectsExpanded);
      items.forEach((item, index) => {
        if (mobile && index >= 8 && !projectsExpanded) set(item, 'data-ams-project-collapsed', 'true');
        else remove(item, 'data-ams-project-collapsed');
      });
      toggle.hidden = items.length <= 8 || !mobile;
      if (toggle.disabled !== selectedRequiresExpansion) toggle.disabled = selectedRequiresExpansion;
      set(toggle, 'aria-controls', list.id);
      set(toggle, 'aria-expanded', String(projectsExpanded));
      set(toggle, 'aria-disabled', String(selectedRequiresExpansion));
      const en = english();
      const toggleText = selectedRequiresExpansion
        ? (en ? 'Selected sport must stay visible' : '所选项目需保持展开')
        : en
          ? (projectsExpanded ? 'Show fewer sports' : `Show all ${items.length} sports`)
          : (projectsExpanded ? '收起项目' : `展开全部 ${items.length} 项`);
      if (toggle.textContent !== toggleText) toggle.textContent = toggleText;
      document.getElementById('ams-project-hint')?.remove();
    };

    const syncOrderHeader = () => {
      const orderPage = document.querySelector('.main-body.list-page');
      if (!orderPage) return;
      const header = document.querySelector('.header');
      let offset = 0;
      if (header && window.getComputedStyle(header).position === 'fixed') {
        const rect = header.getBoundingClientRect();
        if (rect.top <= 0 && rect.bottom > 0) offset = Math.ceil(rect.bottom);
      }
      const value = `${offset}px`;
      if (orderPage.style.getPropertyValue('--ams-order-header-offset') !== value)
        orderPage.style.setProperty('--ams-order-header-offset', value);
    };

    const update = () => {
      const en = english();
      updateProjects();
      syncOrderHeader();
      const memberPage = document.querySelector('.member-page');
      if (memberPage) set(memberPage, 'data-ams-ticket-page', String(Boolean(memberPage.querySelector('.ticket-page'))));

      document.querySelectorAll(
        '.service-top-box .item,.field-type-box .item,.date-select-box .item,.order-tab-item'
      ).forEach(node => {
        set(node, 'role', 'button');
        set(node, 'tabindex', node.disabled ? '-1' : '0');
        set(node, 'aria-pressed', String(node.classList.contains('checked') || node.classList.contains('active')));
        set(node, 'aria-label', node.textContent.trim().replace(/\s+/g, ' '));
      });

      const times = Array.from(document.querySelectorAll('.time-line .item')).map(node => node.textContent.trim());
      document.querySelectorAll('.field-box').forEach(column => {
        const court = column.querySelector('.item-name')?.textContent.trim() || '';
        column.querySelectorAll('.item').forEach((node, index) => {
          const disabled = node.classList.contains('disabled') || node.disabled
            || node.getAttribute('aria-disabled') === 'true';
          const selected = node.classList.contains('checked');
          set(node, 'role', 'button');
          set(node, 'tabindex', disabled ? '-1' : '0');
          set(node, 'aria-disabled', String(disabled));
          set(node, 'aria-pressed', String(selected));
          const price = node.querySelector('span:not(.iconzhengque)')?.textContent.trim() || '';
          const state = disabled ? (en ? 'Unavailable' : '不可选')
            : selected ? (en ? `Selected ${price}` : `已选 ${price}`) : price;
          set(node, 'aria-label', [court, times[index], state].filter(Boolean).join(' · '));
        });
      });

      const dateRail = document.querySelector('.date-box .item-box');
      if (trackedDateRail !== dateRail) {
        if (trackedDateRail && trackedDateRailListener) trackedDateRail.removeEventListener('scroll', trackedDateRailListener);
        trackedDateRail = dateRail;
        trackedDateRailListener = trackedDateRail ? () => syncDateRail(trackedDateRail) : null;
        if (trackedDateRailListener) trackedDateRail.addEventListener('scroll', trackedDateRailListener, { passive: true });
      }
      if (dateRail) {
        set(dateRail, 'role', 'group');
        set(dateRail, 'aria-label', en ? 'Booking dates; swipe horizontally to browse' : '预约日期，可左右滑动浏览');
        const selectedDate = dateRail.querySelector('.item.checked');
        if (selectedDate !== lastSelectedDate) {
          if (selectedDate) revealDateInRail(selectedDate, dateRail);
          lastSelectedDate = selectedDate;
        }
        syncDateRail(dateRail);
      } else {
        lastSelectedDate = null;
      }

      const grid = document.querySelector('.field-outer');
      if (trackedGrid !== grid) {
        if (trackedGrid) trackedGrid.removeEventListener('scroll', onGridScroll);
        trackedGrid = grid;
        trackedGrid?.addEventListener('scroll', onGridScroll, { passive: true });
      }
      const gridHint = hint(document.querySelector('.field-wrapper'), 'ams-grid-hint', en
        ? 'Rows are times; columns are courts. Swipe sideways for more courts. Tap an available price to select.'
        : '每行对应时段，每列对应场地；左右滑动查看更多场地，点击可选价格选择。', true);
      if (grid) {
        set(grid, 'role', 'region');
        set(grid, 'aria-label', en ? 'Court and time availability' : '场地与时段空闲表');
        set(grid, 'tabindex', '0');
        syncGrid(grid);
      } else {
        document.querySelector('.field-wrapper')?.classList.remove('ams-has-more-courts');
        gridHint?.remove();
      }

      const count = document.querySelectorAll('.field-box .item.checked').length;
      const order = document.querySelector('.order-wrapper');
      const activeGrid = grid && order && !grid.hidden
        && window.getComputedStyle(grid).display !== 'none'
        && window.getComputedStyle(grid.closest('.field-wrapper') || grid).display !== 'none';
      let review = document.getElementById('ams-selection-review');
      if (activeGrid && !review) {
        review = document.createElement('button');
        review.id = 'ams-selection-review';
        review.type = 'button';
        review.setAttribute('aria-live', 'polite');
        review.addEventListener('click', () => {
          const target = document.querySelector('.order-wrapper');
          if (!review.hidden && target) target.scrollIntoView({
            behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
            block: 'start'
          });
        });
        document.body.appendChild(review);
      }
      if (review) {
        review.hidden = !activeGrid || count === 0;
        const label = en ? `${count} time slots selected · Review booking` : `已选 ${count} 个时段 · 查看确认信息`;
        if (review.textContent !== label) review.textContent = label;
      }
      document.documentElement.classList.toggle('ams-has-selection', Boolean(activeGrid && count > 0));

      document.querySelectorAll('.order-operate-btn,.ticket-info .iconerweima').forEach(node => {
        set(node, 'role', 'button');
        set(node, 'tabindex', node.disabled ? '-1' : '0');
        if (node.classList.contains('iconerweima')) set(node, 'aria-label', en ? 'View admission code' : '查看入馆码');
      });
      document.querySelectorAll('.ticket-tips').forEach(node => {
        set(node, 'role', 'button');
        set(node, 'tabindex', node.disabled ? '-1' : '0');
        set(node, 'aria-expanded', String(node.classList.contains('ams-open')));
      });
    };

    const onGridScroll = () => syncGrid(trackedGrid);
    const schedule = () => {
      if (!pending) {
        pending = true;
        requestAnimationFrame(() => {
          pending = false;
          update();
        });
      }
    };

    document.addEventListener('click', event => {
      const tips = event.target.closest?.('.ticket-tips');
      document.querySelectorAll('.ticket-tips.ams-open').forEach(node => {
        if (node !== tips) {
          node.classList.remove('ams-open');
          set(node, 'aria-expanded', 'false');
        }
      });
      if (tips) {
        const open = !tips.classList.contains('ams-open');
        tips.classList.toggle('ams-open', open);
        set(tips, 'aria-expanded', String(open));
        if (open) requestAnimationFrame(() => {
          if (!tips.isConnected || !tips.classList.contains('ams-open')) return;
          const bottomBar = document.querySelector('.native-tabs');
          const visibleBottom = bottomBar ? bottomBar.getBoundingClientRect().top : window.innerHeight;
          const rect = tips.getBoundingClientRect();
          if (rect.bottom > visibleBottom - 8) window.scrollBy({
            top: rect.bottom - visibleBottom + 12,
            behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
          });
        });
      }
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        const open = document.querySelector('.ticket-tips.ams-open');
        if (open) {
          open.classList.remove('ams-open');
          set(open, 'aria-expanded', 'false');
          open.focus?.();
          event.preventDefault();
        }
        return;
      }
      if (event.repeat || (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar')) return;
      const control = event.target.closest?.('[role="button"][tabindex="0"]');
      if (!control || /^(BUTTON|A|INPUT|SELECT|TEXTAREA|SUMMARY)$/.test(control.tagName)
        || control.disabled || control.getAttribute('aria-disabled') === 'true') return;
      event.preventDefault();
      control.click();
    });
    document.addEventListener('click', event => {
      if (!event.target.closest?.('.venues .item')) return;
      projectsExpanded = false;
      lastSelectedProject = null;
      schedule();
    }, true);

    const observeLayout = () => {
      if (trackedDateRail && trackedDateRailListener) trackedDateRail.removeEventListener('scroll', trackedDateRailListener);
      trackedDateRail = null; trackedDateRailListener = null;
      trackedGrid?.removeEventListener('scroll', onGridScroll);
      trackedGrid = null;
      schedule();
    };
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['class', 'disabled', 'aria-disabled'] });
    window.addEventListener('resize', observeLayout, { passive: true });
    update();
  };

  if (document.body) start();
  else {
    window.__amsSportsUIPending = true;
    document.addEventListener('DOMContentLoaded', start, { once: true });
  }
})();
