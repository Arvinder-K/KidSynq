import os
import zipfile

BASE_DIR = os.path.abspath(os.path.dirname(os.path.dirname(__file__)))
ZIP_NAME = os.path.join(BASE_DIR, "kidsynq_deploy.zip")

INCLUDE_DIRS = ['apps', 'config', 'kidsynq', 'static', 'staticfiles', 'templates', 'media']
INCLUDE_FILES = ['manage.py', 'passenger_wsgi.py', '.htaccess', 'requirements.txt', '.env.example']

print(f"Creating {ZIP_NAME} from {BASE_DIR}...")

with zipfile.ZipFile(ZIP_NAME, 'w', zipfile.ZIP_DEFLATED) as zipf:
    for f in INCLUDE_FILES:
        path = os.path.join(BASE_DIR, f)
        if os.path.exists(path):
            zipf.write(path, f)
            print(f"  Added file: {f}")

    for d in INCLUDE_DIRS:
        dir_path = os.path.join(BASE_DIR, d)
        if not os.path.exists(dir_path):
            continue
        for root, dirs, files in os.walk(dir_path):
            # Exclude __pycache__
            dirs[:] = [sub for sub in dirs if sub != '__pycache__']
            for file in files:
                if file.endswith(('.pyc', '.pyo')):
                    continue
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, BASE_DIR)
                zipf.write(full_path, rel_path)

file_size_mb = os.path.getsize(ZIP_NAME) / (1024 * 1024)
print(f"SUCCESS: Created {ZIP_NAME} ({file_size_mb:.2f} MB)")

