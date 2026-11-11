@echo off
setlocal
cd /d "%~dp0"
title Buat data dummy dashboard KPR
echo Membuat ulang data DUMMY untuk folder GitHub.
echo Folder ini tidak boleh diisi data asli.
echo.
set "PY="
py -3 --version >nul 2>nul && set "PY=py -3"
if not defined PY (python --version >nul 2>nul && set "PY=python")
if not defined PY (
  echo Python belum terpasang di laptop ini.
  echo Install dari https://www.python.org/downloads/ dan centang "Add python.exe to PATH".
  goto selesai
)
%PY% -c "import pandas, openpyxl" >nul 2>nul || (
  echo Memasang pandas dan openpyxl. Ini hanya sekali, tunggu sebentar...
  %PY% -m pip install -r requirements.txt || goto gagal
)
%PY% pipeline\make_dummy.py || goto gagal
%PY% pipeline\build_data.py || goto gagal
del /q data_raw\*.xlsx >nul 2>nul
echo.
echo BERHASIL. Data dummy baru ada di site\data. Silakan commit lalu push ke GitHub.
goto selesai
:gagal
echo.
echo BELUM BERHASIL. Baca pesan di atas.
:selesai
echo.
pause
