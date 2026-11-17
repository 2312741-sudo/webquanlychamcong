"""Đóng gói phần mềm Trạm Mở Két thành public/downloads/TramMoKet.zip (chạy lại sau khi sửa file trong thư mục này)."""
import os, zipfile
here = os.path.dirname(os.path.abspath(__file__))
out = os.path.join(here, '..', '..', 'public', 'downloads', 'TramMoKet.zip')
os.makedirs(os.path.dirname(out), exist_ok=True)
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    for name in ('TramMoKet.ps1', 'CaiDat.bat', 'GoCaiDat.bat', 'README.md'):
        info = zipfile.ZipInfo('TramMoKet/' + name, date_time=(2026, 1, 1, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        with open(os.path.join(here, name), 'rb') as f:
            z.writestr(info, f.read())
print(os.path.normpath(out))
