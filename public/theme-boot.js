(function () {
  var theme = 'dark';
  try {
    var stored = localStorage.getItem('neuralgrid.theme');
    if (stored === 'light' || stored === 'dark') {
      theme = stored;
    }
  } catch (error) {}
  document.documentElement.dataset.theme = theme;
})();
