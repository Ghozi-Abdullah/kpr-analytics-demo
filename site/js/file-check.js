if (location.protocol === 'file:') {
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('app').innerHTML = '<div class="fatal" role="alert"><h2>Buka lewat Live Server</h2>'
      + '<p>Halaman ini dibuka langsung dari file, jadi data tidak bisa dibaca. Di VS Code, klik Go Live di status bar '
      + '(atau klik kanan file lalu pilih Open with Live Server).</p></div>';
  });
}
