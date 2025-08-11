// محافظت از سلکتورها - غیرفعال شده
// کاربر باید تمام سلکتورها را خودش تنظیم کند

function validateSelectors(req, res, next) {
  // هیچ تنظیم خودکاری انجام نمی‌شود
  // تمام سلکتورها باید توسط کاربر تعیین شوند
  console.log('🛡️ Middleware غیرفعال - سلکتورها دست نخورده باقی می‌مانند');
  next();
}

module.exports = {
  validateSelectors
};