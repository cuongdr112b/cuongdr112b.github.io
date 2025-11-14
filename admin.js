// admin.js - Quản lý tài khoản & đơn hàng cho ThriftC
document.addEventListener('DOMContentLoaded', function () {
  const current = ThriftC.getCurrentUser();

  // Chỉ cho admin vào
  if (!current || !ThriftC.isAdmin(current)) {
    alert('Chỉ quản trị viên mới được truy cập trang này.');
    window.location.href = 'dangnhap.html';
    return;
  }

  const searchInput    = document.getElementById('search');
  const accountInfo    = document.getElementById('account-info');
  const accountList    = document.getElementById('account-list');
  const ordersContainer= document.getElementById('orders-admin');

  const detailModal    = document.getElementById('order-detail-modal');
  const detailClose    = document.getElementById('order-detail-close');
  const detailBody     = document.getElementById('order-detail-body');

  const adminLabel     = document.getElementById('admin-user-label');
  const logoutBtn      = document.getElementById('logout-btn');
  const backHomeBtn    = document.getElementById('back-home-btn');

  // Danh sách tài khoản (sẽ cập nhật lại khi có thay đổi)
  let allAccounts = ThriftC.getAccounts();

  // ====== STATE ĐƠN HÀNG (FILTER) ======
  let gAllOrders = [];
  let gOrdersFilterStatus  = 'all';
  let gOrdersFilterKeyword = '';

  // Hiển thị admin hiện tại
  if (adminLabel) {
    adminLabel.textContent = 'Admin: ' + (current.name || current.email);
  }
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      ThriftC.logout();
      alert('Đã đăng xuất admin.');
      window.location.href = 'dangnhap.html';
    });
  }
  if (backHomeBtn) {
    backHomeBtn.addEventListener('click', () => {
      window.location.href = 'webchinh.html';
    });
  }

  // ============ RENDER TÀI KHOẢN ============
  function renderAccounts(filterText = '') {
    const keyword = filterText.trim().toLowerCase();

    const filtered = allAccounts.filter(acc => {
      if (!keyword) return true;
      return (
        (acc.name || '').toLowerCase().includes(keyword) ||
        (acc.email || '').toLowerCase().includes(keyword)
      );
    });

    const total  = allAccounts.length;
    const admins = allAccounts.filter(a => a.role === 'admin' || a.email === 'admin@thriftc.com').length;
    const users  = total - admins;

    accountInfo.innerHTML =
      `Bạn đang đăng nhập bằng: <strong>${current.name || current.email}</strong> (${current.email})<br>` +
      `Tổng <strong>${total}</strong> tài khoản · <strong>${admins}</strong> admin · <strong>${users}</strong> user · ` +
      `Đang hiển thị: <strong>${filtered.length}</strong>`;

    if (!filtered.length) {
      accountList.innerHTML = `
        <section class="admin-section">
          <p>Không tìm thấy tài khoản nào khớp từ khóa.</p>
        </section>`;
      return;
    }

    const rows = filtered.map(acc => {
      const createdAt = acc.createdAt
        ? new Date(acc.createdAt).toLocaleString('vi-VN')
        : '';
      const roleLabel = acc.role || (acc.email === 'admin@thriftc.com' ? 'admin' : 'user');
      const isDefaultAdmin = acc.email === 'admin@thriftc.com';
      const isCurrentAdmin = acc.email === current.email;

      const disableDanger =
        isDefaultAdmin || isCurrentAdmin
          ? 'disabled style="opacity:0.5;cursor:not-allowed;"'
          : '';

      return `
        <tr>
          <td>${acc.name || ''}</td>
          <td>${acc.email || ''}</td>
          <td>${roleLabel}</td>
          <td>${createdAt}</td>
          <td>
            <button class="btn-small" onclick="AdminUI.showDetail('${acc.email}')">Chi tiết</button>
            <button class="btn-small" onclick="AdminUI.viewOrdersForUser('${acc.email}')">Đơn</button>
            <button class="btn-small" onclick="AdminUI.resetPassword('${acc.email}')" ${isDefaultAdmin ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}>Đặt lại MK</button>
            <button class="btn-small" onclick="AdminUI.deleteAccount('${acc.email}')" ${disableDanger}>Xoá</button>
          </td>
        </tr>
      `;
    }).join('');

    accountList.innerHTML = `
      <section class="admin-section">
        <h3>Danh sách tài khoản</h3>
        <div style="overflow-x:auto;">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Họ tên</th>
                <th>Email</th>
                <th>Quyền</th>
                <th>Ngày tạo</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  // ============ ĐƠN HÀNG ============

  // Quét toàn bộ localStorage key bắt đầu bằng 'thriftc_orders'
  function getAllOrdersForAdmin() {
    const all = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith('thriftc_orders')) continue;

      try {
        const list = JSON.parse(localStorage.getItem(key) || '[]');
        if (!Array.isArray(list)) continue;
        list.forEach((o, index) => {
          all.push({
            ...o,
            _storeKey: key,
            _index: index
          });
        });
      } catch (e) {
        console.warn('Không đọc được đơn từ key', key, e);
      }
    }
    return all;
  }

  function updateOrderStatus(storeKey, index, newStatus) {
    try {
      const raw = localStorage.getItem(storeKey);
      const list = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(list) || !list[index]) return false;
      list[index].status = newStatus;
      localStorage.setItem(storeKey, JSON.stringify(list));
      return true;
    } catch (e) {
      console.error('Lỗi khi cập nhật trạng thái đơn', e);
      return false;
    }
  }

  function getOrderByStoreKeyIndex(storeKey, index) {
    try {
      const raw = localStorage.getItem(storeKey);
      const list = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(list) || !list[index]) return null;
      return list[index];
    } catch (e) {
      console.error('Lỗi khi đọc đơn chi tiết', e);
      return null;
    }
  }

  function renderOrdersAdmin() {
    const orders = gAllOrders;

    if (!orders.length) {
      ordersContainer.innerHTML = `
        <section class="admin-section">
          <h3>Quản lý đơn hàng</h3>
          <p>Chưa có đơn hàng nào.</p>
        </section>`;
      return;
    }

    // Lọc theo status
    let list = orders.slice();
    if (gOrdersFilterStatus !== 'all') {
      const targetStatus = gOrdersFilterStatus.toLowerCase();
      list = list.filter(o => {
        const status = (o.status || 'Đang xử lý').toLowerCase();
        return status === targetStatus;
      });
    }

    // Lọc theo keyword (tên, email, mã đơn)
    if (gOrdersFilterKeyword) {
      const kw = gOrdersFilterKeyword.toLowerCase();
      list = list.filter(o => {
        const name = (o.name || (o.customer && o.customer.name) || '').toLowerCase();
        const email = (o.email || o.user || (o.customer && o.customer.email) || '').toLowerCase();
        const idStr = (o.id + '').toLowerCase();
        return (
          name.includes(kw) ||
          email.includes(kw) ||
          idStr.includes(kw)
        );
      });
    }

    if (!list.length) {
      ordersContainer.innerHTML = `
        <section class="admin-section">
          <h3>Quản lý đơn hàng</h3>
          <p>Không có đơn hàng nào khớp bộ lọc hiện tại.</p>
        </section>`;
      return;
    }

    const rows = list
      .sort((a, b) => {
        const da = a.date || a.createdAt || '';
        const db = b.date || b.createdAt || '';
        return ('' + db).localeCompare('' + da); // đơn mới lên trước
      })
      .map(o => {
        const status = o.status || 'Đang xử lý';
        const total = typeof o.total === 'number'
          ? ThriftC.formatPrice(o.total)
          : (o.total || '');
        const dateText = o.date ||
          (o.createdAt ? new Date(o.createdAt).toLocaleString('vi-VN') : '');
        const name = o.name || (o.customer && o.customer.name) || '';
        const email = o.email || o.user || (o.customer && o.customer.email) || '';
        const payment = o.payment || '';

        return `
          <tr>
            <td>#${o.id}</td>
            <td>
              <div><strong>${name || '(không tên)'}</strong></div>
              <div style="font-size:0.8rem;color:var(--gray-text);">${email}</div>
            </td>
            <td>${total}</td>
            <td>${payment}</td>
            <td>
              <select class="order-status-select"
                      data-store-key="${o._storeKey}"
                      data-index="${o._index}">
                <option value="Đang xử lý" ${status === 'Đang xử lý' ? 'selected' : ''}>Đang xử lý</option>
                <option value="Đã hoàn thành" ${status === 'Đã hoàn thành' ? 'selected' : ''}>Đã hoàn thành</option>
                <option value="Đã hủy" ${status === 'Đã hủy' ? 'selected' : ''}>Đã hủy</option>
              </select>
            </td>
            <td style="font-size:0.8rem;">${dateText}</td>
            <td>
              <button
                class="btn-small order-view-detail"
                data-store-key="${o._storeKey}"
                data-index="${o._index}">
                Xem
              </button>
            </td>
          </tr>
        `;
      }).join('');

    ordersContainer.innerHTML = `
      <section class="admin-section">
        <h3>Quản lý đơn hàng</h3>
        <p class="products-sub" style="margin-bottom:10px;">
          Tổng ${orders.length} đơn (quét tất cả key <code>thriftc_orders*</code> trong trình duyệt).
        </p>

        <!-- FILTER ĐƠN HÀNG -->
        <div class="admin-orders-filter">
          <span class="admin-orders-filter-label">Lọc đơn:</span>
          <input
            type="text"
            id="admin-order-search"
            placeholder="Tìm theo mã đơn, tên, email..."
            value="${gOrdersFilterKeyword}"
          >
          <div class="admin-orders-filter-buttons">
            <button type="button" class="admin-orders-filter-btn ${gOrdersFilterStatus === 'all' ? 'active' : ''}" data-status="all">Tất cả</button>
            <button type="button" class="admin-orders-filter-btn ${gOrdersFilterStatus === 'Đang xử lý' ? 'active' : ''}" data-status="Đang xử lý">Đang xử lý</button>
            <button type="button" class="admin-orders-filter-btn ${gOrdersFilterStatus === 'Đã hoàn thành' ? 'active' : ''}" data-status="Đã hoàn thành">Đã hoàn thành</button>
            <button type="button" class="admin-orders-filter-btn ${gOrdersFilterStatus === 'Đã hủy' ? 'active' : ''}" data-status="Đã hủy">Đã hủy</button>
          </div>
        </div>

        <div class="admin-orders-table-wrapper">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Mã đơn</th>
                <th>Khách hàng</th>
                <th>Tổng tiền</th>
                <th>Thanh toán</th>
                <th>Trạng thái</th>
                <th>Ngày tạo</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  // ============ MODAL CHI TIẾT ĐƠN ============

  function openOrderDetail(storeKey, index) {
    const order = getOrderByStoreKeyIndex(storeKey, parseInt(index, 10));
    if (!order) {
      alert('Không đọc được thông tin đơn hàng.');
      return;
    }

    const status = order.status || 'Đang xử lý';
    const total = typeof order.total === 'number'
      ? ThriftC.formatPrice(order.total)
      : (order.total || '');
    const shipping = typeof order.shipping === 'number'
      ? ThriftC.formatPrice(order.shipping)
      : (order.shipping || '');
    const dateText = order.date ||
      (order.createdAt ? new Date(order.createdAt).toLocaleString('vi-VN') : '');
    const name = order.name || (order.customer && order.customer.name) || '';
    const email = order.email || order.user || (order.customer && order.customer.email) || '';
    const phone = order.phone || (order.customer && order.customer.phone) || '';
    const address = order.address || (order.customer && order.customer.address) || '';
    const payment = order.payment || '';

    let itemsHTML = '';
    (order.items || []).forEach(i => {
      const sub = i.price * i.qty;
      itemsHTML += `
        <div class="cart-item" style="margin-bottom:8px;">
          <img src="${i.img}" alt="${i.name}">
          <div>
            <div><strong>${i.name}</strong></div>
            <small>${i.qty} x ${ThriftC.formatPrice(i.price)}</small>
          </div>
          <div style="margin-left:auto;font-weight:600;">
            ${ThriftC.formatPrice(sub)}
          </div>
        </div>
      `;
    });

    detailBody.innerHTML = `
      <p><strong>Mã đơn:</strong> #${order.id}</p>
      <p><strong>Ngày tạo:</strong> ${dateText}</p>
      <p><strong>Trạng thái:</strong> ${status}</p>
      <p><strong>Thanh toán:</strong> ${payment}</p>
      <hr>
      <p><strong>Khách hàng:</strong> ${name || '(không tên)'}</p>
      <p><strong>Email:</strong> ${email || '-'}</p>
      <p><strong>SĐT:</strong> ${phone || '-'}</p>
      <p><strong>Địa chỉ:</strong> ${address || '-'}</p>
      <hr>
      <p><strong>Sản phẩm:</strong></p>
      ${itemsHTML || '<p>Không có sản phẩm.</p>'}
      <hr>
      ${shipping ? `<p>Phí giao hàng: <strong>${shipping}</strong></p>` : ''}
      <p>Tổng đơn: <strong>${total}</strong></p>
    `;

    detailModal.style.display = 'flex';
  }

  function closeOrderDetail() {
    detailModal.style.display = 'none';
  }

  // ============ EVENTS ============

  // Tìm kiếm tài khoản
  if (searchInput) {
    searchInput.addEventListener('input', function () {
      renderAccounts(this.value);
    });
  }

  // Đổi trạng thái đơn hàng
  document.addEventListener('change', function (e) {
    if (e.target.matches('.order-status-select')) {
      const sel = e.target;
      const storeKey = sel.getAttribute('data-store-key');
      const index = parseInt(sel.getAttribute('data-index'), 10);
      const newStatus = sel.value;

      const ok = updateOrderStatus(storeKey, index, newStatus);
      if (!ok) {
        alert('Có lỗi khi cập nhật trạng thái đơn. Vui lòng thử lại.');
        return;
      }

      // Cập nhật lại danh sách từ localStorage & render theo filter hiện tại
      gAllOrders = getAllOrdersForAdmin();
      renderOrdersAdmin();
    }
  });

  // Click filter trạng thái đơn + xem chi tiết đơn
  document.addEventListener('click', function (e) {
    if (e.target.matches('.admin-orders-filter-btn')) {
      const status = e.target.getAttribute('data-status') || 'all';
      gOrdersFilterStatus = status;

      // update active
      const btns = document.querySelectorAll('.admin-orders-filter-btn');
      btns.forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');

      renderOrdersAdmin();
    }

    if (e.target.matches('.order-view-detail')) {
      const storeKey = e.target.getAttribute('data-store-key');
      const index = e.target.getAttribute('data-index');
      openOrderDetail(storeKey, index);
    }

    if (e.target === detailModal) {
      closeOrderDetail();
    }
  });

  // Search theo mã đơn / tên / email
  document.addEventListener('input', function (e) {
    if (e.target.id === 'admin-order-search') {
      gOrdersFilterKeyword = e.target.value || '';
      renderOrdersAdmin();
    }
  });

  // Đóng modal chi tiết
  if (detailClose) {
    detailClose.addEventListener('click', closeOrderDetail);
  }

  // Render lần đầu
  renderAccounts();
  gAllOrders = getAllOrdersForAdmin();
  renderOrdersAdmin();

  // ====== HÀM CHO NÚT TRONG BẢNG TÀI KHOẢN (GLOBAL) ======
  window.AdminUI = {
    showDetail(email) {
      const acc = allAccounts.find(a => a.email === email) || ThriftC.getAccountByEmail(email);
      if (!acc) {
        alert('Không tìm thấy tài khoản.');
        return;
      }

      const createdAt = acc.createdAt
        ? new Date(acc.createdAt).toLocaleString('vi-VN')
        : 'Không rõ';

      const ordersOfUser = gAllOrders.filter(o => {
        const em = (o.email || o.user || (o.customer && o.customer.email) || '').toLowerCase();
        return em === email.toLowerCase();
      });

      const info =
`Tên: ${acc.name || '—'}
Email: ${acc.email}
Vai trò: ${acc.role || (acc.email === 'admin@thriftc.com' ? 'admin' : 'user')}
Ngày tạo: ${createdAt}
Số đơn đã đặt (ước lượng theo email): ${ordersOfUser.length}`;

      alert(info);
    },

    viewOrdersForUser(email) {
      gOrdersFilterKeyword = email;
      gOrdersFilterStatus = 'all';
      renderOrdersAdmin();

      const searchOrderInput = document.getElementById('admin-order-search');
      if (searchOrderInput) searchOrderInput.value = email;

      if (ordersContainer) {
        window.scrollTo({
          top: ordersContainer.offsetTop - 80,
          behavior: 'smooth'
        });
      }
    },

    resetPassword(email) {
      if (email === 'admin@thriftc.com') {
        alert('Không được đặt lại mật khẩu admin mặc định tại đây.');
        return;
      }

      const accounts = ThriftC.getAccounts();
      const idx = accounts.findIndex(a => a.email === email);
      if (idx === -1) {
        alert('Không tìm thấy tài khoản để đặt lại mật khẩu.');
        return;
      }

      if (!confirm(`Đặt lại mật khẩu cho "${email}" về "123456"?`)) return;

      accounts[idx].password = '123456';
      ThriftC.saveAccounts(accounts);

      allAccounts = ThriftC.getAccounts();
      renderAccounts(searchInput ? searchInput.value : '');
      alert('Đã đặt lại mật khẩu thành "123456".');
    },

    deleteAccount(email) {
      if (email === 'admin@thriftc.com' || email === current.email) {
        alert('Không được xoá tài khoản admin mặc định hoặc admin đang đăng nhập.');
        return;
      }

      if (!confirm(`Bạn có chắc muốn xoá tài khoản "${email}"? Hành động này không thể hoàn tác.`)) return;

      let accounts = ThriftC.getAccounts();
      const before = accounts.length;
      accounts = accounts.filter(a => a.email !== email);
      ThriftC.saveAccounts(accounts);

      if (accounts.length === before) {
        alert('Không xoá được tài khoản (không tìm thấy).');
        return;
      }

      // Dọn dữ liệu của user trong localStorage (cart, orders, customer info)
      localStorage.removeItem(`thriftc_cart_${email}`);
      localStorage.removeItem(`thriftc_orders_${email}`);
      localStorage.removeItem(`thriftc_customer_${email}`);

      allAccounts = ThriftC.getAccounts();
      renderAccounts(searchInput ? searchInput.value : '');

      // Cập nhật lại danh sách đơn (vì có thể đã xoá 1 key orders_*)
      gAllOrders = getAllOrdersForAdmin();
      renderOrdersAdmin();

      alert('Đã xoá tài khoản và dữ liệu liên quan.');
    }
  };
});
