
(function () {
  const ThriftC = {};


  ThriftC.products = typeof THRIFTC_PRODUCTS !== 'undefined' ? THRIFTC_PRODUCTS : [];

  ThriftC.formatPrice = function (vnd) {
    return vnd.toLocaleString('vi-VN') + '₫';
  };

  ThriftC.getAccounts = function () {
    return JSON.parse(localStorage.getItem('thriftc_accounts')) || [];
  };

  ThriftC.saveAccounts = function (list) {
    localStorage.setItem('thriftc_accounts', JSON.stringify(list));
  };

  ThriftC.saveAccount = function (account) {
    const list = ThriftC.getAccounts();
    if (list.some(acc => acc.email === account.email)) return false;

    const now = new Date().toISOString();
    const withMeta = {
      ...account,
      createdAt: account.createdAt || now,
      role: account.role || 'user'
    };

    list.push(withMeta);
    ThriftC.saveAccounts(list);

    localStorage.setItem('thriftc_account', JSON.stringify(withMeta));

    return true;
  };

  // Dùng cho đăng nhập cũ: chỉ lấy 1 account chính
  ThriftC.getAccount = function () {
    return JSON.parse(localStorage.getItem('thriftc_account')) || null;
  };

  ThriftC.getAccountByEmail = function (email) {
    return ThriftC.getAccounts().find(acc => acc.email === email) || null;
  };


  ThriftC.setCurrentUser = function (user) {
    localStorage.setItem('thriftc_current_user', JSON.stringify(user));
  };

  ThriftC.getCurrentUser = function () {
    return JSON.parse(localStorage.getItem('thriftc_current_user'));
  };

  ThriftC.logout = function () {
    localStorage.removeItem('thriftc_current_user');
  };

  ThriftC.isAdmin = function (user) {
    if (!user) return false;
    if (user.role === 'admin') return true;
    if (user.email === 'admin@thriftc.com') return true;
    return false;
  };

  ThriftC._cartKey = function () {
    const user = ThriftC.getCurrentUser();
    return user ? `thriftc_cart_${user.email}` : 'thriftc_cart_guest';
  };

  ThriftC.getCart = function () {
    return JSON.parse(localStorage.getItem(ThriftC._cartKey())) || [];
  };

  ThriftC.setCart = function (cart) {
    localStorage.setItem(ThriftC._cartKey(), JSON.stringify(cart));
  };

  ThriftC.addToCart = function (productId, qty = 1) {
    const products = ThriftC.products;
    let cart = ThriftC.getCart();
    const prod = products.find(p => p.id === productId);
    if (!prod) return { added: false, reason: 'not_found' };

    const exist = cart.find(i => i.id === productId);
    if (exist) {
  
      return { added: false, reason: 'exists' };
    }

    cart.push({ ...prod, qty: Math.max(1, qty) });
    ThriftC.setCart(cart);
    return { added: true };
  };

  ThriftC.removeFromCart = function (productId) {
    let cart = ThriftC.getCart();
    cart = cart.filter(i => i.id !== productId);
    ThriftC.setCart(cart);
  };

  ThriftC.clearCart = function () {
    localStorage.removeItem(ThriftC._cartKey());
  };

  ThriftC._ordersKey = function () {
    const user = ThriftC.getCurrentUser();
    return user ? `thriftc_orders_${user.email}` : 'thriftc_orders_guest';
  };

  ThriftC.getOrders = function () {
    return JSON.parse(localStorage.getItem(ThriftC._ordersKey())) || [];
  };

  ThriftC.saveOrder = function (order) {
    const list = ThriftC.getOrders();
    list.push(order);
    localStorage.setItem(ThriftC._ordersKey(), JSON.stringify(list));
  };

  ThriftC._customerKey = function () {
    const user = ThriftC.getCurrentUser();
    if (!user) return null;
    return `thriftc_customer_${user.email}`;
  };

  ThriftC.getCustomerInfo = function () {
    const key = ThriftC._customerKey();
    if (!key) return null;
    return JSON.parse(localStorage.getItem(key)) || null;
  };

  ThriftC.saveCustomerInfo = function (info) {
    const key = ThriftC._customerKey();
    if (!key) return false;
    localStorage.setItem(key, JSON.stringify(info));
    return true;
  };

  ThriftC.isCustomerInfoComplete = function (info) {
    if (!info) return false;
    const { name, phone, email, address } = info;
    return (
      ThriftC.validators.isValidName(name) &&
      ThriftC.validators.isValidPhone(phone) &&
      ThriftC.validators.isValidEmail(email) &&
      !!address
    );
  };


  ThriftC.validators = {
    
    isValidName(str) {
      return /^[A-Za-zÀ-ỹ\s]+$/.test(str);
    },
   
    isValidPhone(str) {
      return /^[0-9]{9,11}$/.test(str);
    },
  
    isValidEmail(str) {
      return /^[a-zA-Z0-9._%+-]+@gmail\.com$/.test(str);
    }
  };

  ThriftC.checkout = function () {
    const user = ThriftC.getCurrentUser();
    if (!user) {
      alert('Vui lòng đăng nhập để thanh toán!');
      window.location.href = 'dangnhap.html';
      return false;
    }

    const info = ThriftC.getCustomerInfo();
    if (!ThriftC.isCustomerInfoComplete(info)) {
      alert('Vui lòng cập nhật đầy đủ Thông tin khách hàng trước khi thanh toán!');
      return false;
    }

    const cart = ThriftC.getCart();
    if (cart.length === 0) {
      alert('Giỏ hàng trống!');
      return false;
    }

    const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
    const order = {
      id: 'ORD-' + Date.now(),
      items: cart,
      total,
      createdAt: new Date().toISOString(),
      user: user.email,
      customer: info
    };

    ThriftC.saveOrder(order);
    ThriftC.clearCart();
    alert('✅ Thanh toán thành công! Cảm ơn bạn đã mua sắm tại ThriftC.');
    return true;
  };

  (function createDefaultAdmin() {
    let accounts = ThriftC.getAccounts();
    let adminAcc = accounts.find(a => a.email === "admin@thriftc.com");

    if (!adminAcc) {
      adminAcc = {
        name: "ThriftC Admin",
        email: "admin@thriftc.com",
        password: "123456",       // 👉 bạn có thể đổi lại
        role: "admin",
        createdAt: new Date().toISOString()
      };
      accounts.push(adminAcc);
      ThriftC.saveAccounts(accounts);
      console.log("✅ Đã tạo tài khoản admin mặc định: admin@thriftc.com / 123456");
    }

    const legacy = ThriftC.getAccount();
    if (!legacy) {
      localStorage.setItem('thriftc_account', JSON.stringify(adminAcc));
    }
  })();

  window.ThriftC = ThriftC;
})();

